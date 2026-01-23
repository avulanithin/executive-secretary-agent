from flask import Flask
from backend.extensions import db, migrate, cors
from backend.api import register_blueprints
from backend.config import Config
import logging
from flask_cors import CORS


logger = logging.getLogger("exec_secretary")


def create_app():   
    app = Flask(__name__, instance_relative_config=True)

    # -----------------------------
    # LOAD CONFIG FIRST (CRITICAL)
    # -----------------------------
    CORS(app, supports_credentials=True)

    app.config.from_object(Config)

    logger.debug(
        "Config loaded | DB URI=%s",
        app.config.get("SQLALCHEMY_DATABASE_URI")
    )

    # -----------------------------
    # INIT EXTENSIONS (AFTER CONFIG)
    # -----------------------------
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, supports_credentials=True)

    # -----------------------------
    # REGISTER BLUEPRINTS
    # -----------------------------
    register_blueprints(app)

    logger.debug("Flask app CREATED | app id=%s", id(app))
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
