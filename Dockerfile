# =============================================================================
# CORTEX CLI — Docker image
# =============================================================================
# Multi-stage build: Node + Python + all 20 MCPs in one portable container.
# Usage:
#   docker build -t cortex .
#   docker run -it --rm -e HF_TOKEN=your_token cortex "hello world"
# =============================================================================

FROM node:20-slim AS builder

WORKDIR /app

# System deps for Python + MCP runners
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    git curl ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install bun (faster than npm) and pnpm (for Octogent)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"
RUN npm install -g pnpm

# Copy package files first for better Docker layer caching
COPY package.json bun.lock* package-lock.json* ./
RUN bun install --frozen-lockfile 2>/dev/null || npm install --silent

# Copy source
COPY . .

# Build the CLI
RUN npm run build

# Build Octogent
RUN cd apps/octogent && pnpm install && pnpm build

# =============================================================================
# Runtime image (smaller)
# =============================================================================
FROM node:20-slim

WORKDIR /app

# Runtime deps only
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create venv and install Python deps + uv/uvx
RUN python3 -m venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"
ENV VIRTUAL_ENV="/app/.venv"

COPY python/requirements.txt /tmp/requirements.txt
RUN /app/.venv/bin/pip install --quiet --upgrade pip \
 && /app/.venv/bin/pip install --quiet -r /tmp/requirements.txt uv

# Copy built artifacts from builder stage
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/bin /app/bin
COPY --from=builder /app/python /app/python
COPY --from=builder /app/cortex.mjs /app/cortex.mjs
COPY --from=builder /app/.mcp.json /app/.mcp.json
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/CORTEX.md /app/CORTEX.md
COPY --from=builder /app/src /app/src
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/octogent /app/apps/octogent

# Make binaries executable
RUN chmod +x /app/cortex.mjs /app/bin/* 2>/dev/null || true

# Default: friendly shell into the CLI
ENTRYPOINT ["node", "/app/cortex.mjs"]
CMD ["--help"]
