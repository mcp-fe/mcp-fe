/**
 * Service Worker MCP Server
 *
 * This service worker acts as an MCP (Model Context Protocol) server,
 * storing user events and exposing them via MCP protocol endpoints.
 */

declare const self: ServiceWorkerGlobalScope;

import { UserEvent } from './lib/database';
import { MCPController } from './lib/mcp-controller';

const BACKEND_WS_URL = 'ws://localhost:3001';

// Broadcast to all clients
const controller = new MCPController(BACKEND_WS_URL, (message: unknown) => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      try {
        client.postMessage(message);
      } catch (e) {
        // ignore
        console.error('[ServiceWorker] Failed to post message to client:', e);
      }
    });
  }).catch((err) => {
    console.error('[ServiceWorker] Failed to match clients for broadcast:', err);
  });
});

// Handle messages from the main thread
self.addEventListener('message', async (event: ExtendableMessageEvent) => {
  if (!event.data) return;

  if (event.data.type === 'SET_AUTH_TOKEN') {
    controller.setAuthToken(event.data.token);
    return;
  }

  if (event.data.type === 'STORE_EVENT') {
    event.waitUntil((async () => {
      try {
        const userEvent = event.data.event as UserEvent;
        await controller.handleStoreEvent(userEvent);

        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      } catch (error) {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    })());
  } else if (event.data.type === 'GET_EVENTS') {
    event.waitUntil((async () => {
      try {
        const events = await controller.handleGetEvents();
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true, events });
        }
      } catch (error) {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    })());
  } else if (event.data.type === 'GET_CONNECTION_STATUS') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true, connected: controller.getConnectionStatus() });
    }
  }
});

// Install and activate
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  // Do not automatically start the WebSocket connection here.
  // If a client intends to use the service worker it will send messages
  // (e.g. SET_AUTH_TOKEN) and the controller will connect on demand.
  event.waitUntil(
    Promise.resolve(self.clients.claim())
  );
});
