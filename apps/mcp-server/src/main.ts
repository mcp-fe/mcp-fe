/**
 * Node.js MCP Server
 *
 * This server receives user activity events from the client-side MCP edge (Service Worker)
 * via WebSocket and provides an MCP interface to interact with that data.
 */

import { createMCPServer, setupMCPHandlers } from './mcp-handlers';
import { createHTTPServer } from './http-server';
import { setupWebSocketServer } from './websocket-server';
import { WebSocketManager } from './websocket-manager';
import { SessionManager } from './session-manager';

// Initialize components
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const sessionManager = new SessionManager();
const wsManager = new WebSocketManager(sessionManager);
const mcpServer = createMCPServer();

// Setup MCP handlers
setupMCPHandlers(mcpServer, wsManager, sessionManager);

// Setup HTTP server
const { server: httpServer } = createHTTPServer(
  PORT,
  sessionManager,
  mcpServer,
);

// Setup WebSocket server
setupWebSocketServer(httpServer, wsManager, sessionManager);

// Connect MCP server to HTTP transport
console.log(`[Main] MCP Server (HTTP/WS) starting on port ${PORT}...`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Main] Shutting down gracefully...');
  sessionManager.destroy();
  mcpServer.close();
  process.exit(0);
});
