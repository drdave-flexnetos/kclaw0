FROM rust:1.78-slim

# Install common utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl bash build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
WORKDIR /workspace

# Pre-install cargo-watch and cargo-edit for dev convenience
RUN cargo install cargo-watch cargo-edit 2>/dev/null || true

# Default to cargo
CMD ["cargo"]
