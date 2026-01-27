from flask import Blueprint, jsonify, session
from backend.database.db import db
from backend.models.task import Task

tasks_bp = Blueprint("tasks", __name__)

@tasks_bp.route("", methods=["GET"])
def get_tasks():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify([])

    tasks = (
        Task.query
        .filter_by(user_id=user_id)
        .order_by(Task.created_at.desc())
        .all()
    )
    return jsonify([t.to_dict() for t in tasks])


# ✅ NEW: Mark task as completed
@tasks_bp.route("/<int:task_id>/complete", methods=["POST"])
def complete_task(task_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    if not task:
        return jsonify({"error": "task not found"}), 404

    task.status = "completed"
    db.session.commit()

    return jsonify({"success": True})
