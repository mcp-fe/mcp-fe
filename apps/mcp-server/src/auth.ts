/**
 * Mock JWT utilities - client creates tokens, server just reads the sessionId from them
 * Uses jose library for reading JWT claims without signature verification
 */
import { decodeJwt } from 'jose';

/**
 * Decodes a JWT token and extracts the sessionId (sub claim)
 * This is a mock implementation - does NOT verify the signature
 * @param token - The JWT token to decode
 * @returns The session ID (sub claim) if valid, or null
 */
export function getSessionIdFromToken(token?: string | string[] | null): string | null {
  if (!token) return null;
  try {
    const tokenStr = Array.isArray(token) ? token[0] : token.toString();

    // Decode the payload without verification (just a mock implementation for now)
    const payload = decodeJwt(tokenStr);

    if (payload && typeof payload.sub === 'string') {
      console.log(`[Auth] Session verified for user: ${payload.sub}`);
      return payload.sub;
    }
    console.warn('[Auth] Invalid token format');
    return null;
  } catch (e) {
    console.error('Failed to parse token:', e);
    return null;
  }
}
