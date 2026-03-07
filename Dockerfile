# Multi-stage build for AiderDesk Docker image
# Python 3.12 is required for Aider connector
FROM node:24-slim AS builder

# These are set automatically by buildx - amd64, arm64
ARG TARGETARCH=amd64

# Install Python and build tools for native module compilation (node-pty)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Run patch-package for any patches
RUN npx patch-package

# TEMPORARY: Remove postinstall script before moving to monorepo
# TODO: Remove this after migrating to monorepo structure
RUN node -e "const pkg = require('./package.json'); delete pkg.scripts.postinstall; require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2))"

# Download required binaries (uv and probe) before building
RUN node scripts/download-uv.mjs && \
    node scripts/download-probe.mjs

# Build the server and MCP server (includes resources copy) - prebuild:server builds renderer
RUN npm run build:server

# Production stage
FROM node:24-slim

ARG TARGETARCH=amd64

# Install Python 3.12 and build tools using deadsnakes PPA
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    gnupg \
    curl \
    build-essential \
    python3-dev \
    git \
    procps \
    && mkdir -p /etc/apt/keyrings \
    && curl -sSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0xF23C5A6CF475977595C89F51BA6932366A755776" | gpg --dearmor -o /etc/apt/keyrings/deadsnakes.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/deadsnakes.gpg] http://ppa.launchpad.net/deadsnakes/ppa/ubuntu jammy main" > /etc/apt/sources.list.d/deadsnakes.list \
    && echo "deb-src [signed-by=/etc/apt/keyrings/deadsnakes.gpg] http://ppa.launchpad.net/deadsnakes/ppa/ubuntu jammy main" >> /etc/apt/sources.list.d/deadsnakes.list \
    && apt-get update && \
    apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    python3.12-dev \
    make \
    && apt-get purge -y --auto-remove gnupg curl && rm -rf /var/lib/apt/lists/*

# Set Python 3.12 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1 \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy production dependencies from builder (includes rebuilt native modules)
COPY --from=builder /app/node_modules ./node_modules

# Copy built server, renderer and resources from builder (includes downloaded binaries)
COPY --from=builder /app/out/server ./out/server
COPY --from=builder /app/out/renderer ./out/renderer
COPY --from=builder /app/out/resources ./out/resources
COPY --from=builder /app/out/mcp-server ./out/resources/mcp-server

# Set environment for Python package installation
ENV AIDER_DESK_DATA_DIR=/app/data

# Create data directory and Python virtual environment
RUN mkdir -p ${AIDER_DESK_DATA_DIR} && \
    ./out/resources/linux/uv venv ${AIDER_DESK_DATA_DIR}/python-venv --python 3.12

# Install Python packages into the virtual environment
RUN ./out/resources/linux/uv pip install --upgrade --no-progress --no-cache-dir --link-mode=copy \
        --python ${AIDER_DESK_DATA_DIR}/python-venv/bin/python \
        pip \
        aider-chat \
        python-socketio==5.12.1 \
        websocket-client==1.8.0 \
        nest-asyncio==1.6.0 \
        boto3==1.38.25 \
        opentelemetry-api==1.35.0 \
        opentelemetry-sdk==1.35.0 \
        portalocker==3.2.0

RUN touch ${AIDER_DESK_DATA_DIR}/setup-complete

# Set environment variables
ENV NODE_ENV=production
ENV AIDER_DESK_HEADLESS=true

# Configure Git to allow access to all directories (fixes Docker volume ownership issue)
RUN git config --global --add safe.directory "*"

# Optional: Set default port (can be overridden at runtime)
ENV AIDER_DESK_PORT=24337

# Optional: Set default auth (can be overridden at runtime)
# ENV AIDER_DESK_USERNAME=
# ENV AIDER_DESK_PASSWORD=

# Create data directory for persistent storage
VOLUME ["/app/data"]

# Expose the server port
EXPOSE ${AIDER_DESK_PORT}

# Health check - check if server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD node -e "require('http').get('http://localhost:${AIDER_DESK_PORT}/', (r) => {process.exit(r.statusCode === 200 || r.statusCode === 404 ? 0 : 1)}).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "out/server/runner.js"]
