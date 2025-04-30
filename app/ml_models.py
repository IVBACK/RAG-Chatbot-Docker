# app/ml_models.py
import os
import logging
import string
import threading
from collections import Counter
import numpy as np
from typing import Optional, List, Dict, Tuple, Set

# Import necessary libraries (ensure they are in requirements.txt)
import nltk
from nltk.corpus import stopwords
from sentence_transformers import SentenceTransformer
from transformers import pipeline, logging as hf_logging

from .config import config # Import config from the app package

# Suppress verbose warnings from transformers if desired
hf_logging.set_verbosity_warning()
# Or set to error: hf_logging.set_verbosity_error()

# --- Global State for Models ---
models_loaded_flag = False
model_loading_lock = threading.Lock()

# Model variables
embedding_model: Optional[SentenceTransformer] = None
classifier = None # Type hint pending actual pipeline object
stopword_set: set[str] = set()

# Category related data
categories: list[str] = []
category_keywords: dict[str, list[str]] = {}
category_examples: dict[str, str] = {}
category_embeddings: dict[str, np.ndarray] = {}
# --- End Global State ---


def _load_nltk_data():
    """Loads or downloads NLTK stopwords."""
    global stopword_set
    try:
        nltk.data.path.append(config.NLTK_DATA_PATH) # Add custom path if needed
        logging.info(f"Checking NLTK stopwords for language: '{config.STOPWORDS_LNG}' in path: {nltk.data.path}")
        stopword_set = set(stopwords.words(config.STOPWORDS_LNG))
        logging.info(f"NLTK stopwords for '{config.STOPWORDS_LNG}' loaded.")
    except LookupError:
        logging.warning(f"NLTK stopwords for '{config.STOPWORDS_LNG}' not found. Attempting download...")
        try:
            # Specify download directory if using a persistent volume
            nltk.download('stopwords', download_dir=config.NLTK_DATA_PATH)
            # Need to reload after download
            stopword_set = set(stopwords.words(config.STOPWORDS_LNG))
            logging.info(f"NLTK stopwords for '{config.STOPWORDS_LNG}' downloaded and loaded.")
        except Exception as download_err:
            logging.exception(f"Failed to download NLTK stopwords: {download_err}")
            stopword_set = set() # Use empty set on failure


def _extract_keywords_for_category(category_name: str, data_dir: str, top_k: int = 10) -> list[str]:
    """Extracts top keywords from .txt files in a category subdirectory."""
    words = []
    category_path = os.path.join(data_dir, category_name)
    if not os.path.isdir(category_path):
        logging.warning(f"Keyword extraction: Directory not found for category '{category_name}' at {category_path}")
        return []

    logging.debug(f"Extracting keywords for '{category_name}' from {category_path}")
    for filename in os.listdir(category_path):
        if filename.lower().endswith(".txt"):
            file_path = os.path.join(category_path, filename)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read().lower()
                    # Remove punctuation
                    content = content.translate(str.maketrans('', '', string.punctuation))
                    tokens = content.split()
                    # Filter stopwords and short words
                    words.extend(tok for tok in tokens if tok not in stopword_set and len(tok) > 2)
            except Exception as e:
                logging.error(f"Error reading keyword file '{file_path}': {e}")

    if not words:
        logging.warning(f"No valid keywords found for category '{category_name}'.")
        return []

    keyword_counts = Counter(words)
    most_common_keywords = [word for word, count in keyword_counts.most_common(top_k)]
    logging.debug(f"Keywords for '{category_name}': {most_common_keywords}")
    return most_common_keywords


