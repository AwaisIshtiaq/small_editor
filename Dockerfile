# Small Editor — multi-stage build (Next.js 16 standalone output)
# Build:  docker build -t small-editor .
# Run:    docker run -p 3000:3000 -e LIMITS_ENFORCED=true small-editor

# --- deps + build ------------------------------------------------------------
FROM oven/bun:1 AS builder
WORKDIR /app

# install first: layer cached unless package.json changes
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# --- runtime ------------------------------------------------------------------
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# LIMITS_ENFORCED is read at RUNTIME by the API routes (server-side
# process.env), so `docker run -e LIMITS_ENFORCED=true` flips Sejda-style
# limits on without a rebuild. It defaults to off (testing mode).

# non-root user; temp store lives in /tmp and dies with the container
RUN groupadd -r app && useradd -r -g app app

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

USER app
EXPOSE 3000

# container restart wipes /tmp/small-editor-store — acceptable: files are
# ephemeral by design (TTL 2h, HLD §4)
CMD ["bun", "server.js"]
