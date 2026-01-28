from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import pytz
import os
from backend.database.db import db

IST = pytz.timezone("Asia/Kolkata")
UTC = pytz.utc


def create_calendar_event(user, task):
    if not user.calendar_token:
        print("❌ No calendar token")
        return None

    # 🔒 Prevent duplicate events
    if task.calendar_event_id:
        print("⚠️ Calendar event already exists")
        return None

    # ✅ Ensure datetime exists
    start_utc = task.suggested_deadline or datetime.utcnow() + timedelta(minutes=10)

    # ✅ Make UTC aware
    if start_utc.tzinfo is None:
        start_utc = UTC.localize(start_utc)

    # ✅ Convert to IST
    start_ist = start_utc.astimezone(IST)
    end_ist = start_ist + timedelta(minutes=30)

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
        "summary": task.title,
        "description": task.description or "",
        "start": {
            "dateTime": start_ist.isoformat(),
            "timeZone": "Asia/Kolkata",
        },
        "end": {
            "dateTime": end_ist.isoformat(),
            "timeZone": "Asia/Kolkata",
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": 30}
            ]
        }
    }

    created = service.events().insert(
        calendarId="primary",
        body=event
    ).execute()

    task.calendar_event_id = created["id"]
    db.session.commit()

    return created.get("htmlLink")
