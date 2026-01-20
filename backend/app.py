from flask import Flask, request, jsonify

from config import config_by_name
from extensions import init_extensions
from api import register_blueprints
from database.db import db
from backend.services.agent_orchestrator import AgentOrchestrator


def create_app(env_name="development"):
    app = Flask(__name__)

    # Load config
    config_class = config_by_name.get(env_name)
    app.config.from_object(config_class)

    # Initialize extensions (db, jwt, cors, etc.)
    init_extensions(app)

    # Register blueprints
    register_blueprints(app)

    # Initialize AI orchestrator (singleton per app)
    orchestrator = AgentOrchestrator()

    # -----------------------------
    # Inline API route (optional)
    # -----------------------------
    @app.route("/api/process-email", methods=["POST"])
    def process_email():
        """
        API endpoint to process emails with AI
        """
        data = request.get_json(force=True)

        email_data = {
            "sender": data.get("sender"),
            "subject": data.get("subject"),
            "body": data.get("body"),
        }

        try:
            result = orchestrator.process_email(email_data)
            return jsonify({"success": True, "data": result}), 200

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # TEMP: create tables (replace with migrations later)
    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
