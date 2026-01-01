FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt webapp/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r webapp/requirements.txt

# Copy application code
COPY . .

# Create directory for temp files
RUN mkdir -p /tmp/sharp && chmod 777 /tmp/sharp

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Run application
WORKDIR /app
CMD ["uvicorn", "webapp.app:app", "--host", "0.0.0.0", "--port", "8000"]

