import express from 'express';
import { Server as HttpServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getSessionIdFromToken } from './auth';
import { SessionManager } from './session-manager';

/**
 * Creates and configures the HTTP server with Express
 */
export function createHTTPServer(port: number, sessionManager: SessionManager): { app: express.Application; server: HttpServer; transport: StreamableHTTPServerTransport } {
  const httpTransport = new StreamableHTTPServerTransport({
    // Disable session management before proper implementation
    sessionIdGenerator: undefined,
  });

  const app = express();

  // Log all requests
  app.use((req, res, next) => {
    const query = Object.keys(req.query).length > 0 ? `?${new URLSearchParams(req.query as any).toString()}` : '';
    console.debug(`[HTTP] ${req.method} ${req.url}${query}`);
    next();
  });

  // MCP endpoint handles both POST and GET
  // StreamableHTTPServerTransport handles /sse and /message paths internally if mounted at root,
  // but we can also use specific routes.
  // The transport's handleRequest is designed to take Node.js req/res.
  app.all(['/', '/sse', '/message'], async (req, res) => {
    const startTime = Date.now();
    let sessionId: string | null = null;

    try {
      const token = (req.query.token as string) || req.headers.authorization?.split(' ')[1];
      sessionId = getSessionIdFromToken(token?.replaceAll("Bearer ", "") || null);

      if (!sessionId) {
        console.warn(`[HTTP Auth] Rejecting unauthorized ${req.method} ${req.url} from ${req.ip}`);
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Track session activity
      sessionManager.setHTTPConnected(sessionId, true);
      const session = sessionManager.getSession(sessionId);

      console.debug(`[HTTP] ${req.method} ${req.url} - Session: ${sessionId}, WS Connected: ${session?.isWSConnected}, Queue size: ${session?.pendingMessages.length || 0}`);

      // Handle the request through MCP transport
      await httpTransport.handleRequest(req, res);

      const duration = Date.now() - startTime;
      const finalStatus = res.statusCode;

      // Special handling for 409 Conflict
      if (finalStatus === 409) {
        const health = sessionManager.isSessionHealthy(sessionId);
        console.warn(`[HTTP] 409 Conflict on ${req.method} ${req.url} - Session: ${sessionId}`);
        console.warn(`[HTTP] Session health: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'} ${health.reason ? `(${health.reason})` : ''}`);

        if (session) {
          console.warn(`[HTTP] Session state - WS: ${session.isWSConnected}, HTTP: ${session.isHTTPConnected}, Queue: ${session.pendingMessages.length}, Pending requests: ${session.pendingRequests.size}`);
        }
      }

      console.log(`[HTTP] ✓ ${req.method} ${req.url} - Status: ${finalStatus} (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`[HTTP] ✗ ${req.method} ${req.url} - Error: ${err instanceof Error ? err.message : String(err)} (${duration}ms)`);

      if (sessionId) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
          console.debug(`[HTTP] Session state at error - WS: ${session.isWSConnected}, HTTP: ${session.isHTTPConnected}, Queue: ${session.pendingMessages.length}`);
        }
      }

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          ...(process.env.NODE_ENV === 'development' && { message: err instanceof Error ? err.message : String(err) })
        });
      }
    } finally {
      if (sessionId) {
        sessionManager.setHTTPConnected(sessionId, false);
      }
    }
  });

  // Debug endpoint - show session status
  app.get('/debug/sessions', (req, res) => {
    const token = (req.query.token as string) || req.headers.authorization?.split(' ')[1];
    const sessionId = getSessionIdFromToken(token?.replaceAll("Bearer ", "") || null);

    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const health = sessionManager.isSessionHealthy(sessionId);
    return res.json({
      sessionId,
      createdAt: new Date(session.createdAt),
      lastActivity: new Date(session.lastActivity),
      isWSConnected: session.isWSConnected,
      isHTTPConnected: session.isHTTPConnected,
      pendingMessagesCount: session.pendingMessages.length,
      pendingRequestsCount: session.pendingRequests.size,
      health: health.healthy ? 'HEALTHY' : `UNHEALTHY (${health.reason})`,
    });
  });

  const server = app.listen(port, () => {
    console.log(`[HTTP] Server listening on port ${port}`);
    console.log(`[HTTP] Debug endpoint available at http://localhost:${port}/debug/sessions?token=YOUR_TOKEN`);
  });

  return { app, server, transport: httpTransport };
}
