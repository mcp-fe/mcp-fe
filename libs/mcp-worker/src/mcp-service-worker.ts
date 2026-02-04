/**
 * Service Worker MCP Server
 *
 * This service worker acts as an MCP (Model Context Protocol) server,
 * storing user events and exposing them via MCP protocol endpoints.
 */

declare const self: ServiceWorkerGlobalScope;

import type { UserEvent } from './lib/database';
import { MCPController } from './lib/mcp-controller';
import { logger } from './lib/logger';

// Controller is only created after INIT with backendUrl. Client must send INIT.
let controller: MCPController | null = null;
let backendUrl: string | null = null;
// Pending token stored if SET_AUTH_TOKEN arrives before INIT
let pendingToken: string | null = null;
const getController = () => {
  if (!controller) throw new Error('Worker not initialized (no backendUrl)');
  return controller;
};
const setBackendUrl = (url: string) => {
  backendUrl = url;
  controller = null;
  controller = MCPController.create(url, (message: unknown) => {
    self.clients
      .matchAll()
      .then((clients) => {
        clients.forEach((client) => {
          try {
            client.postMessage(message);
          } catch (e) {
            logger.error(
              '[ServiceWorker] Failed to post message to client:',
              e,
            );
          }
        });
      })
      .catch((err) => {
        logger.error(
          '[ServiceWorker] Failed to match clients for broadcast:',
          err,
        );
      });
  });
  return controller;
};

// Handle messages from the main thread
self.addEventListener('message', async (event: ExtendableMessageEvent) => {
  if (!event.data) return;

  const msg = event.data as Record<string, unknown>;

  if (msg['type'] === 'INIT') {
    const url = msg['backendUrl'] as string | undefined;
    if (!url) {
      logger.error('[ServiceWorker] INIT missing backendUrl');
      return;
    }
    try {
      setBackendUrl(url);
      const token = msg['token'] as string | undefined;
      // Apply token from INIT if present; otherwise apply any pending token
      if (token) {
        getController().setAuthToken(token);
      } else if (pendingToken) {
        getController().setAuthToken(pendingToken);
        pendingToken = null;
      }
    } catch (e) {
      logger.error('[ServiceWorker] Failed to apply INIT:', e);
    }
    return;
  }

  if (msg['type'] === 'SET_AUTH_TOKEN') {
    const token = msg['token'] as string | undefined;
    if (!token) return;
    try {
      if (controller) {
        getController().setAuthToken(token);
      } else {
        // store until INIT arrives
        pendingToken = token;
      }
    } catch (e) {
      logger.error('[ServiceWorker] Failed to set auth token:', e);
    }
    return;
  }

  if (msg['type'] === 'STORE_EVENT') {
    event.waitUntil(
      (async () => {
        try {
          if (!backendUrl || !controller) {
            // Only send error if client expects a response (via MessageChannel)
            if (event.ports && event.ports[0]) {
              event.ports[0].postMessage({
                success: false,
                error: 'Worker not initialized',
              });
            } else {
              logger.warn('[ServiceWorker] STORE_EVENT before INIT, ignoring');
            }
            return;
          }
          const userEvent = event.data.event as UserEvent;
          await getController().handleStoreEvent(userEvent);

          // Only send response if client expects it (via MessageChannel)
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        } catch (error) {
          logger.error('[ServiceWorker] Failed to store event:', error);
          // Only send error if client expects a response
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to store event',
            });
          }
        }
      })(),
    );
    return;
  }

  if (msg['type'] === 'GET_EVENTS') {
    event.waitUntil(
      (async () => {
        try {
          if (!backendUrl || !controller) {
            if (event.ports && event.ports[0]) {
              event.ports[0].postMessage({
                success: false,
                error: 'Worker not initialized',
              });
            }
            return;
          }
          const events = await getController().handleGetEvents();
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true, events });
          }
        } catch (error) {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Worker not initialized',
            });
          }
        }
      })(),
    );
    return;
  }

  if (msg['type'] === 'GET_CONNECTION_STATUS') {
    if (event.ports && event.ports[0]) {
      if (!backendUrl || !controller) {
        event.ports[0].postMessage({
          success: false,
          error: 'Worker not initialized',
        });
      } else {
        event.ports[0].postMessage({
          success: true,
          connected: getController().getConnectionStatus(),
        });
      }
    }
    return;
  }

  if (msg['type'] === 'REGISTER_TAB') {
    try {
      if (controller) {
        getController().handleRegisterTab(msg as Record<string, unknown>);
      }
    } catch (error) {
      logger.error('[ServiceWorker] Failed to register tab:', error);
    }
    return;
  }

  if (msg['type'] === 'SET_ACTIVE_TAB') {
    try {
      if (controller) {
        getController().handleSetActiveTab(msg as Record<string, unknown>);
      }
    } catch (error) {
      logger.error('[ServiceWorker] Failed to set active tab:', error);
    }
    return;
  }

  if (msg['type'] === 'REGISTER_TOOL') {
    event.waitUntil(
      (async () => {
        try {
          if (!backendUrl || !controller) {
            if (event.ports && event.ports[0]) {
              event.ports[0].postMessage({
                success: false,
                error: 'Worker not initialized',
              });
            }
            return;
          }
          const toolData = msg as Record<string, unknown>;
          await getController().handleRegisterTool(toolData);
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        } catch (error) {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to register tool',
            });
          }
        }
      })(),
    );
    return;
  }

  if (msg['type'] === 'UNREGISTER_TOOL') {
    event.waitUntil(
      (async () => {
        try {
          if (!backendUrl || !controller) {
            if (event.ports && event.ports[0]) {
              event.ports[0].postMessage({
                success: false,
                error: 'Worker not initialized',
              });
            }
            return;
          }
          const toolName = msg['name'] as string | undefined;
          if (!toolName) {
            if (event.ports && event.ports[0]) {
              event.ports[0].postMessage({
                success: false,
                error: 'Tool name is required',
              });
            }
            return;
          }
          const success = await getController().handleUnregisterTool(toolName);
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success });
          }
        } catch (error) {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to unregister tool',
            });
          }
        }
      })(),
    );
    return;
  }

  if (msg['type'] === 'TOOL_CALL_RESULT') {
    // Main thread is sending back the result of a tool call
    try {
      if (!controller) {
        logger.warn(
          '[ServiceWorker] Received TOOL_CALL_RESULT but no controller',
        );
        return;
      }
      const callId = msg['callId'] as string | undefined;
      if (!callId) {
        logger.warn('[ServiceWorker] TOOL_CALL_RESULT missing callId');
        return;
      }
      getController().handleToolCallResult(callId, msg);
    } catch (error) {
      logger.error('[ServiceWorker] Failed to handle TOOL_CALL_RESULT:', error);
    }
    return;
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
  event.waitUntil(Promise.resolve(self.clients.claim()));
});
