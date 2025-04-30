# load/processing.py
import logging
from typing import List

# Configure basic logging for this module
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def split_text_chunks(text: str, chunk_size: int = 100, chunk_overlap: int = 10) -> List[str]:
    """
    Splits a block of text into smaller chunks with optional overlap.

    Args:
        text: The input text string.
        chunk_size: The desired number of words per chunk.
        chunk_overlap: The number of words to overlap between consecutive chunks.

    Returns:
        A list of text chunks.
    """
    if not text or not isinstance(text, str):
        logging.warning("split_text_chunks received invalid text input.")
        return []

    words = text.split()
    if not words:
        return []

    chunks = []
    start_index = 0
    min_chunk_char_length = 20 # Minimum character length for a chunk to be considered valid

    while start_index < len(words):
        end_index = start_index + chunk_size
        chunk_words = words[start_index:end_index]
        chunk_text = ' '.join(chunk_words).strip()

        # Add chunk only if it's reasonably long
        if len(chunk_text) >= min_chunk_char_length:
            chunks.append(chunk_text)

        # Move start_index for the next chunk, considering overlap
        # Ensure overlap doesn't exceed chunk size
        step = chunk_size - min(chunk_overlap, chunk_size -1)
        if step <= 0: # Avoid infinite loop if overlap >= chunk_size
            step = max(1, chunk_size // 2)
        start_index += step


    # Filter out any potentially empty strings again just in case
    valid_chunks = [chunk for chunk in chunks if chunk]
    logging.info(f"Split text into {len(valid_chunks)} chunks (chunk_size={chunk_size}, overlap={chunk_overlap}).")
    return valid_chunks