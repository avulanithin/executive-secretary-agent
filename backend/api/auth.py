from flask import Blueprint, request, jsonify, session, redirect
from backend.database.db import db
from backend.models.user import User
from datetime import datetime
import os
import requests
from urllib.parse import urlencode

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleAuthRequest
from googleapiclient.discovery import build

auth_bp = Blueprint("auth", __name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

FRONTEND_BASE_URL = "http://localhost:8000"
GOOGLE_REDIRECT_URI = "http://localhost:5000/api/auth/google/callback"

APP_CALENDAR_NAME = "Executive Secretary AI"
APP_TIMEZONE = "Asia/Kolkata"


def _make_creds(access_token: str | None, refresh_token: str | None):
    return Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/calendar"],
    )


def _ensure_app_calendar(user: User, refresh_token: str | None, access_token: str | None):
    """Ensure the dedicated app calendar exists and store its calendarId on the user.

    This keeps Google as the source of truth and isolates personal calendars.
    """

    token = refresh_token or user.calendar_token
    if not token:
        return

    creds = _make_creds(access_token, token)
    try:
        creds.refresh(GoogleAuthRequest())
    except Exception:
        # If refresh fails here, calendar endpoints will handle it later.
        pass

    service = build("calendar", "v3", credentials=creds, static_discovery=False)

    # If already stored, validate it still exists.
    if user.app_calendar_id:
        try:
            service.calendarList().get(calendarId=user.app_calendar_id).execute()
            return
        except Exception:
            user.app_calendar_id = None
            db.session.commit()

    # Find existing calendar by name (paginate to avoid missing it on accounts with many calendars).
    page_token = None
    while True:
        cal_list = service.calendarList().list(maxResults=250, pageToken=page_token).execute()
        for cal in (cal_list.get("items", []) if isinstance(cal_list, dict) else []):
            if isinstance(cal, dict) and cal.get("summary") == APP_CALENDAR_NAME:
                user.app_calendar_id = cal.get("id")
                db.session.commit()
                return

        page_token = cal_list.get("nextPageToken") if isinstance(cal_list, dict) else None
        if not page_token:
            break

    # Create dedicated app calendar.
    created = service.calendars().insert(
        body={"summary": APP_CALENDAR_NAME, "timeZone": APP_TIMEZONE}
    ).execute()
    user.app_calendar_id = created.get("id")
    db.session.commit()


def _build_oauth_url() -> str:
    scope = " ".join([
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar",
    ])

    params = {
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
    }

    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)


@auth_bp.route("/url", methods=["GET"])
def auth_url():
    return jsonify({"url": _build_oauth_url()})


@auth_bp.route("/google/url", methods=["GET"])
def google_auth_url():
    return jsonify({"url": _build_oauth_url()})


@auth_bp.route("/google/callback", methods=["GET"])
def google_callback():
    code = request.args.get("code")
    if not code:
        return redirect(f"{FRONTEND_BASE_URL}/login.html?error=no_code")

    token_res = requests.post(GOOGLE_TOKEN_URL, data={
        "code": code,
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    })

    token_data = token_res.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")

    userinfo = requests.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"}
    ).json()

    email = userinfo["email"]

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(
            email=email,
            full_name=userinfo.get("name", email),
            password_hash="GOOGLE_OAUTH"
        )
        db.session.add(user)

    # Save refresh token (do NOT overwrite existing stored token with None).
    if refresh_token:
        user.gmail_token = refresh_token
        user.calendar_token = refresh_token

    user.last_login = datetime.utcnow()
    db.session.commit()

    # Ensure dedicated app calendar exists on first login.
    try:
        _ensure_app_calendar(user, refresh_token=refresh_token, access_token=access_token)
    except Exception as e:
        # Don't break login flow if calendar provisioning fails.
        print("[auth] Could not ensure app calendar:", e)

    # 🔥 Establish authenticated session (session-based auth)
    session["user_id"] = user.id
    session.permanent = True


    return redirect(f"{FRONTEND_BASE_URL}/index.html?google_auth=success")
