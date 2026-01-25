# Multi-stage build for MCP Server
# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY nx.json ./

# Copy app files
COPY apps/mcp-server ./apps/mcp-server
COPY libs ./libs

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
RUN pnpm nx build mcp-server --configuration=production

# Stage 2: Runtime stage
FROM --platform=$TARGETPLATFORM node:20-alpine

WORKDIR /app

# Enable corepack
RUN corepack enable

# Copy entire dist directory with node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/apps/mcp-server ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose the port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001', (r) => {if (r.statusCode !== 404) throw new Error(r.statusCode)})"

# Start the application
CMD ["node", "main.js"]
