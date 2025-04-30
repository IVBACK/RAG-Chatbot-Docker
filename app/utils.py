# app/utils.py
import re
import numpy as np
import logging
from typing import Any, Dict, Union, Optional


def cosine_similarity(vec_a: Optional[np.ndarray], vec_b: Optional[np.ndarray]) -> float:
    """Calculates cosine similarity between two numpy vectors."""
    if vec_a is None or vec_b is None:
        logging.warning("Cosine similarity input vector is None.")
        return 0.0
    if vec_a.shape != vec_b.shape:
         logging.warning(f"Cosine similarity input vectors have different shapes: {vec_a.shape} vs {vec_b.shape}")
         return 0.0
    if not np.all(np.isfinite(vec_a)) or not np.all(np.isfinite(vec_b)):
        logging.warning("Cosine similarity input vector contains NaN or infinite values.")
        return 0.0

    # Assuming vectors are already normalized (as done by SentenceTransformer with normalize_embeddings=True)
    dot_product = np.dot(vec_a, vec_b)

    # Handle potential floating point inaccuracies close to 1 or -1
    dot_product = np.clip(dot_product, -1.0, 1.0)

    # Check for very small values to avoid precision issues if needed,
    # but for normalized vectors, dot product is directly the cosine similarity.
    if np.abs(dot_product) < 1e-9:
        return 0.0

    return float(dot_product)


def keyword_match_score(query: str, keywords: list[str]) -> float:
    """Calculates a simple keyword match score."""
    if not keywords:
        return 0.0
    query_lower = query.lower()
    score = sum(1 for keyword in keywords if keyword.lower() in query_lower)
    return score / len(keywords)


def extract_message_content(response: Union[Dict[str, Any], object]) -> str:
    """Extracts the message content from Ollama response, handling potential structures."""
    try:
        content = ""
        if isinstance(response, dict) and 'message' in response and isinstance(response['message'], dict):
            content = response['message'].get('content', '')
        elif hasattr(response, 'message') and hasattr(response.message, 'content'):
            # Handle potential None value for response.message
            if response.message:
                content = response.message.content or ""
            else:
                content = ""
        else:
            logging.warning(f"Unexpected Ollama response structure: {type(response)}")
            return "Error processing Ollama response structure."

        if not isinstance(content, str):
             logging.warning(f"Ollama content is not a string: {type(content)}")
             content = str(content) # Attempt to convert to string

        # Remove <think> tags (case-insensitive)
        content = re.sub(r"<think>.*?</think>\s*\n*", "", content, flags=re.IGNORECASE | re.DOTALL)
        return content.strip()

    except Exception as e:
        logging.exception(f"Error extracting message content: {e}")
        return "Error processing Ollama response."