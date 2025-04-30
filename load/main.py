# load/main.py
import os
import logging
from tqdm import tqdm # Ensure tqdm is in requirements.txt
from typing import List, Tuple
import numpy as np

# Import functions from other load modules
from .readers import read_file
from .processing import split_text_chunks
from .embedding import generate_embeddings, load_embedding_model
from .database import reset_database, batch_insert_to_database, update_database_index

# Import config from the main app package
try:
    from app.config import config
except ImportError:
    # Fallback
    import os
    class TempConfig:
        DATA_DIR = os.getenv("DATA_DIR", "../data") # Adjust relative path if needed
    config = TempConfig()
    logging.warning("Could not import app.config, using fallback for DATA_DIR.")


# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def process_directory(directory_path: str) -> List[Tuple[str, np.ndarray, str]]:
    """
    Walks through the directory, reads files, chunks text, generates embeddings.

    Args:
        directory_path: The path to the root data directory.

    Returns:
        A list of tuples: (chunk_text, chunk_embedding, category_name)
    """
    all_data_to_insert = []
    processed_files = 0
    failed_files = 0

    if not directory_path or not os.path.isdir(directory_path):
        logging.error(f"Invalid or non-existent data directory provided: {directory_path}")
        return []

    # Pre-load embedding model to avoid loading it repeatedly inside the loop
    if load_embedding_model() is None:
        logging.error("Stopping processing as embedding model failed to load.")
        return []

    logging.info(f"Starting file processing in directory: {directory_path}")

    # Use os.walk to traverse the directory structure
    for root, _, files in os.walk(directory_path):
        category = os.path.basename(root) # Use subdirectory name as category
        logging.debug(f"Processing directory: {root} (Category: {category})")

        if category == os.path.basename(directory_path): # Skip the root data directory itself
             continue

        files_in_category = [f for f in files if f.lower().endswith(('.pdf', '.docx', '.txt'))]
        if not files_in_category:
            logging.debug(f"No supported files found in {root}")
            continue

        # Process files with a progress bar for the category
        logging.info(f"Found {len(files_in_category)} supported files in category '{category}'.")
        for file_name in tqdm(files_in_category, desc=f"Processing {category}", unit="file"):
            file_path = os.path.join(root, file_name)

            # 1. Read File Content
            content = read_file(file_path)
            if content is None:
                failed_files += 1
                continue # Skip if reading failed or file is unsupported

            # 2. Split into Chunks
            chunks = split_text_chunks(content, chunk_size=150, chunk_overlap=20) # Adjusted chunk size/overlap
            if not chunks:
                logging.warning(f"No valid chunks generated for file: {file_path}")
                failed_files += 1
                continue

            # 3. Generate Embeddings for Chunks
            # Consider batching embeddings per file or across multiple files for efficiency
            embeddings = generate_embeddings(chunks)
            if embeddings is None or len(embeddings) != len(chunks):
                logging.error(f"Embedding generation failed or returned incorrect number for file: {file_path}")
                failed_files += 1
                continue

            # 4. Prepare data for insertion
            for chunk, embedding in zip(chunks, embeddings):
                all_data_to_insert.append((chunk, embedding, category))

            processed_files += 1

    logging.info(f"File processing completed. Processed: {processed_files}, Failed/Skipped: {failed_files}")
    logging.info(f"Total chunks prepared for insertion: {len(all_data_to_insert)}")
    return all_data_to_insert


# Main execution block
if __name__ == "__main__":
    logging.info("--- Starting Data Loading Process ---")

    # 1. Reset Database (optional, be careful!)
    # logging.warning("RESETTING DATABASE is enabled!") # Uncomment to actually reset
    if not reset_database():
         logging.error("Database reset failed. Aborting.")
         exit(1) # Exit if reset fails
    # logging.info("Skipping database reset.") # Comment out reset call if not needed


    # 2. Process files and generate data
    data_to_insert = process_directory(config.DATA_DIR)

    # 3. Insert data into database
    if data_to_insert:
        if not batch_insert_to_database(data_to_insert):
            logging.error("Batch data insertion failed. Aborting.")
            exit(1) # Exit if insert fails
    else:
        logging.warning("No data was generated from the files to insert into the database.")

    # 4. Update database index
    if not update_database_index():
         logging.error("Database index update failed.")
         # Don't necessarily exit here, insertion might still be useful without index
    else:
         logging.info("Database index updated successfully.")


    logging.info("--- Data Loading Process Finished ---")