FROM python:3.12-slim

# Install common utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl bash \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
WORKDIR /workspace

# Set environment
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Default to python
CMD ["python3"]
