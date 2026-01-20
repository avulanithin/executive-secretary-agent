from database.db import db


def init_extensions(app):
    db.init_app(app)
