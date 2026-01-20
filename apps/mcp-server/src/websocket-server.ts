import { WebSocketServer } from 'ws';
import { Server as HttpServer } from 'http';
import { getSessionIdFromToken } from './auth';
import { WebSocketManager } from './websocket-manager';

/**
 * Creates WebSocket authentication middleware
 */
function createWSAuthMiddleware() {
  return (info: { origin: string; secure: boolean; req: any }, callback: (res: boolean, code?: number, message?: string) => void) => {
    const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
    const token = url.searchParams.get('token');
    const sessionId = getSessionIdFromToken(token);

    if (!sessionId) {
      console.log(`[WS Auth] Rejecting unauthorized connection from ${info.origin}`);
      callback(false, 401, 'Unauthorized');
    } else {
      console.log(`[WS Auth] Verified session: ${sessionId}`);
      // Attach sessionId to the request object so it can be used in the connection event
      info.req.sessionId = sessionId;
      callback(true);
    }
  };
}

/**
 * Sets up and starts the WebSocket server
 */
export function setupWebSocketServer(httpServer: HttpServer, wsManager: WebSocketManager): WebSocketServer {
  const wsAuthMiddleware = createWSAuthMiddleware();

  const wss = new WebSocketServer({
    server: httpServer,
    verifyClient: wsAuthMiddleware,
  });

  wss.on('connection', async (ws, req) => {
    const sessionId = (req as any).sessionId || 'anonymous';

    wsManager.registerSession(sessionId, ws);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.error(`[Backend] Raw message from client (${sessionId}): ${JSON.stringify(message).substring(0, 100)}...`);

        wsManager.handleMessage(sessionId, message);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', async () => {
      wsManager.unregisterSession(sessionId, ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return wss;
}
