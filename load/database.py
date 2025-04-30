# load/database.py
import logging
import psycopg2
from psycopg2.extras import execute_values
from typing import List, Optional, Tuple
import numpy as np

# Import config from the main app package
try:
    from app.config import config
except ImportError:
    # Fallback
    import os
    class TempConfig:
        DB_HOST = os.getenv("DB_HOST", "rag-db")
        DB_NAME = os.getenv("DB_NAME")
        DB_USER = os.getenv("DB_USER")
        DB_PASSWORD = os.getenv("DB_PASSWORD")
    config = TempConfig()
    logging.warning("Could not import app.config, using fallback for DB credentials.")

# Configure basic logging for this module
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def _get_db_connection():
    """Establishes and returns a database connection."""
    conn = None
    try:
        logging.debug(f"Connecting to DB: Host={config.DB_HOST}, DB={config.DB_NAME}")
        conn = psycopg2.connect(
            host=config.DB_HOST,
            database=config.DB_NAME,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            connect_timeout=10 # Add a connection timeout
        )
        logging.debug("DB connection successful.")
        return conn
    except psycopg2.OperationalError as e:
        logging.error(f"Database connection failed: {e}")
        return None
    except Exception as e:
        logging.exception(f"An unexpected error occurred while connecting to the database: {e}")
        return None


def reset_database():
    """Truncates the data table and resets its identity sequence."""
    conn = _get_db_connection()
    if not conn:
        logging.error("Cannot reset database: No connection.")
        return False
    try:
        with conn.cursor() as cur:
            logging.warning("Resetting database: TRUNCATING 'data' table...")
            # Ensure vector extension exists - might be better in init_database.sql though
            # cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            # Alter column type - This should generally be done once during setup
            # logging.debug("Ensuring embedding column type is vector(768)...")
            # cur.execute("ALTER TABLE data ALTER COLUMN embedding TYPE vector(768);")
            cur.execute("TRUNCATE TABLE data RESTART IDENTITY;")
            conn.commit()
            logging.info("Database table 'data' has been reset successfully.")
            return True
    except Exception as e:
        logging.exception(f"Database reset failed: {e}")
        conn.rollback() # Rollback any partial changes
        return False
    finally:
        if conn:
            conn.close()
            logging.debug("DB connection closed after reset.")


def batch_insert_to_database(data_to_insert: List[Tuple[str, np.ndarray, str]]):
    """
    Inserts a batch of content, embeddings, and categories into the database.

    Args:
        data_to_insert: A list of tuples, where each tuple is
                        (content: str, embedding: np.ndarray, category: str).
    """
    if not data_to_insert:
        logging.warning("No data provided for batch insert.")
        return False

    conn = _get_db_connection()
    if not conn:
        logging.error("Cannot insert data: No database connection.")
        return False

    inserted_count = 0
    try:
        with conn.cursor() as cur:
            insert_query = "INSERT INTO data (content, embedding, category) VALUES %s"
            # Convert numpy arrays to lists for psycopg2
            values = [
                (content, embedding.tolist(), category)
                for content, embedding, category in data_to_insert
            ]
            logging.info(f"Attempting to insert {len(values)} records...")
            execute_values(cur, insert_query, values, page_size=100) # Use page_size for large batches
            inserted_count = cur.rowcount # Might not be accurate for execute_values depending on version/setup
            if inserted_count <= 0: inserted_count=len(values) # Assume all inserted if no error
            conn.commit()
            logging.info(f"Successfully inserted {inserted_count} records into the database.")
            return True
    except Exception as e:
        logging.exception(f"Database batch insert failed: {e}")
        conn.rollback()
        return False
    finally:
        if conn:
            conn.close()
            logging.debug("DB connection closed after batch insert.")


def update_database_index():
    """Drops and recreates the IVFFlat index on the embedding column."""
    conn = _get_db_connection()
    if not conn:
        logging.error("Cannot update index: No database connection.")
        return False
    try:
        with conn.cursor() as cur:
            logging.info("Updating database index (dropping and recreating IVFFlat)...")
            cur.execute("DROP INDEX IF EXISTS data_embedding_idx;")
            # Adjust parameters (e.g., lists) based on your data size and pgvector version
            # Example: CREATE INDEX ON data USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
            cur.execute("CREATE INDEX data_embedding_idx ON data USING ivfflat (embedding vector_cosine_ops);")
            logging.info("Index created. Analyzing table...")
            cur.execute("ANALYZE data;") # Important for query planner performance
            conn.commit()
            logging.info("Database index updated and table analyzed successfully.")
            return True
    except Exception as e:
        logging.exception(f"Database index update failed: {e}")
        conn.rollback()
        return False
    finally:
        if conn:
            conn.close()
            logging.debug("DB connection closed after index update.")