/* eslint-disable no-restricted-globals */
/**
 * Service Worker MCP Server
 *
 * This service worker acts as an MCP (Model Context Protocol) server,
 * storing user events and exposing them via MCP protocol endpoints.
 */

declare const self: ServiceWorkerGlobalScope;

import { storeEvent } from './database';
import { processMcpRequest } from './mcp-server';

const MCP_ENDPOINT = '/mcp';

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
      await storeEvent(event.data.event);
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
