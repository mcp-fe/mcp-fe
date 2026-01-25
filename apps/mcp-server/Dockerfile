# --- Builder Stage ---
# Force to use native runner platform for build (amd64)
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

# Turn off NX daemon for CI
ENV NX_DAEMON=false

WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm nx build mcp-server --configuration=production

# --- Runtime Stage ---
FROM node:20-alpine
WORKDIR /app
RUN corepack enable


# Copy built application from builder stage
COPY --from=builder /app/dist/apps/mcp-server ./

# Install only production dependencies for target platform
RUN pnpm install --prod --frozen-lockfile

ENV NODE_ENV=production
ENV PORT=3001

# Expose the port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001', (r) => {if (r.statusCode !== 404) throw new Error(r.statusCode)})"

# Start the application
CMD ["node", "main.js"]
