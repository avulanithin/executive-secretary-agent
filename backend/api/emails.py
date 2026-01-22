from flask import Blueprint, jsonify, session
from backend.models.email import Email
from backend.models.user import User
from backend.services.gmail_service import fetch_gmail_emails
from backend.database.db import db
import logging

emails_bp = Blueprint("emails", __name__)
logger = logging.getLogger(__name__)


# -----------------------------
# Get all emails (DB)
# -----------------------------
@emails_bp.route("/emails", methods=["GET"])
def get_emails():
    emails = Email.query.order_by(Email.received_at.desc()).all()
    return jsonify([e.to_dict() for e in emails]), 200


# -----------------------------
# Sync real Gmail emails
# -----------------------------
@emails_bp.route("/emails/sync", methods=["POST"])
def sync_emails():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        created_count = fetch_gmail_emails(user)

        return jsonify({
            "message": "Gmail emails synced successfully",
            "created": created_count
        }), 200

    except Exception as e:
        logger.exception("Gmail sync failed")
        db.session.rollback()

        return jsonify({
            "error": "Failed to sync Gmail emails",
            "details": str(e)
        }), 500
