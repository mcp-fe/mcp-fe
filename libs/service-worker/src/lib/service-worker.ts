/* eslint-disable no-restricted-globals */
/**
 * Service Worker MCP Server
 *
 * This service worker acts as an MCP (Model Context Protocol) server,
 * storing user events and exposing them via MCP protocol endpoints.
 */

declare const self: ServiceWorkerGlobalScope;

import { storeEvent, UserEvent } from './database';
import { mcpServer } from './mcp-server';
import { WebSocketTransport } from './websocket-transport';

const BACKEND_WS_URL = 'ws://localhost:3001';

let socket: WebSocket | null = null;
let transport: WebSocketTransport | null = null;
const messageQueue: any[] = [];

function connectWebSocket() {
  socket = new WebSocket(BACKEND_WS_URL);

  socket.onopen = async () => {
    console.log('Connected to backend MCP server');

    if (socket) {
      transport = new WebSocketTransport(socket);
      await mcpServer.connect(transport);
      console.log('MCP Server connected to WebSocket transport');
    }

    // Flush queue
    while (messageQueue.length > 0 && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(messageQueue.shift()));
    }
  };

  socket.onclose = async () => {
    console.log('Disconnected from backend MCP server, retrying in 5s...');
    if (transport) {
      await mcpServer.close();
      transport = null;
    }
    socket = null;
    setTimeout(connectWebSocket, 5000);
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// Initial connection
connectWebSocket();

// Handle messages from the main thread
self.addEventListener('message', async (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'STORE_EVENT') {
    try {
      const userEvent = event.data.event as UserEvent;
      // Primary context is pulled on demand from IndexedDB via request_context
      await storeEvent(userEvent);

      // Send confirmation back to the client
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    } catch (error) {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }
});

// Install and activate
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});
