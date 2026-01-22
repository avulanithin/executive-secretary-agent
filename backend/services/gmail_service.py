from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from backend.models.email import Email
from backend.database.db import db
from datetime import datetime
import os
import base64
from bs4 import BeautifulSoup


# -----------------------------
# Helpers
# -----------------------------
def decode_base64(data: str) -> str:
    if not data:
        return ""

    missing_padding = len(data) % 4
    if missing_padding:
        data += "=" * (4 - missing_padding)

    try:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def extract_email_body(payload: dict) -> str:
    """
    Extract readable email body from Gmail payload.
    Priority:
    1. text/plain
    2. text/html (cleaned to text)
    """

    def walk_parts(parts):
        for part in parts:
            mime_type = part.get("mimeType", "")
            body = part.get("body", {})
            data = body.get("data")

            # Prefer plain text
            if mime_type == "text/plain" and data:
                return decode_base64(data)

            # HTML fallback
            if mime_type == "text/html" and data:
                html = decode_base64(data)
                soup = BeautifulSoup(html, "html.parser")
                return soup.get_text(separator="\n", strip=True)

            # Nested multipart
            if part.get("parts"):
                result = walk_parts(part["parts"])
                if result:
                    return result

        return ""

    # Single-part message
    body_data = payload.get("body", {}).get("data")
    if body_data:
        return decode_base64(body_data)

    # Multipart message
    if payload.get("parts"):
        return walk_parts(payload["parts"])

    return ""


# -----------------------------
# Gmail Sync
# -----------------------------
def fetch_gmail_emails(user):
    """
    Fetch latest Gmail messages for a user and store in DB
    """

    if not user.gmail_token:
        raise Exception("User has no Gmail refresh token")

    creds = Credentials(
        token=None,
        refresh_token=user.gmail_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    )

    service = build("gmail", "v1", credentials=creds)

    results = service.users().messages().list(
        userId="me",
        maxResults=10
    ).execute()

    messages = results.get("messages", [])
    created = 0

    for msg in messages:
        msg_data = service.users().messages().get(
            userId="me",
            id=msg["id"],
            format="full"
        ).execute()

        payload = msg_data.get("payload", {})
        headers = payload.get("headers", [])

        def get_header(name):
            for h in headers:
                if h.get("name", "").lower() == name.lower():
                    return h.get("value")
            return None

        sender = get_header("From") or "unknown"
        subject = get_header("Subject") or "(No subject)"

        # Avoid duplicates
        if Email.query.filter_by(gmail_message_id=msg["id"]).first():
            continue

        body = extract_email_body(payload)

        email = Email(
            user_id=user.id,
            gmail_message_id=msg["id"],
            sender=sender,
            subject=subject,
            body=body,
            received_at=datetime.utcnow(),  # UTC on purpose
            processing_status="pending",
        )

        db.session.add(email)
        created += 1

    db.session.commit()
    return created
