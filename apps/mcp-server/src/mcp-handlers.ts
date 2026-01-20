import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getSessionIdFromToken } from './auth';
import { WebSocketManager } from './websocket-manager';

/**
 * Creates a new MCP server instance
 */
export function createMCPServer(): Server {
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

/**
 * Sets up MCP request handlers
 */
export function setupMCPHandlers(server: Server, wsManager: WebSocketManager): void {
  // Register tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
    const token = extra.requestInfo?.headers['authorization']?.toString().replace('Bearer ', '');
    const sessionId = getSessionIdFromToken(token) ?? 'anonymous';

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

    const ws = wsManager.getSession(sessionId);
    if (ws) {
      try {
        const response = await wsManager.callServiceWorkerTool(sessionId, {
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

  // Register tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const token = extra.requestInfo?.headers['authorization']
      ?.toString()
      .replace('Bearer ', '');
    const sessionId = getSessionIdFromToken(token) ?? 'anonymous';

    if (name === 'client_status') {
      const ws = wsManager.getSession(sessionId);
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
      const response = await wsManager.callServiceWorkerTool(sessionId, {
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
