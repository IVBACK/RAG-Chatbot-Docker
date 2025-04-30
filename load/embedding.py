# load/embedding.py
import logging
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Optional

# Import config from the main app package assuming load/ is at the same level as app/
# Adjust the import path if your structure is different.
# This requires adding the project root to PYTHONPATH or using relative imports carefully.
# For simplicity in Docker, let's assume we can import from 'app' if the WORKDIR is the project root
# and PYTHONPATH includes it, or duplicate necessary config vars.
# Simpler approach for standalone script: Re-read env vars or use a shared config mechanism.

# Let's try importing from the app config assuming PYTHONPATH is set or they run in same context
try:
    from app.config import config
except ImportError:
    # Fallback if app config cannot be imported (e.g., running script standalone)
    import os
    class TempConfig:
        EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-mpnet-base-v2")
    config = TempConfig()
    logging.warning("Could not import app.config, using fallback for EMBEDDING_MODEL_NAME.")


# Configure basic logging for this module
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Global variable to hold the loaded model
_embedding_model: Optional[SentenceTransformer] = None

def load_embedding_model() -> Optional[SentenceTransformer]:
    """Loads the SentenceTransformer model specified in config."""
    global _embedding_model
    if _embedding_model is None:
        try:
            model_name = config.EMBEDDING_MODEL_NAME
            logging.info(f"Loading embedding model: {model_name}")
            _embedding_model = SentenceTransformer(model_name)
            logging.info(f"Embedding model '{model_name}' loaded successfully.")
        except Exception as e:
            logging.exception(f"Failed to load embedding model '{config.EMBEDDING_MODEL_NAME}': {e}")
            _embedding_model = None # Ensure it's None on failure
    return _embedding_model

def generate_embeddings(text_chunks: List[str], batch_size: int = 32) -> Optional[List[np.ndarray]]:
    """Generates embeddings for a list of text chunks."""
    model = load_embedding_model()
    if model is None:
        logging.error("Cannot generate embeddings because the model failed to load.")
        return None
    if not text_chunks:
        logging.warning("No text chunks provided for embedding generation.")
        return []

    try:
        logging.info(f"Generating embeddings for {len(text_chunks)} chunks (batch size: {batch_size})...")
        # Using encode method which handles batching and progress bar internally if needed
        embeddings = model.encode(
            text_chunks,
            batch_size=batch_size,
            show_progress_bar=True, # Show progress bar in console logs
            normalize_embeddings=True # Normalize for cosine similarity
        )
        logging.info("Embeddings generated successfully.")
        # Ensure the output is a list of numpy arrays
        return [emb for emb in embeddings]
    except Exception as e:
        logging.exception(f"Error generating embeddings: {e}")
        return None