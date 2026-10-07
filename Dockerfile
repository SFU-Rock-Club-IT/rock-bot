# ── Build stage ───────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source and compile to a self-contained binary
COPY . .
RUN bun build src/index.ts --compile --outfile bot

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

WORKDIR /app

# The compiled binary is fully self-contained — no Bun/Node runtime needed.
COPY --from=builder /app/bot ./bot

# Volume for the local SQLite database (used when TURSO_DATABASE_URL is unset).
# Mount this to persist data between container restarts:
#   docker run -v ./data:/data ...
RUN mkdir -p /data
VOLUME ["/data"]

# Make the binary executable
RUN chmod +x ./bot

# Run as a non-root user for safety
RUN useradd --no-create-home --shell /bin/false botuser
USER botuser

CMD ["./bot"]
