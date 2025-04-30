# app/rag_core.py
import logging
import numpy as np
import psycopg2
from psycopg2.extras import execute_values # Ensure psycopg2 is in requirements

# Import from other app modules
from .ml_models import (
    get_embedding_model,
    get_classifier,
    get_category_data,
    are_models_ready,
)
from .utils import cosine_similarity, keyword_match_score
from .config import config


def select_categories(query: str) -> list[str]:
    """
    Selects relevant categories for a given query using a hybrid approach.
    Returns a list of category names.
    """
    if not are_models_ready():
        logging.error("Cannot select categories: Models are not ready.")
        return []

    embedding_model = get_embedding_model()
    classifier = get_classifier()
    categories, category_embeddings, category_keywords = get_category_data()

    if not embedding_model or not classifier or not categories:
        logging.error("Cannot select categories: Missing models or category data.")
        return []

    try:
        logging.debug(f"Selecting categories for query: '{query[:50]}...'")
        query_vec = embedding_model.encode(query, normalize_embeddings=True)

        # Zero-shot classification
        logging.debug("Performing zero-shot classification...")
        zero_shot_results = classifier(query, categories, multi_label=True)
        zero_shot_score_map = {
            label: score
            for label, score in zip(zero_shot_results["labels"], zero_shot_results["scores"])
        }
        logging.debug(f"Zero-shot scores: {zero_shot_score_map}")

        # Calculate hybrid scores
        scores = {}
        for category_name in categories:
            cat_vec = category_embeddings.get(category_name)
            keywords = category_keywords.get(category_name, [])

            if cat_vec is None:
                logging.warning(f"No embedding found for category: {category_name}")
                continue

            cosine_score = cosine_similarity(query_vec, cat_vec)
            keyword_score = keyword_match_score(query, keywords)
            zero_score = zero_shot_score_map.get(category_name, 0.0)

            # Adjust weights as needed
            final_score = (
                0.4 * cosine_score +
                0.3 * keyword_score +
                0.3 * zero_score
            )
            scores[category_name] = final_score

        logging.debug(f"Hybrid scores: {scores}")

        if not scores:
            logging.warning("No categories scored.")
            return []

        # Selection logic (adjust thresholds and logic as needed)
        max_score = max(scores.values())
        score_threshold = 0.1  # Minimum score to be considered
        proximity_threshold = 0.05 # How close to max_score to be included

        selected_categories = [
            cat for cat, score in scores.items()
            if score >= score_threshold and score >= max_score - proximity_threshold
        ]

        # Fallback: if nothing selected, take the best one if it meets the threshold
        if not selected_categories:
            best_category = max(scores, key=scores.get)
            if scores[best_category] >= score_threshold:
                selected_categories = [best_category]
                logging.debug(f"No categories met proximity threshold, falling back to best: {best_category}")
            else:
                 logging.warning(f"No categories met score threshold. Best score ({scores[best_category]:.3f}) for '{best_category}' was below {score_threshold}")


        logging.info(f"Selected categories: {selected_categories}")
        return selected_categories

    except Exception as e:
        logging.exception(f"Error during category selection for query '{query[:50]}...': {e}")
        return []


def retrieve_context(query: str) -> list[str]:
    """
    Retrieves relevant text chunks from the database based on the query
    after selecting categories.
    """
    if not are_models_ready():
        logging.error("Cannot retrieve context: Models are not ready.")
        return []

    embedding_model = get_embedding_model()
    if not embedding_model:
        logging.error("Cannot retrieve context: Embedding model not available.")
        return []

    selected_categories = select_categories(query)
    if not selected_categories:
        logging.warning(f"No categories selected for query '{query[:50]}...', cannot retrieve context.")
        return []

    conn = None
    cur = None
    retrieved_chunks = []
    fetch_limit_per_category = 5 # Max chunks per category

    try:
        query_embedding = embedding_model.encode(query, normalize_embeddings=True)
        query_embedding_list = query_embedding.tolist() # For psycopg2

        logging.debug(f"Connecting to DB: Host={config.DB_HOST}, DB={config.DB_NAME}")
        conn = psycopg2.connect(
            host=config.DB_HOST,
            database=config.DB_NAME,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            connect_timeout=10 # Add a connection timeout
        )
        cur = conn.cursor()
        logging.debug("DB connection successful.")

        for category in selected_categories:
            logging.debug(f"Querying DB for category '{category}'...")
            cur.execute(
                """
                SELECT content
                FROM data
                WHERE category = %s
                ORDER BY embedding <#> %s::vector
                LIMIT %s
                """,
                (category, query_embedding_list, fetch_limit_per_category)
            )
            results = cur.fetchall()
            category_chunks = [row[0] for row in results]
            retrieved_chunks.extend(category_chunks)
            logging.debug(f"Retrieved {len(category_chunks)} chunks for category '{category}'.")

        logging.info(f"Total retrieved chunks from DB: {len(retrieved_chunks)}")
        return retrieved_chunks

    except psycopg2.Error as db_err:
        logging.exception(f"Database error during context retrieval: {db_err}")
        return [] # Return empty list on DB error
    except Exception as e:
        logging.exception(f"General error during context retrieval: {e}")
        return [] # Return empty list on other errors
    finally:
        # Ensure database connection is closed
        if cur:
            try:
                cur.close()
            except Exception as e:
                 logging.error(f"Error closing cursor: {e}")
        if conn:
            try:
                conn.close()
                logging.debug("DB connection closed.")
            except Exception as e:
                 logging.error(f"Error closing connection: {e}")