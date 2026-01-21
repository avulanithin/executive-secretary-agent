from flask import Flask, request, jsonify, current_app
import json

from backend.config import config_by_name
from backend.extensions import init_extensions
from backend.api import register_blueprints
from backend.database.db import db
from backend.services.agent_orchestrator import AgentOrchestrator
from backend.logger import setup_logging

# -----------------------------
# Logger
# -----------------------------
logger = setup_logging()

# -----------------------------
# Import models so SQLAlchemy registers them
# -----------------------------
from backend.models.user import User
from backend.models.email import Email
from backend.models.task import Task
from backend.models.approval import Approval
from backend.models.calendar_event import CalendarEvent
from backend.models.notification import Notification
from backend.models.ai_log import AILog


def create_app(env_name="development"):
    app = Flask(__name__)
    logger.debug(f"[app.py] Flask app CREATED | app id={id(app)}")

    # -----------------------------
    # Load config
    # -----------------------------
    config_class = config_by_name[env_name]
    app.config.from_object(config_class)

    logger.debug(
        f"[app.py] Config loaded | DB URI={app.config.get('SQLALCHEMY_DATABASE_URI')}"
    )

    # -----------------------------
    # Initialize extensions (ONCE)
    # -----------------------------
    init_extensions(app)

    # -----------------------------
    # Register blueprints (ONCE)
    # -----------------------------
    register_blueprints(app)

    # -----------------------------
    # Request lifecycle logging
    # -----------------------------
    @app.before_request
    def log_before_request():
        logger.debug(f"[request] START | path={request.path}")

    @app.after_request
    def log_after_request(response):
        logger.debug(
            f"[request] END | path={request.path} | status={response.status_code}"
        )
        return response

    # -----------------------------
    # Initialize AI orchestrator
    # -----------------------------
    orchestrator = AgentOrchestrator()
    logger.debug("[app.py] AgentOrchestrator initialized")

    # -----------------------------
    # Health / index routes
    # -----------------------------
    @app.route("/")
    def index():
        return {
            "status": "ok",
            "service": "Executive Secretary Agent",
            "version": "0.1.0",
        }

    @app.route("/health")
    def health():
        return {"status": "healthy"}

    # -----------------------------
    # API: Process Email
    # -----------------------------
    @app.route("/api/process-email", methods=["POST"])
    def process_email():
        logger.debug("[process_email] ENTER")

        data = request.get_json(force=True)

        email_data = {
            "sender": data.get("sender"),
            "subject": data.get("subject"),
            "body": data.get("body"),
        }

        try:
            logger.debug("[process_email] Calling AgentOrchestrator")
            result = orchestrator.process_email(email_data)

            email_summary = result.get("email_summary") or {}

            email = Email(
                user_id=None,
                gmail_message_id=None,
                sender=email_data["sender"],
                subject=email_data["subject"],
                body=email_data["body"],
                ai_summary=json.dumps(email_summary),
                urgency_level=email_summary.get("urgency"),
                category=email_summary.get("category"),
            )

            db.session.add(email)
            db.session.flush()

            ai_log = AILog(
                user_id=None,
                agent_name="agent_orchestrator",
                input_data=email_data,
                output_data=result,
                success=True,
            )

            db.session.add(ai_log)
            db.session.commit()

            logger.debug("[process_email] SUCCESS")

            return jsonify(
                {
                    "success": True,
                    "email_id": email.id,
                    "ai_log_id": ai_log.id,
                    "data": result,
                }
            ), 200

        except Exception as e:
            logger.error("[process_email] ERROR", exc_info=True)

            db.session.rollback()

            ai_log = AILog(
                user_id=None,
                agent_name="agent_orchestrator",
                input_data=email_data,
                output_data=None,
                success=False,
                error_message=str(e),
            )

            db.session.add(ai_log)
            db.session.commit()

            return jsonify({"success": False, "error": str(e)}), 500

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True,
        use_reloader=False,
    )
