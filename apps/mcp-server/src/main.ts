/**
 * Copyright 2026 Michal Kopecky
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Node.js MCP Server
 *
 * This server receives user activity events from the client-side MCP edge (Service Worker)
 * via WebSocket and provides an MCP interface to interact with that data.
 */

import { createHTTPServer } from './http-server';
import { setupWebSocketServer } from './websocket-server';
import { WebSocketManager } from './websocket-manager';
import { SessionManager } from './session-manager';

// Initialize components
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN;

// Parse allowed domains from comma-separated string
const allowedDomains = ALLOWED_DOMAIN
  ? ALLOWED_DOMAIN.split(',')
      .map((domain) => domain.trim())
      .filter(Boolean)
  : undefined;

const sessionManager = new SessionManager();
const wsManager = new WebSocketManager(sessionManager);

console.log(`[Main] Server configuration:`);
console.log(`[Main] - Port: ${PORT}`);
console.log(`[Main] - Host: ${SERVER_HOST}`);
if (allowedDomains && allowedDomains.length > 0) {
  console.log(`[Main] - Allowed domains: ${allowedDomains.join(', ')}`);
} else {
  console.log(`[Main] - Allowed domains: not set (localhost only)`);
}

// Setup HTTP server (no global MCP server needed)
const { server: httpServer } = createHTTPServer(sessionManager, wsManager, {
  port: PORT,
  host: SERVER_HOST,
  allowedDomains: allowedDomains,
});

// Setup WebSocket server
setupWebSocketServer(httpServer, wsManager);

// Connect MCP server to HTTP transport
console.log(`[Main] MCP Server (HTTP/WS) starting on port ${PORT}...`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Main] Shutting down gracefully...');
  sessionManager.destroy();
  process.exit(0);
});
