from flask import Blueprint, jsonify, session
from datetime import datetime

from backend.database.db import db
from backend.models.email import Email
from backend.models.task import Task

approvals_bp = Blueprint("approvals", __name__)


@approvals_bp.route("", methods=["GET"])
def get_pending_approvals():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify([])

    emails = Email.query.filter_by(
        user_id=user_id,
        decision_status="pending",
        processing_status="completed"
    ).order_by(Email.received_at.desc()).all()

    return jsonify([e.to_dict() for e in emails])


@approvals_bp.route("/<int:email_id>/approve", methods=["POST"])
def approve_email(email_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    email = Email.query.filter_by(id=email_id, user_id=user_id).first_or_404()

    email.decision_status = "approved"
    email.decision_at = datetime.utcnow()

    # ✅ Create task
    task = Task(
        email_id=email.id,
        user_id=user_id,
        title=email.subject or "Approved Email Task",
        description=email.ai_summary,
        priority=email.urgency_level or "medium",
        status="pending"
    )

    db.session.add(task)
    db.session.commit()

    return jsonify({"status": "approved"})


@approvals_bp.route("/<int:email_id>/reject", methods=["POST"])
def reject_email(email_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    email = Email.query.filter_by(id=email_id, user_id=user_id).first_or_404()

    db.session.delete(email)
    db.session.commit()

    return jsonify({"status": "rejected"})
