"""
API Blueprint Registration
"""
from backend.api.health import health_bp
from backend.api.auth import auth_bp
from backend.api.emails import emails_bp


def register_blueprints(app):
    """Register all API blueprints"""
    
    # app.register_blueprint(health_bp, url_prefix="/api")
    # #app.register_blueprint(auth_bp, url_prefix="/api/auth")
    # #app.register_blueprint(emails_bp, url_prefix="/api")

    # app.register_blueprint(auth_bp, url_prefix="/api/auth")
    # app.register_blueprint(emails_bp, url_prefix="/api/emails")
 
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(emails_bp, url_prefix="/api/emails")


