/**
 * MCP Server setup and request handlers
 * Uses @modelcontextprotocol/sdk for type safety and validation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { toolRegistry } from './tool-registry';
import { registerBuiltInTools } from './built-in-tools';

export interface MCPServerOptions {
  name?: string;
  version?: string;
  autoRegisterBuiltInTools?: boolean;
}

/**
 * Factory function to create and configure an MCP server instance
 * @param options Configuration options for the server
 * @returns Configured MCP Server instance
 */
export function createMCPServer(options: MCPServerOptions = {}): Server {
  const {
    name = 'mcp-worker-server',
    version = '1.0.0',
    autoRegisterBuiltInTools = true,
  } = options;

  // Initialize built-in tools if enabled
  if (autoRegisterBuiltInTools) {
    registerBuiltInTools();
  }

  // Create MCP server instance
  const server = new Server(
    {
      name,
      version,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register tools list handler using SDK - uses dynamic registry
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolRegistry.getTools(),
    };
  });

  // Register tool call handler using SDK - uses dynamic registry
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: { params: { name: string; arguments?: unknown } }) => {
      const { name, arguments: args } = request.params;

      const handler = toolRegistry.getHandler(name);
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      return await handler(args);
    },
  );

  return server;
}

/**
 * Send tools/list_changed notification to MCP client
 * Call this whenever tools are added or removed from the registry
 */
export function notifyToolsChanged(server: Server): void {
  try {
    server.notification({
      method: 'notifications/tools/list_changed',
    });
  } catch {
    // Silently ignore - client might not be connected yet
  }
}

// Default server instance
export const mcpServer = createMCPServer();
