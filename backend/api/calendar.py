"""
Calendar API — fetch Google Calendar events using stored OAuth refresh token.
Route: GET /api/calendar/events
"""

import os
import re
from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, jsonify, request, session
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from backend.database.db import db
from backend.models.user import User

APP_CALENDAR_NAME = "Executive Secretary AI"
APP_TIMEZONE = "Asia/Kolkata"

calendar_bp = Blueprint("calendar", __name__)

_SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _no_store(resp):
    resp.headers["Cache-Control"] = "no-store"
    return resp


def _strip_html(text: str) -> str:
    """Remove HTML tags returned in Google Calendar event descriptions."""
    return re.sub(r"<[^>]+>", " ", text or "").strip()


def _make_creds(refresh_token: str) -> Credentials:
    return Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=_SCOPES,
    )


def _get_authed_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return User.query.get(user_id)


def _get_calendar_service_for_user(user: User, *, write: bool = False):
    if not user or not user.calendar_token:
        return None, None

    scopes = ["https://www.googleapis.com/auth/calendar"] if write else _SCOPES
    creds = Credentials(
        token=None,
        refresh_token=user.calendar_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=scopes,
    )

    # Always attempt refresh so we are never using stale credentials.
    try:
        creds.refresh(GoogleAuthRequest())
    except Exception as refresh_exc:
        print("[calendar] Token refresh failed:", refresh_exc)
        return None, None

    # If Google rotates refresh tokens (rare), persist it.
    try:
        if creds.refresh_token and creds.refresh_token != user.calendar_token:
            user.calendar_token = creds.refresh_token
            db.session.commit()
    except Exception as persist_exc:
        print("[calendar] Could not persist refreshed token:", persist_exc)

    service = build("calendar", "v3", credentials=creds, static_discovery=False)
    return service, creds


