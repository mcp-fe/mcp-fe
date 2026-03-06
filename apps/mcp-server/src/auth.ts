/**
 * JWT auth module – supports three modes controlled by AUTH_MODE env variable:
 *
 *  demo     – Any non-empty string token is accepted as-is and used directly as the session ID.
 *             Intended for public demo deployments. No JWT signing or verification.
 *             Users pass their token via ?token= query param in the MCP server URL.
 *
 *  local    – Server signs tokens with HS256 (JWT_SECRET). Use /auth/token to obtain a token.
 *             Suitable for standalone deployments.
 *
 *  keycloak – Server validates tokens issued by Keycloak via JWKS (RS256/ES256).
 *             Clients send their Keycloak access token directly – no /auth/token endpoint needed.
 *             Required env vars: KEYCLOAK_JWKS_URI, KEYCLOAK_ISSUER, KEYCLOAK_AUDIENCE (optional)
 */
import { jwtVerify, SignJWT, createRemoteJWKSet } from 'jose';

export const AUTH_MODE = (process.env.AUTH_MODE || 'local') as 'demo' | 'local' | 'keycloak';

// ── Local mode ────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'mcp-mock-secret-key-do-not-use-in-production';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// ── Keycloak mode ─────────────────────────────────────────────────────────────
const KEYCLOAK_JWKS_URI = process.env.KEYCLOAK_JWKS_URI;
const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER;
const KEYCLOAK_AUDIENCE = process.env.KEYCLOAK_AUDIENCE;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

if (AUTH_MODE === 'demo') {
  console.warn('[Auth] Mode: demo | Any non-empty token is accepted as session ID. DO NOT use in production!');
} else if (AUTH_MODE === 'keycloak') {
  if (!KEYCLOAK_JWKS_URI) throw new Error('[Auth] KEYCLOAK_JWKS_URI is required when AUTH_MODE=keycloak');
  if (!KEYCLOAK_ISSUER) throw new Error('[Auth] KEYCLOAK_ISSUER is required when AUTH_MODE=keycloak');
  jwks = createRemoteJWKSet(new URL(KEYCLOAK_JWKS_URI));
  console.log(`[Auth] Mode: keycloak | JWKS: ${KEYCLOAK_JWKS_URI} | Issuer: ${KEYCLOAK_ISSUER}`);
} else {
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Auth] JWT_SECRET must be set in production');
    }
    console.warn('[Auth] Mode: local | JWT_SECRET not set — using insecure default. DO NOT use in production!');
  } else {
    console.log('[Auth] Mode: local');
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Verifies a token and returns the sessionId, or null if invalid.
 *
 * demo mode:     any non-empty string is accepted as-is.
 * local mode:    validates HS256 JWT, returns sub claim.
 * keycloak mode: validates RS256/ES256 JWT via JWKS, returns sub claim.
 */
export async function verifyToken(token?: string | string[] | null): Promise<string | null> {
  if (!token) return null;
  try {
    const tokenStr = Array.isArray(token) ? token[0] : token.toString();

    if (AUTH_MODE === 'demo') {
      if (tokenStr.length < 8) {
        console.warn('[Auth] Demo token rejected: too short');
        return null;
      }
      console.log(`[Auth] Demo session accepted for token: ${tokenStr}`);
      return tokenStr;
    }

    let sub: unknown;

    if (AUTH_MODE === 'keycloak') {
      if (!jwks) {
        console.error('[Auth] JWKS not initialized');
        return null;
      }
      const { payload } = await jwtVerify(tokenStr, jwks, {
        issuer: KEYCLOAK_ISSUER,
        ...(KEYCLOAK_AUDIENCE ? { audience: KEYCLOAK_AUDIENCE } : {}),
      });
      sub = payload.sub;
    } else {
      const { payload } = await jwtVerify(tokenStr, SECRET_KEY, {
        algorithms: ['HS256'],
      });
      sub = payload.sub;
    }

    if (typeof sub === 'string') {
      console.log(`[Auth] Session verified for user: ${sub}`);
      return sub;
    }
    console.warn('[Auth] Token missing sub claim');
    return null;
  } catch (e) {
    console.error('[Auth] Token verification failed:', e);
    return null;
  }
}

/**
 * Issues a signed JWT for the given sessionUser.
 * Only available in local mode – throws in keycloak mode.
 */
export async function issueToken(sessionUser: string): Promise<string> {
  if (AUTH_MODE !== 'local') {
    throw new Error('[Auth] issueToken is only available in local auth mode');
  }
  return new SignJWT({ sub: sessionUser })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET_KEY);
}
