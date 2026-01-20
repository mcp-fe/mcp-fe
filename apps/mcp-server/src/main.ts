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

// Initialize components
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const wsManager = new WebSocketManager();
const mcpServer = createMCPServer();

// Setup MCP handlers
setupMCPHandlers(mcpServer, wsManager);

// Setup HTTP server
const { server: httpServer, transport: httpTransport } = createHTTPServer(PORT);

// Setup WebSocket server
setupWebSocketServer(httpServer, wsManager);

// Connect MCP server to HTTP transport
console.error(`MCP Server (HTTP/WS) starting on port ${PORT}...`);

mcpServer.connect(httpTransport).catch((err) => {
  console.error('Failed to start HTTP MCP server:', err);
});
