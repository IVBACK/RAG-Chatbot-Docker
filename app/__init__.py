# app/__init__.py
import os
import logging
from flask import Flask
from flask_cors import CORS

# Import config and initialization functions
from .config import config
from .ml_models import initialize_models, are_models_ready # Import initialization function

def create_app():
    """Create and configure the Flask application instance."""
    app = Flask(__name__, template_folder='../templates', static_folder='../static')

    # Load configuration
    app.config.from_object(config)
    # Set SECRET_KEY explicitly if needed for sessions etc.
    app.secret_key = config.SECRET_KEY

    # Configure Logging further if needed
    log_level = logging.DEBUG if config.FLASK_ENV == 'development' else logging.INFO
    logging.basicConfig(level=log_level, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    app.logger.setLevel(log_level) # Set Flask's logger level

    app.logger.info(f"Creating Flask app in {config.FLASK_ENV} mode")
    app.logger.info(f"Template folder: {app.template_folder}")
    app.logger.info(f"Static folder: {app.static_folder}")

    # Initialize CORS
    cors_origins = config.get_cors_origins()
    app.logger.info(f"Initializing CORS with origins: {cors_origins}")
    CORS(app, resources={r"/chat*": {"origins": cors_origins}})


    if not are_models_ready():
        app.logger.info("Calling model initialization...")
        initialize_models()
    else:
        app.logger.info("Models detected as already initialized.")


    # Register Blueprints (routes)
    from .routes import main_bp
    app.register_blueprint(main_bp)
    app.logger.info("Main blueprint registered.")

    app.logger.info("Flask app created successfully.")
    return app