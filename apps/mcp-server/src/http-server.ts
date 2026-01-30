import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Server as HttpServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { getSessionIdFromToken } from './auth';
import { SessionManager } from './session-manager';
import { WebSocketManager } from './websocket-manager';

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

/**
 * Creates and configures the HTTP server with Express
 */
export function createHTTPServer(
  port: number,
  sessionManager: SessionManager,
  wsManager: WebSocketManager,
): {
  server: HttpServer;
} {
  const app = createMcpExpressApp({
    host: '0.0.0.0',
    allowedHosts: ['host.docker.internal', 'localhost'],
  });

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
    let mcpServer: Server;

    if (sessionId) {
      // Reuse existing session and its MCP Server
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        res.status(400).send('Invalid session ID');
        return;
      }

      if (!session.transport || !session.mcpServer) {
        console.error(
          `[HTTP] No transport or MCP server found for session: ${sessionId}`,
        );
        res.status(500).send('Session not properly initialized');
        return;
      }

      transport = session.transport;
      mcpServer = session.mcpServer;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const token =
        (req.query.token as string) || req.headers.authorization?.split(' ')[1];
      const authSessionId = getSessionIdFromToken(
        token?.replaceAll('Bearer ', '') || null,
      );

      if (!authSessionId) {
        console.error(`[HTTP] Unauthorized initialization attempt`);
        res.status(401).send('Unauthorized: Invalid or missing token');
        return;
      }

      // Create new MCP Server and transport for this session
      mcpServer = sessionManager.createMCPServerForSession(
        authSessionId,
        wsManager,
      );

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => authSessionId,
        onsessioninitialized: (sessionId) => {
          sessionManager.attachTransport(sessionId, transport);
        },
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          sessionManager.closeTransport(authSessionId);
        }
      };

      await mcpServer.connect(transport);
      console.log(
        `[HTTP] Created new MCP Server and transport for session: ${authSessionId}`,
      );
    } else {
      console.debug(`[HTTP] Missing session ID for non-initialization request`);
      res.status(400).send('Missing mcp-session-id header');
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // Handle GET requests
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId) {
      res.status(400).send('Missing mcp-session-id header');
      return;
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      res.status(400).send('Invalid session ID');
      return;
    }

    if (!session.transport) {
      console.error(`[HTTP] No transport found for session: ${sessionId}`);
      res.status(500).send('Transport not found for session');
      return;
    }

    await session.transport.handleRequest(req, res);
  });

  // Handle DELETE requests for session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId) {
      res.status(400).send('Missing mcp-session-id header');
      return;
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      res.status(400).send('Invalid session ID');
      return;
    }

    if (!session.transport) {
      console.error(`[HTTP] No transport found for session: ${sessionId}`);
      res.status(500).send('Transport not found for session');
      return;
    }

    await session.transport.handleRequest(req, res);
  });

  // Health check endpoints

  // Liveness probe - indicates if the server is running
  app.get('/health/live', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'mcp-server',
    });
  });

  // Readiness probe - indicates if the server is ready to accept traffic
  app.get('/health/ready', (req, res) => {
    try {
      // Check if critical components are available
      const isReady = sessionManager && wsManager;

      if (isReady) {
        res.status(200).json({
          status: 'UP',
          timestamp: new Date().toISOString(),
          service: 'mcp-server',
          checks: {
            sessionManager: 'UP',
            webSocketManager: 'UP',
          },
        });
      } else {
        res.status(503).json({
          status: 'DOWN',
          timestamp: new Date().toISOString(),
          service: 'mcp-server',
          checks: {
            sessionManager: sessionManager ? 'UP' : 'DOWN',
            webSocketManager: wsManager ? 'UP' : 'DOWN',
          },
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        service: 'mcp-server',
        error: 'Health check failed',
      });
    }
  });

  // Combined health endpoint
  app.get('/health', (req, res) => {
    try {
      const isHealthy = sessionManager && wsManager;

      if (isHealthy) {
        res.status(200).json({
          status: 'UP',
          timestamp: new Date().toISOString(),
          service: 'mcp-server',
          version: process.env.npm_package_version || 'unknown',
          uptime: process.uptime(),
          checks: {
            sessionManager: 'UP',
            webSocketManager: 'UP',
          },
        });
      } else {
        res.status(503).json({
          status: 'DOWN',
          timestamp: new Date().toISOString(),
          service: 'mcp-server',
          version: process.env.npm_package_version || 'unknown',
          uptime: process.uptime(),
          checks: {
            sessionManager: sessionManager ? 'UP' : 'DOWN',
            webSocketManager: wsManager ? 'UP' : 'DOWN',
          },
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        service: 'mcp-server',
        error: 'Health check failed',
      });
    }
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
      transport: session.transport ? 'StreamableHTTP' : 'None',
      mcpServer: session.mcpServer ? 'Active' : 'None',
      pendingMessagesCount: session.pendingMessages.length,
      pendingRequestsCount: session.pendingRequests.size,
      health: health.healthy ? 'HEALTHY' : `UNHEALTHY (${health.reason})`,
    });
  });

  const server = app.listen(port, () => {
    console.log(`[HTTP] Server listening on port ${port}`);
    console.log(`[HTTP] Health endpoints available at:`);
    console.log(`  - Liveness:  http://localhost:${port}/health/live`);
    console.log(`  - Readiness: http://localhost:${port}/health/ready`);
    console.log(`  - Combined:  http://localhost:${port}/health`);
    console.log(
      `[HTTP] Debug endpoint available at http://localhost:${port}/debug/sessions?token=YOUR_TOKEN`,
    );
  });

  return { server };
}
