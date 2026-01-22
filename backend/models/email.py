"""
Email Model
"""
from backend.database.db import db
from datetime import datetime, timezone


class Email(db.Model):
    __tablename__ = 'emails'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    gmail_message_id = db.Column(db.String(255), unique=True, nullable=True)
    thread_id = db.Column(db.String(255), nullable=True)

    sender = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.Text, nullable=True)
    body = db.Column(db.Text, nullable=True)

    received_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    processed_at = db.Column(db.DateTime, nullable=True)
    processing_status = db.Column(db.String(50), default='pending')

    # AI-generated fields
    ai_summary = db.Column(db.Text, nullable=True)
    urgency_level = db.Column(db.String(50), nullable=True)
    category = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'sender': self.sender,
            'subject': self.subject,
            'body': self.body,
            'received_at': self.received_at.isoformat() if self.received_at else None,
            'urgency_level': self.urgency_level,
            'category': self.category,
            'ai_summary': self.ai_summary,
            'processing_status': self.processing_status
        }
