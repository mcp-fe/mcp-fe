/**
 * JWT auth module – supports two modes controlled by AUTH_MODE env variable:
 *
 *  local    – Server signs tokens with HS256 (JWT_SECRET). Use /auth/token to obtain a token.
 *             Suitable for demo / standalone deployments.
 *
 *  keycloak – Server validates tokens issued by Keycloak via JWKS (RS256/ES256).
 *             Clients send their Keycloak access token directly – no /auth/token endpoint needed.
 *             Required env vars: KEYCLOAK_JWKS_URI, KEYCLOAK_ISSUER, KEYCLOAK_AUDIENCE (optional)
 */
import { jwtVerify, SignJWT, createRemoteJWKSet } from 'jose';

export const AUTH_MODE = (process.env.AUTH_MODE || 'local') as 'local' | 'keycloak';

// ── Local mode ────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'mcp-mock-secret-key-do-not-use-in-production';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// ── Keycloak mode ─────────────────────────────────────────────────────────────
const KEYCLOAK_JWKS_URI = process.env.KEYCLOAK_JWKS_URI;
const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER;
const KEYCLOAK_AUDIENCE = process.env.KEYCLOAK_AUDIENCE;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

if (AUTH_MODE === 'keycloak') {
  if (!KEYCLOAK_JWKS_URI) throw new Error('[Auth] KEYCLOAK_JWKS_URI is required when AUTH_MODE=keycloak');
  if (!KEYCLOAK_ISSUER) throw new Error('[Auth] KEYCLOAK_ISSUER is required when AUTH_MODE=keycloak');
  jwks = createRemoteJWKSet(new URL(KEYCLOAK_JWKS_URI));
  console.log(`[Auth] Mode: keycloak | JWKS: ${KEYCLOAK_JWKS_URI} | Issuer: ${KEYCLOAK_ISSUER}`);
} else {
  if (!process.env.JWT_SECRET) {
    console.warn('[Auth] Mode: local | JWT_SECRET not set — using insecure development default');
  } else {
    console.log('[Auth] Mode: local');
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Verifies a JWT token and returns the sessionId (sub claim), or null if invalid.
 * Works in both local and keycloak modes.
 */
export async function verifyToken(token?: string | string[] | null): Promise<string | null> {
  if (!token) return null;
  try {
    const tokenStr = Array.isArray(token) ? token[0] : token.toString();

    let sub: unknown;

    if (AUTH_MODE === 'keycloak') {
      const { payload } = await jwtVerify(tokenStr, jwks!, {
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
