from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from backend.models.email import Email
from backend.database.db import db
from datetime import datetime
import os


def fetch_gmail_emails(user):
    """
    Fetch latest Gmail messages for a user and store in DB
    """

    if not user.gmail_token:
        raise Exception("User has no Gmail refresh token")

    # ✅ Build credentials CORRECTLY
    creds = Credentials(
        token=None,  # access token will be auto-fetched
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

        headers = msg_data.get("payload", {}).get("headers", [])

        def get_header(name):
            for h in headers:
                if h["name"].lower() == name.lower():
                    return h["value"]
            return None

        sender = get_header("From") or "unknown"
        subject = get_header("Subject") or "(No subject)"

        # Avoid duplicates
        if Email.query.filter_by(gmail_message_id=msg["id"]).first():
            continue

        email = Email(
            user_id=user.id,
            gmail_message_id=msg["id"],
            sender=sender,
            subject=subject,
            body="(Body parsing later)",
            received_at=datetime.utcnow(),
            processing_status="pending"
        )

        db.session.add(email)
        created += 1

    db.session.commit()
    return created
