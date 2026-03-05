import { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { verifyToken } from './auth';
import { WebSocketManager } from './websocket-manager';

const AUTH_TIMEOUT_MS = 10_000;

/**
 * Sets up and starts the WebSocket server.
 *
 * Authentication flow
 *  1. Client connects (no token in URL)
 *  2. Client immediately sends: { type: 'AUTH', token: '<jwt>' }
 *  3. Server verifies token → replies { type: 'AUTH_OK' } or closes with 4001
 *  4. Normal MCP message exchange begins
 *
 * Connections that do not send AUTH within AUTH_TIMEOUT_MS are closed automatically.
 */
export function setupWebSocketServer(
  httpServer: HttpServer,
  wsManager: WebSocketManager,
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    let sessionId: string | null = null;
    let authenticated = false;

    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        console.warn('[WS Auth] Closing unauthenticated connection (timeout)');
        ws.close(4001, 'Authentication timeout');
      }
    }, AUTH_TIMEOUT_MS);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // ── Auth handshake ────────────────────────────────────────────────
        if (!authenticated) {
          if (message.type !== 'AUTH') {
            ws.close(4001, 'Authentication required');
            return;
          }

          const resolvedId = await verifyToken(message.token);
          if (!resolvedId) {
            console.warn('[WS Auth] Rejecting connection: invalid token');
            ws.send(
              JSON.stringify({
                type: 'AUTH_ERROR',
                message: 'Invalid or expired token',
              }),
            );
            ws.close(4001, 'Unauthorized');
            return;
          }

          clearTimeout(authTimeout);
          authenticated = true;
          sessionId = resolvedId;
          wsManager.registerSession(sessionId, ws);
          ws.send(JSON.stringify({ type: 'AUTH_OK' }));
          console.log(`[WS Auth] Authenticated session: ${sessionId}`);
          return;
        }

        // ── Normal message handling ───────────────────────────────────────
        if (message.type === 'ping') return;

        console.debug(
          `[WS] Message from client (${sessionId}): ${JSON.stringify(message).substring(0, 100)}...`,
        );
        wsManager.handleMessage(sessionId!, message);
      } catch (error) {
        console.error('[WS] Error processing message:', error);
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (sessionId) {
        wsManager.unregisterSession(sessionId);
        console.log(`[WS] Connection closed for session: ${sessionId}`);
      }
    });

    ws.on('error', (error) => {
      console.error('[WS] WebSocket error:', error);
    });
  });

  return wss;
}
