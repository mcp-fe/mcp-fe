# @mcp-fe/mcp-server

MCP server proxy implementation for frontend applications.

## Docker Image

Public Docker image is available on GitHub Container Registry:

```bash
ghcr.io/mcp-fe/mcp-fe/mcp-server:main
```

### Pull and run

```bash
# Pull image
docker pull ghcr.io/mcp-fe/mcp-fe/mcp-server:main

# Run server
docker run -p 3001:3001 ghcr.io/mcp-fe/mcp-fe/mcp-server:main

# Server runs on http://localhost:3001
```

### Available tags

- `main` - latest version from main branch
- `sha-abc1234` - specific commit
- `latest` - latest build
- `v1.0.0` - semantic version (if git tag exists)

Docker automatically selects the appropriate image for your system's architecture.

### Environment variables

```bash
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  ghcr.io/mcp-fe/mcp-fe/mcp-server:main
```

## Development

```bash
# Install dependencies
pnpm install

# Run
nx run mpc-server:serve
```

## CI/CD

Automatic Docker image build and publishing is configured in GitHub Actions.

Push to `main` or `develop` → Image is automatically built and published to `ghcr.io`.

Details in `.github/workflows/docker-publish.yml`.
