# wsgi.py
from app import create_app

app = create_app()

if __name__ == "__main__":
  # This allows running with 'python wsgi.py' for simple testing, but use Gunicorn for production
  app.run(host='0.0.0.0', port=5000, debug=(app.config.get('FLASK_ENV') == 'development'))