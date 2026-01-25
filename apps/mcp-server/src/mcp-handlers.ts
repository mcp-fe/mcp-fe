import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getSessionIdFromToken } from './auth';
import { WebSocketManager } from './websocket-manager';
import { SessionManager } from './session-manager';

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
export function setupMCPHandlers(server: Server, wsManager: WebSocketManager, sessionManager: SessionManager): void {
  // Register tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
    const token = extra.requestInfo?.headers['authorization']?.toString().replace('Bearer ', '');
    const sessionId = getSessionIdFromToken(token) ?? 'anonymous';

    console.debug(`[MCP] tools/list request from session: ${sessionId}`);

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
        console.debug(`[MCP] Forwarding tools/list to Service Worker for session: ${sessionId}`);
        const response = await wsManager.callServiceWorkerTool(sessionId, {
          jsonrpc: '2.0',
          method: 'tools/list',
        });

        if (response.result && Array.isArray(response.result.tools)) {
          console.debug(`[MCP] Received ${response.result.tools.length} tools from Service Worker`);
          return {
            tools: [...localTools, ...response.result.tools],
          };
        }
      } catch (error) {
        console.error(`[MCP] Error fetching tools from Service Worker for session ${sessionId}:`, error instanceof Error ? error.message : String(error));
      }
    } else {
      console.warn(`[MCP] tools/list: No WebSocket connection for session ${sessionId}`);
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

    console.debug(`[MCP] tools/call: ${name} from session: ${sessionId}`);

    if (name === 'client_status') {
      const ws = wsManager.getSession(sessionId);
      const health = sessionManager.isSessionHealthy(sessionId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isConnected: !!ws,
              sessionId,
              isHealthy: health.healthy,
              message: ws ? `Client connected for session ${sessionId}` : `No client connected for session ${sessionId}`
            }, null, 2),
          },
        ],
      };
    }

    // Proxy other tools to Service Worker
    try {
      const ws = wsManager.getSession(sessionId);
      if (!ws) {
        throw new Error(`No WebSocket connection for session ${sessionId}`);
      }

      console.debug(`[MCP] Forwarding tool call to Service Worker: ${name}`);
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

      console.error(`[MCP] Tool call completed: ${name}`);
      return response.result;
    } catch (error) {
      console.error(`[MCP] Error proxying tool ${name} to Service Worker for session ${sessionId}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  });
}
