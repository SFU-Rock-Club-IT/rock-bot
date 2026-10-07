# ── Dependencies stage ────────────────────────────────────────────────────────
# Separate layer so source changes don't bust the install cache.
FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Stay on the official Bun image — native addons like @libsql/linux-x64-gnu
# are platform-specific .node binaries that cannot be embedded in a compiled
# single-file executable (bun build --compile). Running the TypeScript source
# directly with `bun` avoids this limitation entirely.
FROM oven/bun:1 AS runtime

WORKDIR /app

# Copy installed node_modules from the deps stage (keeps this layer lean)
COPY --from=deps /app/node_modules ./node_modules

# Copy source last so code edits only invalidate this one layer
COPY . .

# Run as a non-root user for safety, and ensure /data and /app are writable by botuser
RUN useradd --no-create-home --shell /bin/false botuser \
    && mkdir -p /data \
    && chown -R botuser:botuser /data /app \
    && chmod 777 /data

# Persist the local SQLite database across restarts when not using Turso cloud.
VOLUME ["/data"]

USER botuser

CMD ["bun", "src/index.ts"]
