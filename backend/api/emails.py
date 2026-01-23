from flask import Blueprint, jsonify, session
from datetime import datetime, timezone
import logging
import json

from backend.models.email import Email
from backend.models.user import User
from backend.services.gmail_service import fetch_gmail_emails
from backend.services.ai_email_service import AIEmailService
from backend.database.db import db
from datetime import datetime



emails_bp = Blueprint("emails", __name__)
logger = logging.getLogger(__name__)


# -----------------------------
# Get all emails (DB)
# -----------------------------
@emails_bp.route("", methods=["GET"])
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


# -----------------------------
# AI PROCESSING (MANUAL)
# -----------------------------
@emails_bp.route("/emails/<int:email_id>/process", methods=["POST"])
def process_email_with_ai(email_id):
    """
    Manually process a single email with AI
    """

    email = Email.query.get(email_id)
    if not email:
        return jsonify({"error": "Email not found"}), 404

    # Avoid double-processing
    if email.processing_status == "completed":
        return jsonify({
            "message": "Email already processed",
            "data": email.to_dict()
        }), 200

    try:
        # Mark as processing
        email.processing_status = "processing"
        db.session.commit()

        # Call AI service
        ai_result = AIEmailService.process_email(
            subject=email.subject or "",
            body=email.body or ""
        )

        # Persist AI results
        email.ai_summary = ai_result["summary"]
        email.urgency_level = ai_result["urgency"]
        email.category = ai_result["category"]
        email.ai_actions = json.dumps(ai_result["actions"])
        email.ai_deadline = ai_result["deadline"]
        email.processed_at = datetime.now(timezone.utc)
        email.processing_status = "completed"

        db.session.commit()

        return jsonify({
            "message": "Email processed successfully",
            "data": email.to_dict()
        }), 200

    except Exception as e:
        logger.exception("AI processing failed")
        email.processing_status = "failed"
        db.session.commit()

        return jsonify({
            "error": "AI processing failed",
            "details": str(e)
        }), 500

@emails_bp.route("/emails/<int:email_id>/approve", methods=["POST"])
def approve_email(email_id):
    email = Email.query.get_or_404(email_id)

    email.decision_status = "approved"
    email.decision_at = datetime.utcnow()

    db.session.commit()

    return jsonify({
        "message": "Email approved",
        "email_id": email.id
    }), 200

@emails_bp.route("/emails/<int:email_id>/reject", methods=["POST"])
def reject_email(email_id):
    email = Email.query.get_or_404(email_id)

    email.decision_status = "rejected"
    email.decision_at = datetime.utcnow()

    db.session.commit()

    return jsonify({
        "message": "Email rejected",
        "email_id": email.id
    }), 200
