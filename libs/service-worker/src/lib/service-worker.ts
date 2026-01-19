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
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

async function connectWebSocket(): Promise<void> {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
    return;
  }

  return new Promise((resolve) => {
    socket = new WebSocket(BACKEND_WS_URL);

    socket.onopen = async () => {
      console.log('Connected to backend MCP server');
      reconnectAttempts = 0;

      if (socket) {
        transport = new WebSocketTransport(socket);
        await mcpServer.connect(transport);
        console.log('MCP Server connected to WebSocket transport');
      }
      resolve();
    };

    socket.onclose = async () => {
      console.log('Disconnected from backend MCP server');
      if (transport) {
        try {
          await mcpServer.close();
        } catch (error) {
          console.error('Error closing MCP server:', error);
        }
        transport = null;
      }
      socket = null;

      const delay = Math.min(
        INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
        MAX_RECONNECT_DELAY,
      );
      reconnectAttempts++;
      console.log(`Retrying in ${delay}ms...`);
      setTimeout(() => connectWebSocket(), delay);
      resolve(); // Resolve even on close to not block activate indefinitely if backend is down
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      // onclose will be called after onerror
    };
  });
}

// Handle messages from the main thread
self.addEventListener('message', async (event: ExtendableMessageEvent) => {
  if (!event.data) return;

  if (event.data.type === 'STORE_EVENT') {
    event.waitUntil((async () => {
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
    })());
  } else if (event.data.type === 'GET_EVENTS') {
    event.waitUntil((async () => {
      try {
        const { queryEvents } = await import('./database');
        const events = await queryEvents({ limit: 50 });
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true, events });
        }
      } catch (error) {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    })());
  }
});

// Install and activate
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      connectWebSocket(),
    ])
  );
});
