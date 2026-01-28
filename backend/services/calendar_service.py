from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import os
from backend.database.db import db


def create_calendar_event(user, task):
    if not user.calendar_token:
        print("❌ No calendar token")
        return None

    # 🔒 Prevent duplicate calendar events
    if task.calendar_event_id:
        print("⚠️ Calendar event already exists")
        return None

    start_time = task.suggested_deadline or datetime.utcnow() + timedelta(minutes=10)
    end_time = start_time + timedelta(minutes=30)

    creds = Credentials(
        token=None,
        refresh_token=user.calendar_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/calendar"],
    )

    service = build("calendar", "v3", credentials=creds)

    event = {
        "summary": task.title,                 # ✅ AI summary / subject
        "description": task.description or "",
        "start": {"dateTime": start_time.isoformat(), "timeZone": "Asia/Kolkata"},
        "end": {"dateTime": end_time.isoformat(), "timeZone": "Asia/Kolkata"},
        "reminders": {
            "useDefault": False,
            "overrides": [{"method": "popup", "minutes": 30}],
        },
    }

    created = service.events().insert(
        calendarId="primary",
        body=event
    ).execute()

    # 🔥 STORE EVENT ID
    task.calendar_event_id = created["id"]
    db.session.commit()

    return created.get("htmlLink")

def delete_calendar_event(user, task):
    if not user.calendar_token or not task.calendar_event_id:
        return

    creds = Credentials(
        token=None,
        refresh_token=user.calendar_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/calendar"],
    )

    service = build("calendar", "v3", credentials=creds)

    try:
        service.events().delete(
            calendarId="primary",
            eventId=task.calendar_event_id
        ).execute()
        print("🗑️ Calendar event deleted")
    except Exception as e:
        print("⚠️ Calendar delete failed:", e)

    task.calendar_event_id = None
