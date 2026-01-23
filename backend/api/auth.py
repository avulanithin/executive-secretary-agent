"""
Authentication API Endpoints
"""
from flask import Blueprint, request, jsonify, session, redirect
from backend.database.db import db
from backend.models.user import User
from datetime import datetime
import logging
import os
import requests
from urllib.parse import urlencode
# from backend.services.email_pipeline import run_email_pipeline

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# Single source of truth
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:8000")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:5000/api/auth/google/callback",
)

# -----------------------------
# Google OAuth - Get URL
# -----------------------------
@auth_bp.route("/google/url", methods=["GET"])
def google_auth_url():
    client_id = os.getenv("GOOGLE_CLIENT_ID")

    if not client_id:
        logger.error("GOOGLE_CLIENT_ID not set")
        return jsonify({"error": "Google OAuth not configured"}), 500

    scope = " ".join([
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
    ])

    params = {
        "client_id": client_id,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
    }

    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)

    return jsonify({"url": auth_url}), 200
   
    run_email_pipeline(current_user)


@auth_bp.route("/google/callback", methods=["GET"])
def google_callback():
    try:
        code = request.args.get("code")
        if not code:
            return redirect(f"{FRONTEND_BASE_URL}/login.html?error=no_code")

        # Exchange code → tokens
        token_response = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )

        if token_response.status_code != 200:
            return redirect(f"{FRONTEND_BASE_URL}/login.html?error=token_failed")

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")

        if not access_token:
            return redirect(f"{FRONTEND_BASE_URL}/login.html?error=no_access_token")

        # ✅ FIX: define userinfo_response correctly
        userinfo_response = requests.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )

        if userinfo_response.status_code != 200:
            return redirect(f"{FRONTEND_BASE_URL}/login.html?error=userinfo_failed")

        userinfo = userinfo_response.json()
        email = userinfo.get("email")

        if not email:
            return redirect(f"{FRONTEND_BASE_URL}/login.html?error=no_email")

        # Create / update user
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                full_name=userinfo.get("name", email),
                role="executive",
                is_active=True,
                password_hash="GOOGLE_OAUTH",
            )
            db.session.add(user)

        # Store REFRESH token (correct for Gmail API)
        user.gmail_token = refresh_token
        user.last_login = datetime.utcnow()
        db.session.commit()

        # Session persistence (CRITICAL)
        session["user_id"] = user.id
        session["user_email"] = user.email
        session.permanent = True

        return redirect(f"{FRONTEND_BASE_URL}/index.html?google_auth=success")

    except Exception as e:
        print("OAuth failure:", e)
        return redirect(f"{FRONTEND_BASE_URL}/login.html?error=oauth_exception")
