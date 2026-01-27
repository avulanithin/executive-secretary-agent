from flask import Blueprint, jsonify, session
from datetime import datetime
import json

from backend.database.db import db
from backend.models.email import Email
from backend.models.user import User
from backend.services.gmail_service import fetch_gmail_emails
from backend.services.ai_email_service import AIEmailService

emails_bp = Blueprint("emails", __name__)


@emails_bp.route("", methods=["GET"])
def get_emails():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify([])

    emails = (
        Email.query
        .filter_by(user_id=user_id)
        .order_by(Email.received_at.desc())
        .all()
    )

    return jsonify([e.to_dict() for e in emails])


@emails_bp.route("/sync", methods=["POST"])
def sync_emails():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    user = User.query.get(user_id)
    created = fetch_gmail_emails(user)
    return jsonify({"synced": created})
