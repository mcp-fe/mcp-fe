export function getSessionIdFromToken(token?: string | string[] | null): string | null {
  if (!token) return null;
  try {
    // Basic JWT decoding for simulation
    // In a real app, you would verify the signature here
    const payload = JSON.parse(Buffer.from(token.toString(), 'base64').toString());
    console.error('Decoded token:', payload);
    return payload.sub || null;
  } catch (e) {
    console.error('Failed to parse token:', e);
    return null;
  }
}
