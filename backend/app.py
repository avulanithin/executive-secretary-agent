from flask import Flask
from backend.extensions import db, migrate, cors
from backend.api import register_blueprints
from backend.config import Config
import logging

from flask_cors import CORS

import os
from dotenv import load_dotenv

load_dotenv()  # 🔥 THIS WAS MISSING



logger = logging.getLogger("exec_secretary")


def create_app():
    app = Flask(__name__, instance_relative_config=True)

    CORS(
    app,
    supports_credentials=True,
    origins=["http://localhost:8000"]
)


    app.config.from_object(Config)

    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError("❌ GROQ_API_KEY is not loaded into Flask app")

    logger.debug(
        "Config loaded | DB URI=%s",
        app.config.get("SQLALCHEMY_DATABASE_URI")
    )

    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, supports_credentials=True)

    register_blueprints(app)

    logger.debug("Flask app CREATED | app id=%s", id(app))
    return app


    # # -----------------------------
    # # INIT EXTENSIONS (AFTER CONFIG)
    # # -----------------------------
    # db.init_app(app)
    # migrate.init_app(app, db)
    # cors.init_app(app, supports_credentials=True)

    # # -----------------------------
    # # REGISTER BLUEPRINTS
    # # -----------------------------
    # register_blueprints(app)

    # logger.debug("Flask app CREATED | app id=%s", id(app))
    # return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
