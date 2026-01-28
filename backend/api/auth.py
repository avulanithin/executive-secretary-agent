from flask import Blueprint, request, jsonify, session, redirect
from backend.database.db import db
from backend.models.user import User
from datetime import datetime
import os
import requests
from urllib.parse import urlencode

auth_bp = Blueprint("auth", __name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

FRONTEND_BASE_URL = "http://localhost:8000"
GOOGLE_REDIRECT_URI = "http://localhost:5000/api/auth/google/callback"


@auth_bp.route("/google/url", methods=["GET"])
def google_auth_url():
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

    return jsonify({
        "url": "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    })


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

    user.gmail_token = refresh_token
    user.last_login = datetime.utcnow()
    db.session.commit()

    # 🔥 SESSION SET
    # 🔐 Save refresh token for BOTH Gmail & Calendar
    user.gmail_token = refresh_token
    user.calendar_token = refresh_token   # ✅ THIS IS THE FIX

    user.last_login = datetime.utcnow()
    db.session.commit()


    return redirect(f"{FRONTEND_BASE_URL}/index.html?google_auth=success")
