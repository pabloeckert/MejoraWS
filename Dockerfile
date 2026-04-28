# ============================================
# MejoraWS — Dockerfile Multi-Stage
# ============================================
# Stage 1: Build TypeScript
# Stage 2: Production runtime (minimal image)
# ============================================

# --- Stage 1: Build ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer caching)
COPY package.json package-lock.json tsconfig.json ./

# Install ALL dependencies (including devDeps for build)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript → JavaScript
RUN npm run build

# Prune devDependencies after build
RUN npm prune --production


# --- Stage 2: Production ---
FROM node:22-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S mejoraws && \
    adduser -S mejoraws -u 1001 -G mejoraws

WORKDIR /app

# Copy dependency manifests and install production only
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built JavaScript from builder
COPY --from=builder /app/dist ./dist

# Create data directories with proper permissions
RUN mkdir -p data/session data/backup && \
    chown -R mejoraws:mejoraws /app

# Switch to non-root user
USER mejoraws

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]
