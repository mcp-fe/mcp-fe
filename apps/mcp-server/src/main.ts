import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WebSocketServer, WebSocket } from 'ws';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
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

/**
 * Custom MCP Transport for WebSocket
 */
class WebSocketTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(private ws: WebSocket) {}

  async start(): Promise<void> {
    // Already connected
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.ws.send(JSON.stringify(message));
  }

  async close(): Promise<void> {
    this.ws.close();
  }
}

// Track pending requests and active connections
const pendingRequests = new Map<string, (value: any) => void>();
let activeWs: any = null;

function setupHandlers(server: Server) {
  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
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
      ],
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

    throw new Error(`Unknown tool: ${name}`);
  });
}

setupHandlers(mcpServer);

// Setup WebSocket Server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const wss = new WebSocketServer({ port: PORT });

console.error(`MCP WebSocket Server starting on port ${PORT}...`);

// Setup STDIO Server
const streamableHTTPServerTransport = new StreamableHTTPServerTransport();
mcpServer.connect(streamableHTTPServerTransport).catch((error) => {
  console.error('Failed to connect StreamableHTTPServer transport:', error);
});

wss.on('connection', async (ws) => {
  console.error('Client connected');
  activeWs = ws;

  const wsServer = createServer();
  setupHandlers(wsServer);

  const transport = new WebSocketTransport(ws);
  await wsServer.connect(transport);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      // 0. Handle responses to pull requests
      if (message.type === 'context_response') {
        const handler = pendingRequests.get(message.requestId);
        if (handler) {
          handler(message);
          pendingRequests.delete(message.requestId);
        }
        return;
      }

      // 1. Handle raw events being pushed from the client
      // (This is against the "no automatic push" goal but kept for backward compatibility if needed,
      // however the Service Worker no longer sends these).
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

      // 2. Handle MCP protocol messages (JSON-RPC)
      // This allows the client to call tools on the server via WebSocket
      if (message.jsonrpc === '2.0') {
        transport.onmessage?.(message as JSONRPCMessage);
        return;
      }

      console.error('Received unknown message type:', message);
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        }
      }));
    }
  });

  ws.on('close', async () => {
    console.error('Client disconnected');
    if (activeWs === ws) {
      activeWs = null;
    }
    await wsServer.close();
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});
