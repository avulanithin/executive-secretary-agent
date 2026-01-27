from backend.api.auth import auth_bp
from backend.api.emails import emails_bp
from backend.api.email_actions import actions_bp
from backend.api.emails import emails_bp
from backend.api.approvals import approvals_bp
from backend.api.tasks import tasks_bp





def register_blueprints(app):
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(emails_bp, url_prefix="/api/emails")
    app.register_blueprint(actions_bp, url_prefix="/api")
    
    
    
    app.register_blueprint(approvals_bp, url_prefix="/api/approvals")
    app.register_blueprint(tasks_bp, url_prefix="/api/tasks")

