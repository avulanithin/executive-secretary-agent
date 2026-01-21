from backend.app import create_app
from backend.extensions import db

# 🔴 IMPORT MODELS HERE (CRITICAL)
from backend.models.user import User
from backend.models.email import Email
from backend.models.task import Task
from backend.models.approval import Approval
from backend.models.calendar_event import CalendarEvent
from backend.models.notification import Notification
from backend.models.ai_log import AILog

app = create_app()
