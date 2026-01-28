from flask import Blueprint, jsonify, request, session
from datetime import datetime
import json

from backend.database.db import db
from backend.models.approval import Approval
from backend.models.task import Task
from backend.models.user import User
from backend.services.calendar_service import create_calendar_event

approvals_bp = Blueprint("approvals", __name__)


@approvals_bp.route("", methods=["GET"])
def get_pending_approvals():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"approvals": []})

    approvals = Approval.query.filter_by(
        user_id=user_id,
        status="pending"
    ).order_by(Approval.created_at.desc()).all()

    result = []
    for a in approvals:
        task = json.loads(a.original_task)

        result.append({
            "id": a.id,
            "confidence": a.confidence,
            "reasoning": a.reasoning,
            "createdAt": a.created_at.isoformat(),
            "email": {
                "from": a.email.sender,
                "subject": a.email.subject,
                "body": a.email.body,
                "date": a.email.received_at.isoformat()
            },
            "task": task
        })

    return jsonify({"approvals": result})


@approvals_bp.route("/<int:approval_id>/approve", methods=["POST"])
def approve_task(approval_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    approval = Approval.query.filter_by(
        id=approval_id,
        user_id=user_id,
        status="pending"
    ).first_or_404()

    data = request.json or {}
    task_data = data.get("task") or json.loads(approval.original_task)

    task = Task(
        user_id=user_id,
        title=task_data["title"],
        description=task_data.get("description"),
        priority=task_data.get("priority", "medium"),
        suggested_deadline=task_data.get("deadline"),
        status="pending"
    )

    db.session.add(task)
    db.session.flush()

    user = User.query.get(user_id)
    create_calendar_event(user, task)

    approval.status = "approved"
    approval.task_id = task.id
    approval.modified_task = json.dumps(task_data)
    approval.decided_at = datetime.utcnow()

    db.session.commit()

    return jsonify({"status": "approved"})


@approvals_bp.route("/<int:approval_id>/reject", methods=["POST"])
def reject_task(approval_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    approval = Approval.query.filter_by(
        id=approval_id,
        user_id=user_id
    ).first_or_404()

    approval.status = "rejected"
    approval.decided_at = datetime.utcnow()

    db.session.commit()

    return jsonify({"status": "rejected"})
