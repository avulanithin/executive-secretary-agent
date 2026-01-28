from backend.database.db import db
from datetime import datetime

class Approval(db.Model):
    __tablename__ = "approvals"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)

    email_id = db.Column(db.Integer, db.ForeignKey("emails.id"), nullable=False)
    task_id = db.Column(db.Integer, nullable=True)

    status = db.Column(db.String, default="pending")  # pending | approved | rejected

    original_task = db.Column(db.Text)   # JSON
    modified_task = db.Column(db.Text)   # JSON

    confidence = db.Column(db.Float, default=0.6)
    reasoning = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    decided_at = db.Column(db.DateTime)

    email = db.relationship("Email", backref="approval")
