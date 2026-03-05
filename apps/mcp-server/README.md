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

**Basic Configuration:**
```bash
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  ghcr.io/mcp-fe/mcp-fe/mcp-server:main
```

**Public Access Configuration:**
```bash
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e SERVER_HOST=0.0.0.0 \
  -e ALLOWED_DOMAIN=yourdomain.com \
  ghcr.io/mcp-fe/mcp-fe/mcp-server:main
```

**Available Environment Variables:**
- `NODE_ENV` - Node.js environment (development/production)
- `PORT` - Server port (default: 3001)
- `SERVER_HOST` - Host to bind server to (default: 0.0.0.0)
  - `127.0.0.1` or `localhost` for local access only
  - `0.0.0.0` for public access (required for external connections)
- `ALLOWED_DOMAIN` - Domain name allowed for public access
  - Required for DNS rebinding protection when hosting publicly
  - Example: `api.yourcompany.com`

## Authentication

The server supports two authentication modes controlled by the `AUTH_MODE` environment variable.

### Local mode (default — demo / standalone)

The server issues and verifies its own signed JWT tokens (HS256). Clients obtain a token by calling `POST /auth/token` and include it in every subsequent request.

**When to use:** local development, demos, standalone deployments without an external identity provider.

```bash
docker run -p 3001:3001 \
  -e AUTH_MODE=local \
  -e JWT_SECRET=your-strong-random-secret \
  ghcr.io/mcp-fe/mcp-fe/mcp-server:main
```

> **Important:** Always set `JWT_SECRET` to a long, random string in any non-throwaway deployment.
> If omitted, the server falls back to an insecure development default and logs a warning.

**Token endpoint** (only available in local mode):
```
POST /auth/token
Content-Type: application/json

{ "sessionUser": "user_xyz" }

→ 200 { "token": "eyJ..." }
```

The returned token must be passed as a query parameter when connecting via WebSocket:
```
ws://your-server:3001?token=<token>
```
And as a Bearer token or `?token=` query parameter for the HTTP MCP endpoint:
```
POST http://your-server:3001/mcp?token=<token>
Authorization: Bearer <token>
```

**Environment variables for local mode:**
| Variable | Default | Description |
|---|---|---|
| `AUTH_MODE` | `local` | Auth strategy |
| `JWT_SECRET` | *(insecure dev default)* | HS256 signing secret — **always override in production** |

---

### Keycloak mode (production)

The server validates tokens issued by Keycloak using its public JWKS endpoint. No token issuance endpoint exists — clients pass their Keycloak access token directly. The `sub` claim from the Keycloak token becomes the session ID.

**When to use:** production deployments where users are already authenticated via Keycloak.

```bash
docker run -p 3001:3001 \
  -e AUTH_MODE=keycloak \
  -e KEYCLOAK_JWKS_URI=https://keycloak.example.com/realms/my-realm/protocol/openid-connect/certs \
  -e KEYCLOAK_ISSUER=https://keycloak.example.com/realms/my-realm \
  -e KEYCLOAK_AUDIENCE=my-client-id \
  ghcr.io/mcp-fe/mcp-fe/mcp-server:main
```

Clients pass their Keycloak access token directly — no extra token exchange step needed:
```
ws://your-server:3001?token=<keycloak-access-token>
```

**Environment variables for Keycloak mode:**
| Variable | Required | Description |
|---|---|---|
| `AUTH_MODE` | yes | Must be `keycloak` |
| `KEYCLOAK_JWKS_URI` | yes | JWKS endpoint of your Keycloak realm |
| `KEYCLOAK_ISSUER` | yes | Issuer URL of your Keycloak realm |
| `KEYCLOAK_AUDIENCE` | no | Expected `aud` claim (recommended) |

**Finding your Keycloak URLs:**
Open `https://<keycloak-host>/realms/<realm>/.well-known/openid-configuration` — the `jwks_uri` and `issuer` fields contain the values you need.

---

### Frontend configuration (`mcp-fe`)

When running the `mcp-fe` demo app alongside the server, set `MCP_SERVER_URL` at build time so the frontend knows where to request tokens:

```bash
# local mode — frontend calls /auth/token on the server
MCP_SERVER_URL=http://your-server:3001 npm run build

# keycloak mode — frontend sends its Keycloak token directly, no build-time variable needed
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
