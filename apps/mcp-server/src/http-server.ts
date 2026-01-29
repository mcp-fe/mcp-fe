import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Server as HttpServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { getSessionIdFromToken } from './auth';
import { SessionManager } from './session-manager';

/**
 * Checks if a request body is an MCP initialize request
 */
function isInitializeRequest(
  body: unknown,
): body is { method: string; jsonrpc: string; id: unknown } {
  return (
    body !== null &&
    typeof body === 'object' &&
    'method' in body &&
    'jsonrpc' in body &&
    'id' in body &&
    (body as { method: unknown; jsonrpc: unknown; id: unknown }).method ===
      'initialize' &&
    (body as { method: unknown; jsonrpc: unknown; id: unknown }).jsonrpc ===
      '2.0' &&
    (body as { method: unknown; jsonrpc: unknown; id: unknown }).id !==
      undefined
  );
}

const transports: Record<string, StreamableHTTPServerTransport> = {};

/**
 * Creates and configures the HTTP server with Express
 */
export function createHTTPServer(
  port: number,
  sessionManager: SessionManager,
  mcpServer: Server,
): {
  server: HttpServer;
} {
  const app = createMcpExpressApp();

  // Log all requests
  app.use((req, res, next) => {
    const query =
      Object.keys(req.query).length > 0
        ? `?${new URLSearchParams(req.query as Record<string, string>).toString()}`
        : '';
    console.debug(`[HTTP] ${req.method} ${req.url}${query}`);
    next();
  });

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const token =
        (req.query.token as string) || req.headers.authorization?.split(' ')[1];
      const sessionId = getSessionIdFromToken(
        token?.replaceAll('Bearer ', '') || null,
      );

      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId ?? crypto.randomUUID(),
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID
          transports[sessionId] = transport;
        },
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      await mcpServer.connect(transport);
    } else {
      // TODO handle this
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // Handle GET requests
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // Handle DELETE requests for session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // Debug endpoint - show session status
  app.get('/debug/sessions', (req, res) => {
    const token =
      (req.query.token as string) || req.headers.authorization?.split(' ')[1];
    const sessionId = getSessionIdFromToken(
      token?.replaceAll('Bearer ', '') || null,
    );

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
    console.log(
      `[HTTP] Debug endpoint available at http://localhost:${port}/debug/sessions?token=YOUR_TOKEN`,
    );
  });

  return { server };
}
