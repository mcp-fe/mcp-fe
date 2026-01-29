import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Creates a new MCP server instance
 *
 * Note: This function is now mainly used by SessionManager to create
 * per-session MCP server instances. Handlers are set up in SessionManager.
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
    },
  );
}

// Note: setupMCPHandlers function has been moved to SessionManager.setupSessionMCPHandlers
// Each session now has its own MCP server instance with dedicated handlers
