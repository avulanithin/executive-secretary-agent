from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from backend.models.email import Email
from backend.database.db import db
from datetime import datetime
import os
import base64
from bs4 import BeautifulSoup
import logging
import base64
import os
from datetime import datetime, timedelta
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)


def decode(data):
    if not data:
        return ""
    data += "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")


def extract_body(payload):
    if payload.get("body", {}).get("data"):
        return decode(payload["body"]["data"])

    for part in payload.get("parts", []):
        mime = part.get("mimeType")
        data = part.get("body", {}).get("data")

        if mime == "text/plain" and data:
            return decode(data)

        if mime == "text/html" and data:
            return BeautifulSoup(decode(data), "html.parser").get_text(
                separator="\n", strip=True
            )

        if part.get("parts"):
            inner = extract_body(part)
            if inner:
                return inner

    return ""


import base64
from datetime import datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

def fetch_gmail_emails(user):
    if not user.gmail_token:
        print("❌ No Gmail token")
        return []

    creds = Credentials(
        token=None,
        refresh_token=user.gmail_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    )

    service = build("gmail", "v1", credentials=creds)

    # ✅ DEFAULT: fetch last 48 hours if never synced
    since = getattr(user, "last_gmail_sync", None) or (datetime.utcnow() - timedelta(days=2))

    since_ts = int(since.timestamp() * 1000)

    print("🕒 Fetching emails since:", since)

    results = service.users().messages().list(
        userId="me",
        maxResults=50
    ).execute()

    messages = results.get("messages", [])
    print(f"📥 Gmail API returned {len(messages)} messages")

    new_emails = []
    seen_message_ids = set()

    for msg in messages:
        msg_id = msg["id"]

        # Skip duplicates within the same Gmail API page
        if msg_id in seen_message_ids:
            continue
        seen_message_ids.add(msg_id)

        # IMPORTANT: This function adds Email objects to the session.
        # Any query can trigger an autoflush, which may INSERT pending rows
        # before our duplicate check completes. Use no_autoflush here.
        with db.session.no_autoflush:
            existing = Email.query.filter_by(
                user_id=user.id,
                gmail_message_id=msg_id
            ).first()

            # Safety: gmail_message_id is UNIQUE globally in this schema.
            # If it exists for any user, we must skip to avoid IntegrityError.
            if not existing:
                existing = Email.query.filter_by(gmail_message_id=msg_id).first()

        if existing:
            continue

        data = service.users().messages().get(
            userId="me",
            id=msg_id,
            format="full"
        ).execute()

        internal_date = int(data["internalDate"])
        if internal_date < since_ts:
            continue  # 🔥 THIS is the real filter

        headers = data["payload"].get("headers", [])
        subject = sender = ""

        for h in headers:
            if h["name"] == "Subject":
                subject = h["value"]
            elif h["name"] == "From":
                sender = h["value"]

        # ✅ SAFE BODY EXTRACTION
        def extract_text(payload):
            if payload.get("mimeType") == "text/plain":
                data = payload["body"].get("data")
                if data:
                    return base64.urlsafe_b64decode(
                        data + "=" * (-len(data) % 4)
                    ).decode("utf-8", errors="ignore")

            for part in payload.get("parts", []):
                text = extract_text(part)
                if text:
                    return text
            return ""

        body = extract_text(data["payload"])

        email = Email(
            user_id=user.id,
            gmail_message_id=msg_id,
            sender=sender,
            subject=subject,
            body=body,
            received_at=datetime.utcfromtimestamp(internal_date / 1000),
            processing_status="pending",
            decision_status="pending",
        )

        db.session.add(email)
        new_emails.append(email)

    # ✅ UPDATE LAST SYNC TIME
    user.last_gmail_sync = datetime.utcnow()

    print(f"✅ Gmail sync fetch complete | New emails queued: {len(new_emails)}")
    return new_emails