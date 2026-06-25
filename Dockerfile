# Use Microsoft's official Playwright Python base image
# It includes Python and all Playwright browser engines pre-installed
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory in container
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose default port
EXPOSE 5000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV FLASK_RUN_HOST=0.0.0.0
ENV PORT=5000
ENV FLASK_DEBUG=False

# Run Flask application
CMD ["python", "app.py"]
