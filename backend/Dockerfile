# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ─── Stage 2: Development (for testing/lint) ──────────────────────────────────
FROM node:20-alpine AS dev-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ─── Stage 3: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 appuser

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY --chown=appuser:nodejs src/ ./src/
COPY --chown=appuser:nodejs package*.json ./

# Create logs directory
RUN mkdir -p logs && chown -R appuser:nodejs logs

# Switch to non-root user
USER appuser

# Environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Health check


CMD ["node", "src/app.js"]
