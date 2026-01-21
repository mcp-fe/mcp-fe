/* eslint-disable no-restricted-globals */
/**
 * SharedWorker MCP Server
 *
 * This SharedWorker acts as an MCP (Model Context Protocol) server,
 * storing user events and exposing them via MCP protocol endpoints.
 * Falls back to ServiceWorker if SharedWorker is not supported.
 */

declare const self: SharedWorkerGlobalScope;

import { UserEvent } from './database';
import { MCPController } from './mcp-controller';

const BACKEND_WS_URL = 'ws://localhost:3001';

// Track all connected ports
const connectedPorts: MessagePort[] = [];

// Create controller with a broadcast function that posts to all connected ports
const controller = new MCPController(BACKEND_WS_URL, (message: unknown) => {
  connectedPorts.forEach((port) => {
    try {
      port.postMessage(message);
    } catch (error) {
      const idx = connectedPorts.indexOf(port);
      if (idx > -1) connectedPorts.splice(idx, 1);
    }
  });
});

// Ensure we try to connect when the worker starts
controller.connectWebSocket().catch((err) => {
  console.error('[SharedWorker] Initial WebSocket connection failed:', err);
});

// Handle new connections
self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  connectedPorts.push(port);

  // Send initial connection status
  try {
    port.postMessage({ type: 'CONNECTION_STATUS', connected: controller.getConnectionStatus() });
  } catch (err) {
    console.error('[SharedWorker] Failed to post initial status to port:', err);
  }

  port.onmessage = async (ev: MessageEvent) => {
    if (!ev.data) return;
    const messageData = ev.data;

    if (messageData.type === 'SET_AUTH_TOKEN') {
      const newToken = (messageData as any).token as string | null;
      controller.setAuthToken(newToken);
      return;
    }

    if (messageData.type === 'STORE_EVENT') {
      try {
        const userEvent = messageData.event as UserEvent;
        await controller.handleStoreEvent(userEvent);
        try {
          port.postMessage({ success: true });
        } catch (error) {
          console.error('[SharedWorker] Failed to post success to port:', error);
        }
      } catch (error) {
        try {
          port.postMessage({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        } catch (e) {
          console.error('[SharedWorker] Failed to post failure to port:', e);
        }
      }

      return;
    }

    if (messageData.type === 'GET_EVENTS') {
      try {
        const events = await controller.handleGetEvents();
        try {
          port.postMessage({ success: true, events });
        } catch (error) {
          console.error('[SharedWorker] Failed to post events to port:', error);
        }
      } catch (error) {
        try {
          port.postMessage({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        } catch (e) {
          console.error('[SharedWorker] Failed to post failure to port:', e);
        }
      }
      return;
    }

    if (messageData.type === 'GET_CONNECTION_STATUS') {
      try {
        port.postMessage({ success: true, connected: controller.getConnectionStatus() });
      } catch (error) {
        console.error('[SharedWorker] Failed to post connection status to port:', error);
      }
      return;
    }
  };

  // Handle port disconnection
  port.onmessageerror = () => {
    const index = connectedPorts.indexOf(port);
    if (index > -1) {
      connectedPorts.splice(index, 1);
    }
  };
};
