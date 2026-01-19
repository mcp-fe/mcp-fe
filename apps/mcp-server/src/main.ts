import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/**
 * Node.js MCP Server
 *
 * This server receives user activity events from the client-side MCP edge (Service Worker)
 * via WebSocket and provides an MCP interface to interact with that data.
 */

// Simple in-memory storage for events received from the client
interface UserEvent {
  id: string;
  type: 'navigation' | 'click' | 'input' | 'custom';
  timestamp: number;
  path?: string;
  from?: string;
  to?: string;
  element?: string;
  elementId?: string;
  elementClass?: string;
  elementText?: string;
  metadata?: Record<string, unknown>;
}

const events: UserEvent[] = [];

// Create MCP server instance
function createServer() {
  return new Server(
    {
      name: 'backend-activity-mcp-server',
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
let activeWs: WebSocket | null = null;

async function callServiceWorkerTool(message: any): Promise<any> {
  if (!activeWs) {
    throw new Error('No Service Worker connected via WebSocket');
  }

  // Ensure message has a unique ID
  const requestId = message.id || Math.random().toString(36).substring(7);
  const mcpMessage = { ...message, id: requestId };

  console.error(`[Backend] Sending request to SW: ${mcpMessage.method} (id: ${requestId})`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId.toString());
      console.error(`[Backend] Timeout waiting for SW response for id: ${requestId}`);
      reject(new Error('Timeout waiting for Service Worker response'));
    }, 15000); // Increased timeout to 15s

    pendingRequests.set(requestId.toString(), (data) => {
      console.error(`[Backend] Received response from SW for id: ${requestId}`);
      clearTimeout(timeout);
      resolve(data);
    });

    try {
      activeWs!.send(JSON.stringify(mcpMessage));
    } catch (err) {
      clearTimeout(timeout);
      pendingRequests.delete(requestId.toString());
      reject(err);
    }
  });
}

function setupHandlers(server: Server) {
  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const localTools = [
      {
        name: 'get_ui_context',
        description: 'Get frontend UI context (route, recent events)',
        inputSchema: {
          type: 'object',
          properties: {
            fields: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['route', 'recent_events'],
              },
              description: 'Fields to pull from the frontend context',
            },
          },
          required: ['fields'],
        },
      },
    ];

    if (activeWs) {
      try {
        const response = await callServiceWorkerTool({
          jsonrpc: '2.0',
          method: 'tools/list',
        });

        if (response.result && Array.isArray(response.result.tools)) {
          return {
            tools: [...localTools, ...response.result.tools],
          };
        }
      } catch (error) {
        console.error('Error fetching tools from Service Worker:', error);
      }
    }

    return {
      tools: localTools,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'get_ui_context') {
      const schema = z.object({
        fields: z.array(z.enum(['route', 'recent_events'])),
      });

      const validatedArgs = schema.parse(args || {});

      if (!activeWs) {
        throw new Error('No Service Worker connected via WebSocket');
      }

      const requestId = Math.random().toString(36).substring(7);
      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingRequests.delete(requestId);
          reject(new Error('Timeout waiting for Service Worker response'));
        }, 10000);

        pendingRequests.set(requestId, (data) => {
          clearTimeout(timeout);
          resolve(data);
        });
      });

      activeWs.send(JSON.stringify({
        type: 'request_context',
        requestId,
        fields: validatedArgs.fields
      }));

      const result = await responsePromise as any;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.context, null, 2),
          },
        ],
      };
    }

    // Proxy other tools to Service Worker
    try {
      const response = await callServiceWorkerTool({
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
      console.error(`Error proxying tool ${name} to Service Worker:`, error);
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

const wss = new WebSocketServer({ server: httpServer });

console.error(`MCP Server (HTTP/WS) starting on port ${PORT}...`);

mcpServer.connect(httpTransport).catch((err) => {
  console.error('Failed to start HTTP MCP server:', err);
});

wss.on('connection', async (ws) => {
  console.error('Client connected');
  activeWs = ws;

  setupHandlers(mcpServer);


  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.error(`[Backend] Raw message from client: ${JSON.stringify(message).substring(0, 100)}...`);

      // 0. Handle responses to pull requests
      if (message.type === 'context_response') {
        console.error(`[Backend] Received context_response for id: ${message.requestId}`);
        const handler = pendingRequests.get(message.requestId);
        if (handler) {
          handler(message);
          pendingRequests.delete(message.requestId);
        }
        return;
      }

      // 1. Handle MCP protocol messages (JSON-RPC)
      // This allows the client to call tools on the server via WebSocket
      if (message.jsonrpc === '2.0') {
        // Handle responses from SW to our requests (e.g. tools/list or tools/call we proxied)
        if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
          const handler = pendingRequests.get(message.id.toString());
          if (handler) {
            console.error(`[Backend] Found handler for response id: ${message.id}`);
            handler(message);
            pendingRequests.delete(message.id.toString());
            return;
          }
        }
        // Other messages (requests from client to us) are handled by WebSocketTransport.start() listener
        return;
      }

      // 2. Handle raw events being pushed from the client (backward compatibility)
      if (message.type === 'EVENT_PUSH') {
        const event = message.event as UserEvent;
        console.error(`Received event: ${event.type} at ${event.path}`);
        events.push(event);

        // Keep memory usage in check
        if (events.length > 5000) {
          events.shift();
        }

        ws.send(JSON.stringify({ type: 'EVENT_ACK', id: event.id }));
        return;
      }

      console.error('Received unknown message type:', message);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', async () => {
    console.error('Client disconnected');
    if (activeWs === ws) {
      activeWs = null;
    }
    // Reset handlers to include server only
    setupHandlers(mcpServer);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});