def _is_date_only(iso: str) -> bool:
    return isinstance(iso, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", iso or "") is not None


def _to_google_dt(iso: str):
    if not iso:
        return None
    if _is_date_only(iso):
        return {"date": iso}
    return {"dateTime": iso, "timeZone": APP_TIMEZONE}


def _to_api_event(ev: dict) -> dict:
    start = ev.get("start", {}) or {}
    end = ev.get("end", {}) or {}
    return {
        "id": ev.get("id", ""),
        "title": ev.get("summary") or "(No title)",
        "start": start.get("dateTime") or start.get("date") or "",
        "end": end.get("dateTime") or end.get("date") or "",
        "html_link": ev.get("htmlLink") or "",
    }


def _ensure_app_calendar(user: User, service) -> str | None:
    """Ensure the dedicated app calendar exists and return its calendarId."""
    if not user:
        return None

    # If already stored, validate it.
    if getattr(user, "app_calendar_id", None):
        try:
            service.calendarList().get(calendarId=user.app_calendar_id).execute()
            return user.app_calendar_id
        except Exception:
            user.app_calendar_id = None
            db.session.commit()

    page_token = None
    while True:
        cal_list = service.calendarList().list(maxResults=250, pageToken=page_token).execute()
        for cal in (cal_list.get("items", []) if isinstance(cal_list, dict) else []):
            if isinstance(cal, dict) and cal.get("summary") == APP_CALENDAR_NAME:
                user.app_calendar_id = cal.get("id")
                db.session.commit()
                return user.app_calendar_id

        page_token = cal_list.get("nextPageToken") if isinstance(cal_list, dict) else None
        if not page_token:
            break

    created = service.calendars().insert(
        body={"summary": APP_CALENDAR_NAME, "timeZone": APP_TIMEZONE}
    ).execute()
    user.app_calendar_id = created.get("id")
    db.session.commit()
    return user.app_calendar_id


def _list_events_for_calendar(service, calendar_id: str):
    all_items = []
    page_token = None

    while True:
        try:
            req = service.events().list(
                calendarId=calendar_id,
                maxResults=2500,
                singleEvents=True,
                orderBy="startTime",
                pageToken=page_token,
            )
            res = req.execute()
        except Exception:
            # Google API requires timeMin when using orderBy='startTime'.
            req = service.events().list(
                calendarId=calendar_id,
                timeMin="1970-01-01T00:00:00Z",
                maxResults=2500,
                singleEvents=True,
                orderBy="startTime",
                pageToken=page_token,
            )
            res = req.execute()

        items = res.get("items", [])
        all_items.extend(items)

        page_token = res.get("nextPageToken")
        if not page_token:
            break

    return all_items


def _normalize_attendees(attendees):
    if not attendees:
        return []
    if isinstance(attendees, list):
        out = []
        for a in attendees:
            if isinstance(a, str) and a.strip():
                out.append({"email": a.strip()})
            elif isinstance(a, dict) and a.get("email"):
                out.append({"email": str(a.get("email")).strip()})
        return [a for a in out if a.get("email")]
    return []


@calendar_bp.route("/events", methods=["GET"])
def get_calendar_events():
    try:
        user = _get_authed_user()
        # Always return a JSON list with HTTP 200 so the UI can render an empty calendar.
        if not user or not user.calendar_token:
            return _no_store(jsonify([])), 200

        service, _ = _get_calendar_service_for_user(user, write=False)
        if not service:
            return _no_store(jsonify([])), 200

        calendar_id = _ensure_app_calendar(user, service)
        if not calendar_id:
            return _no_store(jsonify([])), 200

        items = _list_events_for_calendar(service, calendar_id)
        mapped = [_to_api_event(ev) for ev in items if isinstance(ev, dict)]

        return _no_store(jsonify(mapped)), 200

    except Exception as exc:
        return _no_store(jsonify([])), 200


@calendar_bp.route("/events", methods=["POST"])
def create_calendar_event():
    user = _get_authed_user()
    if not user:
        return jsonify({"error": "unauthenticated"}), 401

    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    start = payload.get("start")
    end = payload.get("end")
    description = payload.get("description") or ""

    if not title or not start or not end:
        return jsonify({"error": "missing_fields"}), 400

    service, _ = _get_calendar_service_for_user(user, write=True)
    if not service:
        return jsonify({"error": "not_connected"}), 200

    calendar_id = _ensure_app_calendar(user, service)
    if not calendar_id:
        return jsonify({"error": "not_connected"}), 200

    attendees = _normalize_attendees(payload.get("attendees") or payload.get("client_emails"))

    # Optional idempotency / dedupe via iCalUID (prevents duplicate meetings).
    idempotency_key = (payload.get("idempotency_key") or payload.get("ical_uid") or "").strip()
    ical_uid = None
    if idempotency_key:
        ical_uid = idempotency_key if "@" in idempotency_key else f"{idempotency_key}@executive-secretary-ai"
        existing = service.events().list(
            calendarId=calendar_id,
            iCalUID=ical_uid,
            maxResults=1,
            singleEvents=True,
        ).execute()
        items = existing.get("items", []) if isinstance(existing, dict) else []
        if items:
            return jsonify(_to_api_event(items[0])), 200

    body = {
        "summary": title,
        "description": description,
        "start": _to_google_dt(start),
        "end": _to_google_dt(end),
    }

    if attendees:
        body["attendees"] = attendees
    if ical_uid:
        body["iCalUID"] = ical_uid

    # Helpful marker (not used for filtering; dedicated calendar is the isolation mechanism)
    body.setdefault("description", description or "Scheduled via Executive Secretary AI")

    created = service.events().insert(
        calendarId=calendar_id,
        body=body,
        sendUpdates="all",
    ).execute()
    return jsonify(_to_api_event(created)), 200


@calendar_bp.route("/events/<event_id>", methods=["PUT"])
def update_calendar_event(event_id: str):
    user = _get_authed_user()
    if not user:
        return jsonify({"error": "unauthenticated"}), 401

    payload = request.get_json(silent=True) or {}
    title = payload.get("title")
    start = payload.get("start")
    end = payload.get("end")
    description = payload.get("description")

    service, _ = _get_calendar_service_for_user(user, write=True)
    if not service:
        return jsonify({"error": "not_connected"}), 200

    calendar_id = _ensure_app_calendar(user, service)
    if not calendar_id:
        return jsonify({"error": "not_connected"}), 200

    existing = service.events().get(calendarId=calendar_id, eventId=event_id).execute()

    if title is not None:
        existing["summary"] = (title or "").strip() or existing.get("summary")
    if description is not None:
        existing["description"] = description or ""
    if start is not None:
        existing["start"] = _to_google_dt(start)
    if end is not None:
        existing["end"] = _to_google_dt(end)

    attendees = payload.get("attendees")
    if attendees is not None:
        existing["attendees"] = _normalize_attendees(attendees)

    updated = service.events().update(
        calendarId=calendar_id,
        eventId=event_id,
        body=existing,
        sendUpdates="all",
    ).execute()
    return jsonify(_to_api_event(updated)), 200


@calendar_bp.route("/events/<event_id>", methods=["DELETE"])
def delete_calendar_event(event_id: str):
    user = _get_authed_user()
    if not user:
        return jsonify({"error": "unauthenticated"}), 401

    service, _ = _get_calendar_service_for_user(user, write=True)
    if not service:
        return jsonify({"error": "not_connected"}), 200

    calendar_id = _ensure_app_calendar(user, service)
    if not calendar_id:
        return jsonify({"error": "not_connected"}), 200

    try:
        service.events().delete(
            calendarId=calendar_id,
            eventId=event_id,
            sendUpdates="all",
        ).execute()
    except Exception as exc:
        return jsonify({"error": "delete_failed"}), 200

    return jsonify({"deleted": True, "id": event_id}), 200
