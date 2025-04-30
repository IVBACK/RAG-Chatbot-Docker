# Use slim Python image as base
FROM python:3.13-slim

# Set environment variables to avoid .pyc files and enable unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install necessary system packages for build dependencies and PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies first using requirements from project root
COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy necessary code directories from the project root
# We need 'load/' for the script itself
# We might need 'app/' if 'load/' imports config directly from 'app.config'
COPY load ./load
COPY app ./app  
# Copy app directory to allow importing app.config

# IMPORTANT: Do NOT copy .env file into the image.
# Pass configuration via environment variables in docker-compose.yml

# Set the command to run the refactored main script
# Using python -m allows Python to correctly handle the package structure
CMD ["python", "-m", "load.main"]

