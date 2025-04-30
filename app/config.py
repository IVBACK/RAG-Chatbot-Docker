# app/config.py
import os
import logging
# Ensure python-dotenv is in your requirements.txt
try:
    from dotenv import load_dotenv
except ImportError:
    logging.warning("python-dotenv not installed. Relying on system environment variables.")
    def load_dotenv(dotenv_path=None, verbose=False): pass # Define a dummy function

# --- Configuration ---
# Determine the base directory of the project (RAG-Chatbot-Docker)
# This assumes config.py is in the 'app' subdirectory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOTENV_PATH = os.path.join(BASE_DIR, '.env')

if os.path.exists(DOTENV_PATH):
    load_dotenv(dotenv_path=DOTENV_PATH, verbose=True)
    logging.info(f".env file loaded from: {DOTENV_PATH}")
else:
    logging.warning(f".env file not found at: {DOTENV_PATH}. Relying on system environment variables.")

class Config:
    """Application configuration variables."""
    # Secret key for Flask sessions (optional but good practice)
    SECRET_KEY = os.getenv('SECRET_KEY', 'a-default-secret-key-for-dev')

    # Database
    DB_HOST = os.getenv("DB_HOST", "rag-db") # Default to service name
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")

    # Data Directory
    DATA_DIR = os.getenv("DATA_DIR", os.path.join(BASE_DIR, "data")) # Path relative to project root

    # LLM / Ollama
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434") # Default to service name in Docker

    # ML Models
    EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-mpnet-base-v2")
    CLASSIFIER_MODEL_NAME = os.getenv("CLASSIFIER_MODEL", "facebook/bart-large-mnli")

    # NLTK
    STOPWORDS_LNG = os.getenv("STOPWORDS_LNG", "english")
    # Define NLTK data path within the container (can be mapped to a volume)
    NLTK_DATA_PATH = os.getenv("NLTK_DATA", "/root/nltk_data")

    # Flask / Web Server
    FLASK_ENV = os.getenv("FLASK_ENV", "production")
    CORS_ORIGINS_STR = os.getenv("CORS_ORIGINS", "*") # Default to allow all, adjust as needed

    @staticmethod
    def get_cors_origins():
        """Parse CORS_ORIGINS string into a list or '*'."""
        origins = Config.CORS_ORIGINS_STR
        if origins == '*' or not origins:
            return '*'
        else:
            # Split by comma and remove whitespace
            return [origin.strip() for origin in origins.split(',')]

# Make config easily importable
config = Config()

# Basic logging setup for config loading confirmation
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info(f"Configuration loaded: DB_HOST={config.DB_HOST}, OLLAMA_HOST={config.OLLAMA_HOST}")