# Debian-based (not Alpine): onnxruntime-node, which powers the local embeddings,
# ships glibc binaries and does not run on Alpine's musl libc.

# ---- deps ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# transformers.js is kept external from the bundle (native ONNX) — ship it explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@xenova ./node_modules/@xenova
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/onnxruntime-node ./node_modules/onnxruntime-node
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/onnxruntime-common ./node_modules/onnxruntime-common

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
