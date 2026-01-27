"""
Task Model
"""
from backend.database.db import db
from datetime import datetime


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    email_id = db.Column(db.Integer, db.ForeignKey("emails.id"), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    
    priority = db.Column(db.String(50), default="medium")  # low, medium, high
    status = db.Column(db.String(50), default="pending_approval")
    
    estimated_duration = db.Column(db.Integer)  # minutes
    suggested_deadline = db.Column(db.DateTime)
    actual_deadline = db.Column(db.DateTime)
    
    created_by_agent = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    
    
    def to_dict(self):
        """Convert task to dictionary"""
        return {
            'id': self.id,
            'email_id': self.email_id,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'status': self.status,
            'estimated_duration': self.estimated_duration,
            'suggested_deadline': self.suggested_deadline.isoformat() if self.suggested_deadline else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }