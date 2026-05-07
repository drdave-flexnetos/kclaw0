FROM node:20-alpine

# Install common utilities
RUN apk add --no-cache git curl bash

# Create workspace directory
WORKDIR /workspace

# Set environment
ENV NODE_ENV=production
ENV PATH=/workspace/node_modules/.bin:$PATH

# Default to shell
CMD ["node"]
