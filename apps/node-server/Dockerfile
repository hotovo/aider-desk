# Multi-stage build for AiderDesk Node Server Docker image
# Python 3.12 is required for Aider connector
FROM node:24-slim AS builder

# These are set automatically by buildx - amd64, arm64
ARG TARGETARCH=amd64

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY .npmrc ./
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY turbo.json ./

# Copy package.json files for all required packages
COPY packages/common/package.json ./packages/common/
COPY packages/core/package.json ./packages/core/
COPY apps/node-server/package.json ./apps/node-server/
COPY apps/mcp-server/package.json ./apps/mcp-server/

# Install dependencies (without running postinstall scripts that need Electron)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy patches and apply them
COPY patches ./patches
RUN pnpm patch-package || true

# Copy source code for required packages only
COPY packages/common ./packages/common
COPY packages/core ./packages/core
COPY apps/node-server ./apps/node-server
COPY apps/mcp-server ./apps/mcp-server

# Copy resources needed for runtime
COPY resources/connector ./resources/connector
COPY resources/prompts ./resources/prompts

# Download required binaries (uv and probe) before building
COPY scripts/download-uv.mjs ./scripts/
COPY scripts/download-probe.mjs ./scripts/
RUN node scripts/download-uv.mjs && \
    node scripts/download-probe.mjs

# Build the packages in order
RUN pnpm --filter @aider-desk/common run build && \
    pnpm --filter @aider-desk/core run build && \
    pnpm --filter @aider-desk/node-server run build && \
    pnpm --filter @aider-desk/mcp-server run build

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

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration for production
COPY pnpm-workspace.yaml ./
COPY package.json ./

# Copy package.json files
COPY --from=builder /app/packages/common/package.json ./packages/common/
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/apps/node-server/package.json ./apps/node-server/

# Copy built packages
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/apps/node-server/dist ./apps/node-server/dist
COPY --from=builder /app/apps/mcp-server/dist ./apps/mcp-server/dist

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/common/node_modules ./packages/common/node_modules
COPY --from=builder /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=builder /app/apps/node-server/node_modules ./apps/node-server/node_modules

# Copy resources (connector, prompts, and downloaded binaries)
COPY --from=builder /app/resources ./resources

# Set environment for Python package installation
ENV AIDER_DESK_DATA_DIR=/app/data

# Create data directory and Python virtual environment
RUN mkdir -p ${AIDER_DESK_DATA_DIR} && \
    ./resources/linux-${TARGETARCH}/uv venv ${AIDER_DESK_DATA_DIR}/python-venv --python 3.12

# Install Python packages into the virtual environment
RUN ./resources/linux-${TARGETARCH}/uv pip install --upgrade --no-progress --no-cache-dir --link-mode=copy \
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
CMD ["node", "apps/node-server/dist/index.js"]
