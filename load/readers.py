# load/readers.py
import os
import logging
from typing import Optional

# Gerekli kütüphaneleri import et (requirements.txt içinde olmalı)
try:
    from PyPDF2 import PdfReader
except ImportError:
    logging.error("PyPDF2 library not found. Please install it: pip install pypdf2")
    PdfReader = None # Hata durumunda None ata

try:
    from docx import Document
except ImportError:
    logging.error("python-docx library not found. Please install it: pip install python-docx")
    Document = None # Hata durumunda None ata


# Configure basic logging for this module
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def read_pdf(file_path: str) -> Optional[str]:
    """Reads and extracts text content from a PDF file."""
    if not PdfReader: # Kütüphane yüklenememişse çalışma
        logging.error("PDF reading skipped because PyPDF2 library is missing.")
        return None
    try:
        logging.debug(f"Reading PDF: {file_path}")
        reader = PdfReader(file_path)
        # reader.pages boşsa veya text extract edilemezse hata vermemeli
        if not reader.pages:
             logging.warning(f"PDF file has no pages or is unreadable: {file_path}")
             return None

        text_content = "\n".join(
            page.extract_text() or "" # Sayfa boşsa veya text yoksa boş string döndür
            for page in reader.pages
        ).strip() # Başındaki/sonundaki boşlukları temizle

        if not text_content:
            logging.warning(f"No text could be extracted from PDF: {file_path}")
            return None
        logging.debug(f"Successfully extracted text from PDF: {file_path}")
        return text_content
    except FileNotFoundError:
        logging.error(f"PDF file not found: {file_path}")
        return None
    except Exception as e:
        # PyPDF2 bazen şifreli veya bozuk PDF'lerde hata verebilir
        logging.exception(f"Error reading PDF file '{file_path}': {e}")
        return None

def read_docx(file_path: str) -> Optional[str]:
    """Reads and extracts text content from a DOCX file."""
    if not Document: # Kütüphane yüklenememişse çalışma
        logging.error("DOCX reading skipped because python-docx library is missing.")
        return None
    try:
        logging.debug(f"Reading DOCX: {file_path}")
        doc = Document(file_path)
        text_content = "\n".join(
            p.text.strip() # Paragraf başı/sonu boşlukları temizle
            for p in doc.paragraphs
            if p.text and p.text.strip() # Sadece boş olmayan paragrafları al
        ).strip() # Tüm metnin başı/sonu boşlukları temizle

        if not text_content:
            logging.warning(f"No text could be extracted from DOCX: {file_path}")
            return None
        logging.debug(f"Successfully extracted text from DOCX: {file_path}")
        return text_content
    except FileNotFoundError:
        logging.error(f"DOCX file not found: {file_path}")
        return None
    except Exception as e:
        # python-docx kütüphanesi bozuk dosyalarda hata verebilir
        logging.exception(f"Error reading DOCX file '{file_path}': {e}")
        return None

def read_txt(file_path: str) -> Optional[str]:
    """Reads and returns the content of a TXT file."""
    try:
        logging.debug(f"Reading TXT: {file_path}")
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read().strip() # Başındaki/sonundaki boşlukları temizle
            if not content:
                logging.warning(f"TXT file is empty: {file_path}")
                return None
            logging.debug(f"Successfully read TXT file: {file_path}")
            return content
    except FileNotFoundError:
        logging.error(f"TXT file not found: {file_path}")
        return None
    except Exception as e:
        logging.exception(f"Error reading TXT file '{file_path}': {e}")
        return None

def read_file(file_path: str) -> Optional[str]:
    """Detects file type based on extension and calls the appropriate reader function."""
    if not isinstance(file_path, str) or not file_path:
         logging.error(f"Invalid file path provided: {file_path}")
         return None

    if not os.path.exists(file_path):
        logging.error(f"File does not exist: {file_path}")
        return None
    if not os.path.isfile(file_path):
         logging.error(f"Path is not a file: {file_path}")
         return None

    # Dosya uzantısını al ve küçük harfe çevir
    try:
        _, file_ext = os.path.splitext(file_path)
        file_ext = file_ext.lower()
    except Exception as e:
         logging.error(f"Could not determine file extension for {file_path}: {e}")
         return None

    logging.info(f"Attempting to read file: '{os.path.basename(file_path)}' (Extension: '{file_ext}')")

    if file_ext == '.pdf':
        return read_pdf(file_path)
    elif file_ext == '.docx':
        return read_docx(file_path)
    elif file_ext == '.txt':
        return read_txt(file_path)
    else:
        logging.warning(f"Unsupported file type skipped: '{file_path}'")
        return None