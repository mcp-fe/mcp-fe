/* eslint-disable no-restricted-globals */
/**
 * SharedWorker MCP Server
 *
 * This SharedWorker acts as an MCP (Model Context Protocol) server,
 * storing user events and exposing them via MCP protocol endpoints.
 * Falls back to ServiceWorker if SharedWorker is not supported.
 *
 * IMPORTANT: SharedWorker Lifetime Limitations
 * According to HTML spec (https://html.spec.whatwg.org/multipage/workers.html#the-worker's-lifetime):
 * - SharedWorkers can be SUSPENDED when not actively needed (page in background, etc.)
 * - When suspended, timers don't fire and network connections may be paused
 * - SharedWorkers are "protected" (not suspended) if they have:
 *   - Active MessagePorts (connected clients)
 *   - Outstanding timers
 *   - Database transactions
 *   - Network connections (like WebSocket)
 * - However, if ALL pages disconnect, the worker will eventually be terminated
 *
 * This implementation uses:
 * - Keep-alive timer to maintain "protected" status
 * - WebSocket connection (also keeps worker protected)
 * - Active ports tracking (keeps worker protected)
 *
 * Note: ServiceWorker is more reliable for persistent connections as it's designed
 * to stay alive longer and handle background tasks better.
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

// Keep-alive mechanism to prevent worker suspension
// According to HTML spec, workers with outstanding timers are "protected"
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

function startKeepAlive(): void {
  // Clear any existing interval
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  // Set up a keep-alive timer that fires every 20 seconds
  // This keeps the worker "protected" according to the spec:
  // "If global has outstanding timers, database transactions, or network connections, then return true"
  keepAliveInterval = setInterval(() => {
    // Just keep the timer running - this prevents suspension
    // We can also use this to send periodic pings if needed
    if (socket?.readyState === WebSocket.OPEN) {
      // WebSocket is open, worker should stay protected
      // Optionally send a ping to keep the connection alive
      try {
        socket.send(JSON.stringify({ type: 'ping' }));
      } catch (error) {
        // Connection might be closed, will reconnect
      }
    }
  }, 20000); // 20 seconds - keeps worker protected
}

function stopKeepAlive(): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

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

  // If no ports are connected, stop keep-alive (worker will be terminated anyway)
  if (connectedPorts.length === 0) {
    stopKeepAlive();
  }
}

async function connectWebSocket(): Promise<void> {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
    return;
  }

  // Clean up existing transport and socket
  if (transport) {
    try {
      await mcpServer.close();
    } catch (error) {
      console.error('[SharedWorker] Error closing MCP server:', error);
    }
    transport = null;
  }

  if (socket) {
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
    socket = null;
  }

  return new Promise((resolve, reject) => {
    // Append token to URL as query parameter for WebSocket auth
    const url = authToken ? `${BACKEND_WS_URL}?token=${authToken}` : BACKEND_WS_URL;
    socket = new WebSocket(url);

    socket.onopen = async () => {
      console.log('[SharedWorker] Connected to backend MCP server');
      reconnectAttempts = 0;

      try {
        if (socket) {
          transport = new WebSocketTransport(socket);
          // Start the transport to set up event listeners
          await transport.start();
          // Connect the MCP server to the transport
          await mcpServer.connect(transport);
          console.log('[SharedWorker] MCP Server connected to WebSocket transport');

          // Start keep-alive to prevent worker suspension
          // The WebSocket connection + keep-alive timer keeps the worker "protected"
          startKeepAlive();

          broadcastStatus(true);
          resolve();
        }
      } catch (error) {
        console.error('[SharedWorker] Error setting up MCP server:', error);
        broadcastStatus(false);
        if (socket) {
          socket.close();
        }
        // Don't reject - let the onclose handler manage reconnection
        // This prevents unhandled promise rejections
        resolve();
      }
    };

    socket.onclose = async (event) => {
      console.log('[SharedWorker] Disconnected from backend MCP server', event.code, event.reason);
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

      // Only reconnect if it wasn't a manual close (code 1000)
      if (event.code !== 1000) {
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
          MAX_RECONNECT_DELAY,
        );
        reconnectAttempts++;
        console.log(`[SharedWorker] Retrying in ${delay}ms...`);
        setTimeout(() => connectWebSocket(), delay);
      }

      resolve(); // Resolve even on close to not block if backend is down
    };

    socket.onerror = (event) => {
      console.error('[SharedWorker] WebSocket error:', event);
      broadcastStatus(false);
      // onclose will be called after onerror
      // Don't reject here - let onclose handle the reconnection logic
      // Rejecting here can cause unhandled promise rejections
    };
  });
}


// Handle new connections
self.onconnect = (event: MessageEvent) => {
  // Connect WebSocket on SharedWorker initialization
  // Note: This will connect without auth token initially, but will reconnect when auth token is received
  connectWebSocket().catch((error) => {
    console.error('[SharedWorker] Initial WebSocket connection failed:', error);
  });

  const port = event.ports[0];
  connectedPorts.push(port);

  // Start keep-alive when first port connects
  // Having active ports keeps the worker "protected" according to spec
  if (connectedPorts.length === 1) {
    startKeepAlive();
  }

  // Handle messages from connected clients
  port.onmessage = async (event: MessageEvent) => {
    if (!event.data) return;

    const messageData = event.data;

    if (messageData.type === 'SET_AUTH_TOKEN') {
      console.log('set auth token', messageData);
      const newToken = messageData.token;
      const tokenChanged = authToken !== newToken;
      authToken = newToken;

      if (tokenChanged) {
        console.log(
          '[SharedWorker] Received auth token, reconnecting WebSocket...',
        );
        // Close existing connection to reconnect with new token
        if (
          socket &&
          (socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING)
        ) {
          // Close with code 1000 (normal closure) to prevent auto-reconnect
          socket.close(1000, 'Reconnecting with new auth token');
        }
        // Wait a bit then reconnect with new token
        setTimeout(() => {
          connectWebSocket().catch((error) => {
            console.error(
              '[SharedWorker] Failed to reconnect with new token:',
              error,
            );
          });
        }, 100);
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

  // Handle port disconnection
  self.onerror = () => {
    const index = connectedPorts.indexOf(port);
    if (index > -1) {
      connectedPorts.splice(index, 1);
      console.log(
        '[SharedWorker] Port disconnected, remaining ports:',
        connectedPorts.length,
      );

      // If no ports remain, stop keep-alive (worker may be terminated)
      if (connectedPorts.length === 0) {
        console.log(
          '[SharedWorker] No active ports, worker may be suspended/terminated',
        );
        stopKeepAlive();
      }
    }
  };

  // Send initial connection status
  port.postMessage({
    type: 'CONNECTION_STATUS',
    connected: socket?.readyState === WebSocket.OPEN,
  });
};
