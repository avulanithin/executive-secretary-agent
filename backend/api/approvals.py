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
        return jsonify({"success": False, "error": "unauthorized"}), 401

    approval = Approval.query.filter_by(
        id=approval_id,
        user_id=user_id,
        status="pending"
    ).first()
    if not approval:
        return jsonify({"success": False, "error": "Approval not found"}), 404

    def _parse_iso_datetime(value):
        if value is None:
            return None
        if isinstance(value, datetime):
            parsed = value
        elif isinstance(value, str):
            text = value.strip()
            if not text:
                return None
            try:
                # Support common ISO-8601 forms, including trailing 'Z'
                if text.endswith("Z"):
                    text = text[:-1] + "+00:00"
                parsed = datetime.fromisoformat(text)
            except Exception:
                return None
        else:
            return None

        # Normalize tz-aware datetimes to naive UTC for consistency with utcnow()
        try:
            tzinfo = parsed.tzinfo
            if tzinfo is not None and tzinfo.utcoffset(parsed) is not None:
                from datetime import timezone

                parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        except Exception:
            return None

        return parsed

    if approval.email_id is None:
        return jsonify({"success": False, "error": "Approval is missing email_id"}), 400

    data = request.json or {}
    task_data = data.get("task")
    if task_data is None:
        try:
            task_data = json.loads(approval.original_task)
        except Exception:
            return jsonify({"success": False, "error": "Invalid original_task JSON"}), 400

    if not isinstance(task_data, dict):
        return jsonify({"success": False, "error": "Task payload must be an object"}), 400

    title = task_data.get("title")
    if not isinstance(title, str) or not title.strip():
        return jsonify({"success": False, "error": "Missing required field: title"}), 400

    # Deadlines: accept ISO strings; on parse failure set to None.
    suggested_deadline = _parse_iso_datetime(task_data.get("deadline"))
    actual_deadline = _parse_iso_datetime(task_data.get("actual_deadline"))

    if suggested_deadline is not None and not isinstance(suggested_deadline, datetime):
        return jsonify({"success": False, "error": "Invalid suggested_deadline type"}), 400
    if actual_deadline is not None and not isinstance(actual_deadline, datetime):
        return jsonify({"success": False, "error": "Invalid actual_deadline type"}), 400

    # Defensive validation before db.session.flush()
    if not user_id:
        return jsonify({"success": False, "error": "Missing required field: user_id"}), 400
    email_id = approval.email_id
    if email_id is None:
        return jsonify({"success": False, "error": "Missing required field: email_id"}), 400

    task = Task(
        user_id=user_id,
        email_id=email_id,
        title=title.strip(),
        description=task_data.get("description"),
        priority=task_data.get("priority", "medium"),
        suggested_deadline=suggested_deadline,
        actual_deadline=actual_deadline,
        status="pending",
    )

    db.session.add(task)
    try:
        db.session.flush()

        user = User.query.get(user_id)
        create_calendar_event(user, task)

        approval.status = "approved"
        approval.task_id = task.id
        approval.modified_task = json.dumps(task_data)
        approval.decided_at = datetime.utcnow()

        # Email lifecycle transition
        if approval.email is not None:
            approval.email.decision_status = "approved"
            approval.email.decision_at = datetime.utcnow()

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": f"Failed to approve task: {str(e)}"}), 500

    return jsonify({"success": True, "task_id": task.id})


@approvals_bp.route("/<int:approval_id>/reject", methods=["POST"])
def reject_task(approval_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "unauthorized"}), 401

    approval = Approval.query.filter_by(
        id=approval_id,
        user_id=user_id
    ).first()
    if not approval:
        return jsonify({"success": False, "error": "Approval not found"}), 404

    approval.status = "rejected"
    approval.decided_at = datetime.utcnow()

    # Email lifecycle transition
    if approval.email is not None:
        approval.email.decision_status = "rejected"
        approval.email.decision_at = datetime.utcnow()

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": f"Failed to reject approval: {str(e)}"}), 500

    return jsonify({"success": True, "status": "rejected"})
