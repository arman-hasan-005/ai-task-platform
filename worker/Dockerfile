# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM python:3.12-slim AS production

# Security: non-root user
RUN groupadd --gid 1001 worker && \
    useradd --uid 1001 --gid worker --shell /bin/bash --create-home worker

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /home/worker/.local

# Copy application
COPY --chown=worker:worker src/ ./src/

USER worker

ENV PATH="/home/worker/.local/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV LOG_LEVEL=INFO

# Health check via Python
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD python -c "import redis, os; r=redis.Redis(host=os.getenv('REDIS_HOST','localhost'),port=int(os.getenv('REDIS_PORT','6379')),password=os.getenv('REDIS_PASSWORD') or None); r.ping()" || exit 1

CMD ["python", "-u", "src/processor.py"]
