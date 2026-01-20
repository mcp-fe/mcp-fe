import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Node.js MCP Server
 *
 * This server receives user activity events from the client-side MCP edge (Service Worker)
 * via WebSocket and provides an MCP interface to interact with that data.
 */

// Create MCP server instance
function createServer() {
  return new Server(
    {
      name: 'mcp-server-for-fe',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
}

const mcpServer = createServer();

// Track pending requests and active connections
const pendingRequests = new Map<string, (value: any) => void>();
// Map sessionId to WebSocket connection
const activeSessions = new Map<string, WebSocket>();

function getSessionIdFromToken(token: string | null): string {
  if (!token) return 'anonymous';
  try {
    // Basic JWT decoding for simulation
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    return payload.sub || 'anonymous';
  } catch (e) {
    console.error('Failed to parse token:', e);
    return 'anonymous';
  }
}

async function callServiceWorkerTool(sessionId: string, message: any): Promise<any> {
  const ws = activeSessions.get(sessionId);
  if (!ws) {
    throw new Error(`No Service Worker connected for session: ${sessionId}`);
  }

  // Ensure message has a unique ID
  const requestId = message.id || Math.random().toString(36).substring(7);
  const mcpMessage = { ...message, id: requestId };

  console.error(`[Backend] Sending request to SW (${sessionId}): ${mcpMessage.method} (id: ${requestId})`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(`${sessionId}:${requestId}`);
      console.error(`[Backend] Timeout waiting for SW response for session ${sessionId}, id: ${requestId}`);
      reject(new Error('Timeout waiting for Service Worker response'));
    }, 15000); // Increased timeout to 15s

    pendingRequests.set(`${sessionId}:${requestId}`, (data) => {
      console.error(`[Backend] Received response from SW for session ${sessionId}, id: ${requestId}`);
      clearTimeout(timeout);
      resolve(data);
    });

    try {
      ws.send(JSON.stringify(mcpMessage));
    } catch (err) {
      clearTimeout(timeout);
      pendingRequests.delete(`${sessionId}:${requestId}`);
      reject(err);
    }
  });
}

function setupHandlers(server: Server) {
  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
    const sessionId = (extra as any)?.sessionId || 'anonymous';
    const localTools = [
      {
        name: 'client_status',
        description: 'Check if there is a client connected via WebSocket',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];

    const ws = activeSessions.get(sessionId);
    if (ws) {
      try {
        const response = await callServiceWorkerTool(sessionId, {
          jsonrpc: '2.0',
          method: 'tools/list',
        });

        if (response.result && Array.isArray(response.result.tools)) {
          return {
            tools: [...localTools, ...response.result.tools],
          };
        }
      } catch (error) {
        console.error(`Error fetching tools from Service Worker for session ${sessionId}:`, error);
      }
    }

    return {
      tools: localTools,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const sessionId = (extra as any)?.sessionId || 'anonymous';

    if (name === 'client_status') {
      const ws = activeSessions.get(sessionId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isConnected: !!ws,
              sessionId,
              message: ws ? `Client connected for session ${sessionId}` : `No client connected for session ${sessionId}`
            }, null, 2),
          },
        ],
      };
    }

    // Proxy other tools to Service Worker
    try {
      const response = await callServiceWorkerTool(sessionId, {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name,
          arguments: args,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Error calling tool in Service Worker');
      }

      return response.result;
    } catch (error) {
      console.error(`Error proxying tool ${name} to Service Worker for session ${sessionId}:`, error);
      throw error;
    }
  });
}

setupHandlers(mcpServer);

// Setup HTTP and WebSocket Server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

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
    await httpTransport.handleRequest(req, res);
    console.error(`[HTTP] Handled ${req.method} ${req.url} - Status: ${res.statusCode}`);
  } catch (err) {
    console.error('[HTTP Error]', err);
    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
});

const httpServer = app.listen(PORT, () => {
  console.error(`HTTP Server listening on port ${PORT}`);
});

const mcpAuthMiddleware: (info: { origin: string; secure: boolean; req: any }, callback: (res: boolean, code?: number, message?: string) => void) => void = (info, callback) => {
  const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
  const token = url.searchParams.get('token');
  const sessionId = getSessionIdFromToken(token);

  if (sessionId === 'anonymous') {
    console.error(`[WS Auth] Rejecting anonymous connection from ${info.origin}`);
    callback(false, 401, 'Unauthorized');
  } else {
    console.error(`[WS Auth] Verified session: ${sessionId}`);
    // Attach sessionId to the request object so it can be used in the connection event
    info.req.sessionId = sessionId;
    info.req.mcpSession = {
      id: `mcp_${crypto.randomUUID()}`,
      context: {
        sessionId,
        scopes: ['context:read'],
      },
    };
    callback(true);
  }
};

const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: mcpAuthMiddleware,
});

console.error(`MCP Server (HTTP/WS) starting on port ${PORT}...`);

mcpServer.connect(httpTransport).catch((err) => {
  console.error('Failed to start HTTP MCP server:', err);
});

wss.on('connection', async (ws, req) => {
  const sessionId = (req as any).sessionId || 'anonymous';

  console.error(`Client connected for session: ${sessionId}`);
  activeSessions.set(sessionId, ws);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.error(`[Backend] Raw message from client (${sessionId}): ${JSON.stringify(message).substring(0, 100)}...`);

      // Handle MCP protocol messages (JSON-RPC)
      if (message.jsonrpc === '2.0') {
        // Handle responses from SW to our requests
        if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
          const handler = pendingRequests.get(`${sessionId}:${message.id}`);
          if (handler) {
            console.error(`[Backend] Found handler for response session ${sessionId}, id: ${message.id}`);
            handler(message);
            pendingRequests.delete(`${sessionId}:${message.id}`);
            return;
          }
        }
        return;
      }

      console.error('Received unknown message type:', message);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', async () => {
    console.error(`Client disconnected for session: ${sessionId}`);
    if (activeSessions.get(sessionId) === ws) {
      activeSessions.delete(sessionId);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});
