# Use a lightweight Python base image
FROM python:3.13-slim

# Set environment variables to avoid .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies required for building and PostgreSQL support
# --- IMPROVEMENT: Add --no-install-recommends to minimize image size ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy and install Python dependencies separately for better layer caching
COPY requirements.txt ./
# --- IMPROVEMENT: Ideally, using a virtual environment would be better, but let's proceed for now ---
# --- IMPROVEMENT: Upgrade pip before installing packages ---
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code after installing dependencies
# --- FIX: Only copy necessary files instead of the entire context ---
# Copy the wsgi.py file from the project root
COPY wsgi.py .
# Copy the entire app directory
COPY app ./app
# Copy templates and static directories
# Note: If Nginx is used to serve static files, these steps may be optional or mounted via volumes
COPY templates ./templates
COPY static ./static

# Configure the gunicorn server
# -- Adjust the number of workers based on CPU (usually 2 * CPU cores + 1)
# -- Adjust the timeout based on Ollama's response time (e.g., 120 seconds)
CMD ["gunicorn", "--workers", "1", "--bind", "0.0.0.0:5000", "--timeout", "120", "wsgi:app"]
