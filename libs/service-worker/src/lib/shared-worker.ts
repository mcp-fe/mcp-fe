/* eslint-disable no-restricted-globals */
/**
 * SharedWorker MCP Server
 *
 * This SharedWorker acts as an MCP (Model Context Protocol) server,
 * storing user events and exposing them via MCP protocol endpoints.
 * Falls back to ServiceWorker if SharedWorker is not supported.
 */

declare const self: SharedWorkerGlobalScope;

import { storeEvent, UserEvent } from './database';
import { mcpServer } from './mcp-server';
import { WebSocketTransport } from './websocket-transport';

const BACKEND_WS_URL = 'ws://localhost:3001';

let socket: WebSocket | null = null;
let transport: WebSocketTransport | null = null;
let reconnectAttempts = 0;
let authToken: string | null = null;
const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

// Track all connected ports
const connectedPorts: MessagePort[] = [];

function broadcastStatus(connected: boolean): void {
  connectedPorts.forEach((port) => {
    try {
      port.postMessage({
        type: 'CONNECTION_STATUS',
        connected,
      });
    } catch (error) {
      // Port may be closed, remove it
      const index = connectedPorts.indexOf(port);
      if (index > -1) {
        connectedPorts.splice(index, 1);
      }
    }
  });
}

async function connectWebSocket(): Promise<void> {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
    return;
  }

  return new Promise((resolve) => {
    // Append token to URL as query parameter for WebSocket auth
    const url = authToken ? `${BACKEND_WS_URL}?token=${authToken}` : BACKEND_WS_URL;
    socket = new WebSocket(url);

    socket.onopen = async () => {
      console.log('[SharedWorker] Connected to backend MCP server');
      reconnectAttempts = 0;
      broadcastStatus(true);

      if (socket) {
        transport = new WebSocketTransport(socket);
        await mcpServer.connect(transport);
        console.log('[SharedWorker] MCP Server connected to WebSocket transport');
      }
      resolve();
    };

    socket.onclose = async () => {
      console.log('[SharedWorker] Disconnected from backend MCP server');
      broadcastStatus(false);
      if (transport) {
        try {
          await mcpServer.close();
        } catch (error) {
          console.error('[SharedWorker] Error closing MCP server:', error);
        }
        transport = null;
      }
      socket = null;

      const delay = Math.min(
        INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
        MAX_RECONNECT_DELAY,
      );
      reconnectAttempts++;
      console.log(`[SharedWorker] Retrying in ${delay}ms...`);
      setTimeout(() => connectWebSocket(), delay);
      resolve(); // Resolve even on close to not block if backend is down
    };

    socket.onerror = (error) => {
      console.error('[SharedWorker] WebSocket error:', error);
      // onclose will be called after onerror
    };
  });
}

// Handle new connections
self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  connectedPorts.push(port);

  // Handle messages from connected clients
  port.onmessage = async (event: MessageEvent) => {
    if (!event.data) return;

    const messageData = event.data;

    if (messageData.type === 'SET_AUTH_TOKEN') {
      authToken = messageData.token;
      console.log('[SharedWorker] Received auth token, reconnecting WebSocket...');
      if (socket) {
        socket.close(); // This will trigger onclose and then connectWebSocket with new token
      } else {
        connectWebSocket();
      }
      return;
    }

    if (messageData.type === 'STORE_EVENT') {
      try {
        const userEvent = messageData.event as UserEvent;
        // Primary context is pulled on demand from IndexedDB via request_context
        await storeEvent(userEvent);

        // Send confirmation back to the client
        try {
          port.postMessage({ success: true });
        } catch (error) {
          // Port may be closed, remove it
          const index = connectedPorts.indexOf(port);
          if (index > -1) {
            connectedPorts.splice(index, 1);
          }
        }
      } catch (error) {
        try {
          port.postMessage({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        } catch {
          // Port may be closed, remove it
          const index = connectedPorts.indexOf(port);
          if (index > -1) {
            connectedPorts.splice(index, 1);
          }
        }
      }
    } else if (messageData.type === 'GET_EVENTS') {
      try {
        const { queryEvents } = await import('./database');
        const events = await queryEvents({ limit: 50 });
        try {
          port.postMessage({ success: true, events });
        } catch (error) {
          // Port may be closed, remove it
          const index = connectedPorts.indexOf(port);
          if (index > -1) {
            connectedPorts.splice(index, 1);
          }
        }
      } catch (error) {
        try {
          port.postMessage({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        } catch {
          // Port may be closed, remove it
          const index = connectedPorts.indexOf(port);
          if (index > -1) {
            connectedPorts.splice(index, 1);
          }
        }
      }
    } else if (messageData.type === 'GET_CONNECTION_STATUS') {
      try {
        port.postMessage({
          success: true,
          connected: socket?.readyState === WebSocket.OPEN,
        });
      } catch (error) {
        // Port may be closed, remove it
        const index = connectedPorts.indexOf(port);
        if (index > -1) {
          connectedPorts.splice(index, 1);
        }
      }
    }
  };

  // Send initial connection status
  port.postMessage({
    type: 'CONNECTION_STATUS',
    connected: socket?.readyState === WebSocket.OPEN,
  });
};

// Connect WebSocket on SharedWorker initialization
connectWebSocket();
