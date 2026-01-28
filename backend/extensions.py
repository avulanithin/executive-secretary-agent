"""
Flask Extensions
"""
from flask_migrate import Migrate
from flask_cors import CORS
import logging

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()


from backend.database.db import db  # ✅ IMPORT THE SINGLE db

logger = logging.getLogger("exec_secretary")

migrate = Migrate()
cors = CORS()


def init_extensions(app):
    logger.debug(f"[extensions.py] init_extensions called | app id={id(app)}")

    db.init_app(app)
    logger.debug(f"[extensions.py] db.init_app completed | db id={id(db)}")

    migrate.init_app(app, db)
    logger.debug("[extensions.py] Flask-Migrate initialized")

    cors.init_app(app)
    logger.debug("[extensions.py] CORS initialized")
