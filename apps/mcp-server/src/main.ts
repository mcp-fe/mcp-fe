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
        name: 'client_status',
        description: 'Check if there is a client connected via WebSocket',
        inputSchema: {
          type: 'object',
          properties: {},
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

    if (name === 'client_status') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isConnected: !!activeWs,
              message: activeWs ? 'Client connected' : 'No client connected'
            }, null, 2),
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

      // Handle MCP protocol messages (JSON-RPC)
      // This allows the client to call tools in the serviceWorker MCP via WebSocket
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
