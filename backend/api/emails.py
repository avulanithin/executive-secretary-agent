from flask import Blueprint, jsonify, session
from datetime import datetime, timedelta
import json

from backend.database.db import db
from backend.models.email import Email
from backend.models.user import User
from backend.models.task import Task
from backend.services.ai_email_service import AIEmailService
from backend.services.gmail_service import fetch_gmail_emails

emails_bp = Blueprint("emails", __name__)


# -----------------------------
# GET EMAILS (NO FORCE SYNC)
# -----------------------------
@emails_bp.route("", methods=["GET"])
def get_emails():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify([])

    user = User.query.get(user_id)

    # 🔥 AUTO SYNC
    new_emails = fetch_gmail_emails(user)

    # 🔥 AUTO AI PROCESS
    ai = AIEmailService()
    for email in new_emails:
        try:
            ai.process_email(email)
            email.processing_status = "completed"
        except Exception as e:
            email.processing_status = "failed"
            email.ai_summary = "AI processing failed"
            print("AI ERROR:", e)

    db.session.commit()

    emails = Email.query.filter_by(
        user_id=user.id
    ).order_by(Email.received_at.desc()).all()

    return jsonify([e.to_dict() for e in emails])


# -----------------------------
# MANUAL GMAIL SYNC
# -----------------------------
@emails_bp.route("/sync", methods=["POST"])
def sync_emails():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    user = User.query.get_or_404(user_id)

    # 1️⃣ Fetch new Gmail emails
    new_emails = fetch_gmail_emails(user)

    # 2️⃣ Auto-process AI ONLY for new emails
    ai = AIEmailService()

    processed = 0
    for email in new_emails:
        try:
            ai.process_email(email)
            email.processing_status = "completed"
            processed += 1
        except Exception as e:
            email.processing_status = "failed"
            email.ai_summary = "❌ AI processing failed"
            print("AI ERROR:", e)

    db.session.commit()

    return jsonify({
        "status": "synced",
        "new_emails": len(new_emails),
        "ai_processed": processed
    })



# -----------------------------
# PROCESS EMAIL WITH AI
# -----------------------------
@emails_bp.route("/<int:email_id>/process", methods=["POST"])
def process_email(email_id):
    email = Email.query.get_or_404(email_id)

    # If already done, return immediately
    if email.processing_status == "completed":
        return jsonify(email.to_dict())

    ai = AIEmailService()

    try:
        # Mark as processing
        email.processing_status = "processing"
        db.session.commit()

        # ✅ CORRECT call
        ai.process_email(email)

        email.processing_status = "completed"
        email.processed_at = datetime.utcnow()

    except Exception as e:
        email.processing_status = "failed"
        email.ai_summary = "❌ AI processing failed"
        print("❌ AI ERROR:", e)

    finally:
        # 🔒 GUARANTEE DB STATE IS SAVED
        db.session.commit()

    return jsonify(email.to_dict())



# -----------------------------
# APPROVE EMAIL → CREATE TASK
# -----------------------------
@emails_bp.route("/<int:email_id>/approve", methods=["POST"])
def approve_email(email_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    email = Email.query.get_or_404(email_id)
    user = User.query.get(user_id)

    # Ensure AI processing exists
    if not email.ai_summary:
        result = AIEmailService.process_email(
            email.subject or "",
            email.body or ""
        )
        email.ai_summary = result["summary"]
        email.urgency_level = result["urgency"]
        email.category = result["category"]
        email.ai_deadline = result["deadline"]
        email.processing_status = "completed"

    # ✅ Create task
    task = Task(
        user_id=user_id,
        email_id=email.id,
        title=email.ai_summary or email.subject,
        description=email.body,
        priority=email.urgency_level or "medium",
        suggested_deadline=email.ai_deadline or datetime.utcnow() + timedelta(hours=2),
        status="pending"
    )

    db.session.add(task)
    db.session.flush()  # 🔥 ensures task.id exists

    # ✅ Create calendar event
    from backend.services.calendar_service import create_calendar_event
    create_calendar_event(user, task)

    # Mark email approved
    email.decision_status = "approved"
    email.decision_at = datetime.utcnow()

    db.session.commit()

    return jsonify({"success": True})


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
