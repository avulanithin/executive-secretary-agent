from flask import Blueprint, jsonify
from datetime import datetime
import json

from backend.database.db import db
from backend.models.email import Email
from backend.models.task import Task
from backend.services.calendar_service import create_calendar_event

actions_bp = Blueprint("email_actions", __name__)


@actions_bp.route("/emails/<int:email_id>/approve", methods=["POST"])
def approve_email(email_id):
    email = Email.query.get_or_404(email_id)

    email.decision_status = "approved"
    email.decision_at = datetime.utcnow()

    task = Task(
        email_id=email.id,
        title=email.subject,
        priority=email.urgency_level,
        due_date=email.ai_deadline
    )

    db.session.add(task)

    if email.ai_deadline:
        create_calendar_event(None, email)

    db.session.commit()
    return jsonify({"status": "approved"})


@actions_bp.route("/emails/<int:email_id>/reject", methods=["POST"])
def reject_email(email_id):
    email = Email.query.get_or_404(email_id)
    db.session.delete(email)
    db.session.commit()
    return jsonify({"status": "rejected"})
