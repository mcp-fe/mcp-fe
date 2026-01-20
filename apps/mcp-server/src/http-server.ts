import express from 'express';
import { Server as HttpServer } from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getSessionIdFromToken } from './auth';

/**
 * Creates and configures the HTTP server with Express
 */
export function createHTTPServer(port: number): { app: express.Application; server: HttpServer; transport: StreamableHTTPServerTransport } {
  const httpTransport = new StreamableHTTPServerTransport({
    // Disable the session management before proper implementation
    sessionIdGenerator: undefined,
  });

  const app = express();

  // Log all requests
  app.use((req, res, next) => {
    console.error(`[HTTP] ${req.method} ${req.url}`);
    next();
  });

  // MCP endpoint handles both POST and GET
  // StreamableHTTPServerTransport handles /sse and /message paths internally if mounted at root,
  // but we can also use specific routes.
  // The transport's handleRequest is designed to take Node.js req/res.
  app.all(['/', '/sse', '/message'], async (req, res) => {
    try {
      const token = (req.query.token as string) || req.headers.authorization?.split(' ')[1];
      const sessionId = getSessionIdFromToken(token?.replaceAll("Bearer ", "") || null);

      if (!sessionId) {
        console.error(`[HTTP Auth] Rejecting unauthorized request from ${req.ip}`);
        res.status(401).send('Unauthorized');
        return;
      }

      await httpTransport.handleRequest(req, res);
      console.error(`[HTTP] Handled ${req.method} ${req.url} - Status: ${res.statusCode}`);
    } catch (err) {
      console.error('[HTTP Error]', err);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  });

  const server = app.listen(port, () => {
    console.error(`HTTP Server listening on port ${port}`);
  });

  return { app, server, transport: httpTransport };
}
