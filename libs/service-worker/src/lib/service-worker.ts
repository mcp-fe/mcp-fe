/* eslint-disable no-restricted-globals */
/**
 * Service Worker MCP Server
 *
 * This service worker acts as an MCP (Model Context Protocol) server,
 * storing user events and exposing them via MCP protocol endpoints.
 */

declare const self: ServiceWorkerGlobalScope;

import { storeEvent, UserEvent } from './database';
import { processMcpRequest } from './mcp-server';

const MCP_ENDPOINT = '/mcp';
const BACKEND_WS_URL = 'ws://localhost:3001';

let socket: WebSocket | null = null;
const messageQueue: any[] = [];

function connectWebSocket() {
  socket = new WebSocket(BACKEND_WS_URL);

  socket.onopen = () => {
    console.log('Connected to backend MCP server');
    // Flush queue
    while (messageQueue.length > 0 && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(messageQueue.shift()));
    }
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.jsonrpc === '2.0') {
        // Handle MCP protocol messages from backend
        console.log(`[SW] Received MCP request: ${message.method} (id: ${message.id})`);
        const response = await processMcpRequest(message);
        console.log(`[SW] Sending response for id: ${message.id}`);
        socket?.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  };

  socket.onclose = () => {
    console.log('Disconnected from backend MCP server, retrying in 5s...');
    socket = null;
    setTimeout(connectWebSocket, 5000);
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// Initial connection
connectWebSocket();


// Handle MCP protocol requests via HTTP
async function handleMCPRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);

    const path = url.pathname;

    // Health check
    if (path === `${MCP_ENDPOINT}/health` && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          server: 'user-activity-mcp-server',
          version: '1.0.0',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Handle MCP JSON-RPC requests
    if (path === MCP_ENDPOINT && request.method === 'POST') {
      const body = await request.json();

      try {
        const response = await processMcpRequest(body);
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            error: {
              code: -32603,
              message:
                error instanceof Error ? error.message : 'Internal error',
            },
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    return new Response('Not Found', { status: 404 });
  } catch (error) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// Handle messages from the main thread
self.addEventListener('message', async (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'STORE_EVENT') {
    try {
      const userEvent = event.data.event as UserEvent;
      // Primary context is pulled on demand from IndexedDB via request_context
      await storeEvent(userEvent);
      if (socket) {
        socket.send(JSON.stringify(userEvent));
      }
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

// Handle fetch events for MCP endpoints
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);
  // Only handle MCP endpoints (same-origin requests are handled automatically)
  if (url.pathname.startsWith(MCP_ENDPOINT)) {
    event.respondWith(handleMCPRequest(event.request));
  }
});

// Install and activate
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});