def _load_categories_and_keywords():
    """Loads category names and extracts keywords from the data directory."""
    global categories, category_keywords, category_examples
    if not config.DATA_DIR or not os.path.isdir(config.DATA_DIR):
        logging.error(f"Cannot load categories: DATA_DIR '{config.DATA_DIR}' is not a valid directory.")
        categories = []
        category_keywords = {}
        category_examples = {}
        return

    try:
        categories = [d for d in os.listdir(config.DATA_DIR) if os.path.isdir(os.path.join(config.DATA_DIR, d))]
        logging.info(f"Found categories: {categories}")

        category_examples = {cat: f"Content related to {cat}" for cat in categories}

        category_keywords = {
            cat: _extract_keywords_for_category(cat, config.DATA_DIR) for cat in categories
        }
        logging.info("Category keywords extracted.")

    except Exception as e:
        logging.exception(f"Error loading categories or keywords from {config.DATA_DIR}: {e}")
        categories = []
        category_keywords = {}
        category_examples = {}


def initialize_models():
    """Loads all ML models and necessary data. Sets the global ready flag."""
    global models_loaded_flag, embedding_model, classifier, category_embeddings
    # Use a lock to prevent multiple threads/workers trying to load simultaneously
    with model_loading_lock:
        if models_loaded_flag:
            logging.info("Models already loaded.")
            return

        logging.info("Starting model and data initialization...")
        try:
            # 1. Load NLTK data
            _load_nltk_data()

            # 2. Load Categories and Keywords (needs stopwords)
            _load_categories_and_keywords()

            # 3. Load Embedding Model
            logging.info(f"Loading embedding model: {config.EMBEDDING_MODEL_NAME}")
            # Consider adding trust_remote_code=True if required by the model
            embedding_model = SentenceTransformer(config.EMBEDDING_MODEL_NAME)
            logging.info("Embedding model loaded.")

            # 4. Load Classifier Model
            logging.info(f"Loading classifier model: {config.CLASSIFIER_MODEL_NAME}")
            # Device can be specified e.g., device=0 for GPU 0, or -1 for CPU (default)
            classifier = pipeline(
                "zero-shot-classification",
                model=config.CLASSIFIER_MODEL_NAME
                # device=0 # Uncomment for GPU
            )
            logging.info(f"Classifier model loaded. Device: {classifier.device}")

            # 5. Calculate Category Embeddings (requires embedding_model and category_examples)
            if embedding_model and category_examples:
                logging.info("Calculating category embeddings...")
                # Ensure category_examples is populated before this step
                category_embeddings = {
                    category: embedding_model.encode(description, normalize_embeddings=True)
                    for category, description in category_examples.items()
                    if description # Ensure description is not empty
                }
                logging.info(f"Calculated {len(category_embeddings)} category embeddings.")
            else:
                 logging.warning("Skipping category embeddings calculation (model or examples missing).")


            # 6. Set Ready Flag
            models_loaded_flag = True
            logging.info("--- Initialization Complete: Models and data are ready. ---")

        except Exception as e:
            logging.exception("--- CRITICAL ERROR during model initialization: ---")
            # Ensure flag remains false on error
            models_loaded_flag = False


def are_models_ready() -> bool:
    """Checks if the models have been successfully loaded."""
    return models_loaded_flag

# --- Functions to access models (optional, provides controlled access) ---

def get_embedding_model() -> Optional[SentenceTransformer]:
    """Returns the loaded embedding model."""
    if not models_loaded_flag:
        logging.warning("Attempted to get embedding model before it was loaded.")
    return embedding_model

def get_classifier():
    """Returns the loaded classifier pipeline."""
    if not models_loaded_flag:
        logging.warning("Attempted to get classifier before it was loaded.")
    return classifier

def get_category_data() -> tuple[list[str], dict[str, np.ndarray], dict[str, list[str]]]:
     """Returns categories, their embeddings, and keywords."""
     if not models_loaded_flag:
         logging.warning("Attempted to get category data before models were loaded.")
         return [], {}, {}
     return categories, category_embeddings, category_keywords

# --- End Model Management ---

# Optional: Start initialization in a background thread when the module is imported.
# Be cautious with this in multi-process environments like Gunicorn without --preload.
# initialize_thread = threading.Thread(target=initialize_models, daemon=True)
# initialize_thread.start()
# logging.info("Model initialization thread started.")