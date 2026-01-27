from flask import Blueprint, jsonify, session
from datetime import datetime
import json

from backend.database.db import db
from backend.models.email import Email
from backend.models.user import User
from backend.models.task import Task
from backend.services.ai_email_service import AIEmailService
from backend.services.calendar_service import create_calendar_event
from backend.services.gmail_service import fetch_gmail_emails

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



    for email in emails:
        if email.processing_status == "pending":
            try:
                result = AIEmailService.process_email(
                    email.subject or "",
                    email.body or ""
                )
                email.ai_summary = result["summary"]
                email.urgency_level = result["urgency"]
                email.category = result["category"]
                email.processing_status = "completed"
                email.processed_at = datetime.utcnow()
            except:
                email.processing_status = "failed"

    db.session.commit()


    return jsonify([e.to_dict() for e in emails])

@emails_bp.route("/<int:email_id>/process", methods=["POST"])
def process_email(email_id):
    email = Email.query.get_or_404(email_id)

    if email.processing_status == "completed":
        return jsonify({"status": "already_processed"})

    email.processing_status = "processing"
    db.session.commit()

    try:
        result = AIEmailService.process_email(
            subject=email.subject or "",
            body=email.body or ""
        )

        email.ai_summary = result["summary"]
        email.urgency_level = result["urgency"]
        email.category = result["category"]
        email.ai_actions = json.dumps(result["actions"])
        email.ai_deadline = result["deadline"]
        email.processing_status = "completed"
        email.processed_at = datetime.utcnow()

    except Exception as e:
        email.processing_status = "failed"

    db.session.commit()

    
    return jsonify(email.to_dict())



# -----------------------------
# APPROVE EMAIL
# -----------------------------
@emails_bp.route("/<int:email_id>/approve", methods=["POST"])
def approve_email(email_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    email = Email.query.get_or_404(email_id)

    # Ensure AI exists
    if not email.ai_summary:
        result = AIEmailService.process_email(
            email.subject or "",
            email.body or ""
        )

        email.ai_summary = result["summary"]
        email.urgency_level = result["urgency"]
        email.category = result["category"]
        email.ai_actions = json.dumps(result["actions"])
        email.ai_deadline = result["deadline"]
        email.processing_status = "completed"

    # Create task
    task = Task(
        email_id=email.id,
        user_id=user_id,
        title=email.subject or "Email task",
        description=email.ai_summary,
        priority=email.urgency_level or "medium",
        suggested_deadline=email.ai_deadline
    )

    db.session.add(task)

    # Mark approved
    email.decision_status = "approved"
    email.decision_at = datetime.utcnow()

    # Calendar placeholder
    create_calendar_event(User.query.get(user_id), email)

    db.session.commit()

    return jsonify({"status": "approved"})


# -----------------------------
# REJECT EMAIL
# -----------------------------
@emails_bp.route("/<int:email_id>/reject", methods=["POST"])
def reject_email(email_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    email = Email.query.get_or_404(email_id)

    db.session.delete(email)
    db.session.commit()

    return jsonify({"status": "deleted"})
