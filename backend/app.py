from flask import Flask
from config import config_by_name
from extensions import init_extensions
from api import register_blueprints
from database.db import db


def create_app(env_name="development"):
    app = Flask(__name__)

    config_class = config_by_name.get(env_name)
    app.config.from_object(config_class)

    # Initialize extensions
    init_extensions(app)

    # Register routes
    register_blueprints(app)

    # Create DB tables (TEMP – migrations later)
    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000)
