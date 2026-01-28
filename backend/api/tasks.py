from flask import Blueprint, jsonify, session
from datetime import datetime

from backend.database.db import db
from backend.models.task import Task
from backend.models.user import User
from backend.services.calendar_service import create_calendar_event

tasks_bp = Blueprint("tasks", __name__)


# -----------------------------
# GET ALL TASKS (AUTO-SYNC CALENDAR)
# -----------------------------
@tasks_bp.route("", methods=["GET"])
def get_tasks():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify([])

    user = User.query.get(user_id)

    tasks = (
        Task.query
        .filter_by(user_id=user_id)
        .order_by(Task.created_at.desc())
        .all()
    )

    # 🔥 AUTO ADD TO GOOGLE CALENDAR (NO DUPLICATES)
    for task in tasks:
        if task.suggested_deadline and not task.calendar_event_id:
            create_calendar_event(user, task)

    return jsonify([task.to_dict() for task in tasks])


# -----------------------------
# MARK TASK AS COMPLETED
# -----------------------------
@tasks_bp.route("/<int:task_id>/complete", methods=["POST"])
def complete_task(task_id):
    user_id = session.get("user_id")

    task = Task.query.filter_by(
        id=task_id,
        user_id=user_id
    ).first_or_404()

    task.status = "completed"
    db.session.commit()

    user = User.query.get(user_id)
    link = create_calendar_event(user, task)

    return jsonify({
        "success": True,
        "calendar_link": link
    })


# -----------------------------
# CALENDAR VIEW API
# -----------------------------
@tasks_bp.route("/calendar", methods=["GET"])
def calendar_tasks():

    user_id = session.get("user_id")
    if not user_id:
        return jsonify([])

    tasks = (
        Task.query
        .filter(Task.user_id == user_id))
    tasks = Task.query.filter_by(user_id=user_id).all()

        
    

    return jsonify([
    {
        "id": t.id,
        "title": t.title,
        "start": (t.suggested_deadline or t.created_at).isoformat(),
        "status": t.status,
        "priority": t.priority
    }
    for t in tasks
])

@tasks_bp.route("/calendar", methods=["GET"])
def get_calendar_tasks():
    user_id = session.get("user_id")

    tasks = Task.query.filter(
        Task.user_id == user_id,
        Task.calendar_event_id.isnot(None)
    ).all()

    return jsonify([
        {
            "title": t.title,
            "start": (
                t.suggested_deadline.isoformat()
                if t.suggested_deadline
                else t.created_at.isoformat()
            )
        }
        for t in tasks
    ])
