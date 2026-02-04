/**
 * SharedWorker MCP Server
 *
 * This SharedWorker acts as an MCP (Model Context Protocol) server,
 * storing user events and exposing them via MCP protocol endpoints.
 * Falls back to ServiceWorker if SharedWorker is not supported.
 */

declare const self: SharedWorkerGlobalScope;

import type { UserEvent } from './lib/database';
import { MCPController } from './lib/mcp-controller';
import { logger } from './lib/logger';

// Track all connected ports
const connectedPorts: MessagePort[] = [];

// Controller is created only after INIT with backendUrl
let controller: MCPController | null = null;
let backendUrl: string | null = null;
// Pending token stored if SET_AUTH_TOKEN arrives before INIT
let pendingToken: string | null = null;
const getController = () => {
  if (!controller) throw new Error('Worker not initialized (no backendUrl)');
  return controller;
};
const setBackendUrl = (url: string) => {
  // If controller already exists with same URL, reuse it
  if (controller && backendUrl === url) {
    logger.log(
      '[SharedWorker] Controller already initialized with same URL, reusing',
    );
    return controller;
  }

  // Only recreate if URL changed or no controller exists
  if (backendUrl !== url) {
    logger.log(
      `[SharedWorker] Initializing/updating controller with URL: ${url}`,
    );
    backendUrl = url;

    // Close old controller if exists
    if (controller) {
      try {
        controller.dispose();
      } catch (e) {
        logger.warn('[SharedWorker] Failed to dispose old controller:', e);
      }
    }

    controller = MCPController.create(url, (message: unknown) => {
      connectedPorts.forEach((port) => {
        try {
          port.postMessage(message);
        } catch (error) {
          const idx = connectedPorts.indexOf(port);
          if (idx > -1) connectedPorts.splice(idx, 1);
          logger.debug(
            '[SharedWorker] Failed to broadcast to a port (removed):',
            error,
          );
        }
      });
    });
  }

  return controller;
};

// Handle new connections
self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  connectedPorts.push(port);

  // Send initial connection status (only if initialized)
  try {
    const connected = controller
      ? getController().getConnectionStatus()
      : false;
    port.postMessage({ type: 'CONNECTION_STATUS', connected });
  } catch (err: unknown) {
    logger.error('[SharedWorker] Failed to post initial status to port:', err);
  }

  port.onmessage = async (ev: MessageEvent) => {
    if (!ev.data) return;
    const messageData = ev.data;

    if (messageData.type === 'INIT') {
      const url = (messageData as Record<string, unknown>)['backendUrl'] as
        | string
        | undefined;
      if (!url) {
        try {
          port.postMessage({
            success: false,
            error: 'INIT missing backendUrl',
          });
        } catch (e: unknown) {
          logger.debug(
            '[SharedWorker] Failed to reply to INIT with missing backendUrl:',
            e,
          );
        }
        return;
      }
      try {
        setBackendUrl(url);
        const token = (messageData as Record<string, unknown>)['token'] as
          | string
          | undefined;
        if (token) {
          getController().setAuthToken(token);
        } else if (pendingToken) {
          getController().setAuthToken(pendingToken);
          pendingToken = null;
        }
        try {
          port.postMessage({ success: true });
        } catch (e: unknown) {
          logger.debug(
            '[SharedWorker] Failed to post INIT success to port:',
            e,
          );
        }
      } catch (e: unknown) {
        try {
          port.postMessage({ success: false, error: String(e) });
        } catch (er: unknown) {
          logger.debug(
            '[SharedWorker] Failed to post INIT failure to port:',
            er,
          );
        }
      }
      return;
    }

    if (messageData.type === 'SET_AUTH_TOKEN') {
      const newToken = (messageData as Record<string, unknown>)['token'] as
        | string
        | null;
      if (!newToken) return;
      if (controller) {
        try {
          getController().setAuthToken(newToken);
        } catch (e: unknown) {
          logger.error('[SharedWorker] Failed to set auth token:', e);
        }
      } else {
        // store until INIT arrives
        pendingToken = newToken;
      }
      return;
    }

    if (messageData.type === 'SET_BACKEND_URL') {
      const url = (messageData as Record<string, unknown>)['url'] as
        | string
        | undefined;
      if (!url) return;
      try {
        setBackendUrl(url);
        if (pendingToken) {
          try {
            getController().setAuthToken(pendingToken);
            pendingToken = null;
          } catch (e: unknown) {
            logger.error(
              '[SharedWorker] Failed to set pending auth token after SET_BACKEND_URL:',
              e,
            );
          }
        }
      } catch (e: unknown) {
        logger.error('[SharedWorker] Failed to set backend URL:', e);
      }
      return;
    }

    if (messageData.type === 'REGISTER_TAB') {
      try {
        if (controller) {
          getController().handleRegisterTab(
            messageData as Record<string, unknown>,
          );
        }
      } catch (e: unknown) {
        logger.error('[SharedWorker] Failed to register tab:', e);
      }
      return;
    }

    if (messageData.type === 'SET_ACTIVE_TAB') {
      try {
        if (controller) {
          getController().handleSetActiveTab(
            messageData as Record<string, unknown>,
          );
        }
      } catch (e: unknown) {
        logger.error('[SharedWorker] Failed to set active tab:', e);
      }
      return;
    }

    if (messageData.type === 'REGISTER_TOOL') {
      const replyPort = ev.ports && ev.ports.length > 0 ? ev.ports[0] : port;
      try {
        if (!backendUrl || !controller) {
          try {
            replyPort.postMessage({
              success: false,
              error: 'Worker not initialized',
            });
          } catch (e: unknown) {
            logger.debug(
              '[SharedWorker] Failed to post uninitialized error for REGISTER_TOOL:',
              e,
            );
          }
          return;
        }
        const toolData = messageData as Record<string, unknown>;
        await getController().handleRegisterTool(toolData);
        try {
          replyPort.postMessage({ success: true });
        } catch (e: unknown) {
          logger.debug(
            '[SharedWorker] Failed to post REGISTER_TOOL success to port:',
            e,
          );
        }
      } catch (error: unknown) {
        try {
          replyPort.postMessage({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to register tool',
          });
        } catch (e: unknown) {
          logger.error(
            '[SharedWorker] Failed to post REGISTER_TOOL failure to port:',
            e,
          );
        }
      }
      return;
    }

    if (messageData.type === 'UNREGISTER_TOOL') {
      const replyPort = ev.ports && ev.ports.length > 0 ? ev.ports[0] : port;
      try {
        if (!backendUrl || !controller) {
          try {
            replyPort.postMessage({
              success: false,
              error: 'Worker not initialized',
            });
          } catch (e: unknown) {
            logger.debug(
              '[SharedWorker] Failed to post uninitialized error for UNREGISTER_TOOL:',
              e,
            );
          }
          return;
        }
        const toolName = (messageData as Record<string, unknown>)['name'] as
          | string
          | undefined;
        const tabId = (messageData as Record<string, unknown>)['tabId'] as
          | string
          | undefined;

        if (!toolName) {
          try {
            replyPort.postMessage({
              success: false,
              error: 'Tool name is required',
            });
          } catch (e: unknown) {
            logger.debug(
              '[SharedWorker] Failed to post missing name error for UNREGISTER_TOOL:',
              e,
            );
          }
          return;
        }

        const success = await getController().handleUnregisterTool(
          toolName,
          tabId,
        );
        try {
          replyPort.postMessage({ success });
        } catch (e: unknown) {
          logger.debug(
            '[SharedWorker] Failed to post UNREGISTER_TOOL result to port:',
            e,
          );
        }
      } catch (error: unknown) {
        try {
          replyPort.postMessage({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to unregister tool',
          });
        } catch (e: unknown) {
          logger.error(
            '[SharedWorker] Failed to post UNREGISTER_TOOL failure to port:',
            e,
          );
        }
      }
      return;
    }

    if (messageData.type === 'TOOL_CALL_RESULT') {
      // Main thread is sending back the result of a tool call
      try {
        if (!controller) {
          logger.warn(
            '[SharedWorker] Received TOOL_CALL_RESULT but no controller',
          );
          return;
        }
        const callId = messageData['callId'] as string | undefined;
        if (!callId) {
          logger.warn('[SharedWorker] TOOL_CALL_RESULT missing callId');
          return;
        }
        getController().handleToolCallResult(callId, messageData);
      } catch (error: unknown) {
        logger.error(
          '[SharedWorker] Failed to handle TOOL_CALL_RESULT:',
          error,
        );
      }
      return;
    }

    if (messageData.type === 'STORE_EVENT') {
      // Reply via MessageChannel port if provided, otherwise fire-and-forget
      const hasReplyPort = ev.ports && ev.ports.length > 0;
      const replyPort = hasReplyPort ? ev.ports[0] : null;

      try {
        if (!backendUrl || !controller) {
          // Only send error if client expects a response
          if (replyPort) {
            try {
              replyPort.postMessage({
                success: false,
                error: 'Worker not initialized',
              });
            } catch (e: unknown) {
              logger.debug(
                '[SharedWorker] Failed to post uninitialized error for STORE_EVENT:',
                e,
              );
            }
          } else {
            logger.warn('[SharedWorker] STORE_EVENT before INIT, ignoring');
          }
          return;
        }

        const userEvent = messageData.event as UserEvent;
        await getController().handleStoreEvent(userEvent);

        // Only send response if client expects it
        if (replyPort) {
          try {
            replyPort.postMessage({ success: true });
          } catch (e: unknown) {
            logger.debug(
              '[SharedWorker] Failed to post STORE_EVENT success to port:',
              e,
            );
          }
        }
      } catch (error: unknown) {
        logger.error('[SharedWorker] Failed to store event:', error);
        // Only send error if client expects a response
        if (replyPort) {
          try {
            replyPort.postMessage({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to store event',
            });
          } catch (e: unknown) {
            logger.error('[SharedWorker] Failed to post failure to port:', e);
          }
        }
      }

      return;
    }

    if (messageData.type === 'GET_EVENTS') {
      // Reply via MessageChannel port if provided (for request/response pattern)
      const replyPort = ev.ports && ev.ports.length > 0 ? ev.ports[0] : port;
      try {
        if (!backendUrl || !controller) {
          try {
            replyPort.postMessage({
              success: false,
              error: 'Worker not initialized',
            });
          } catch (e: unknown) {
            logger.debug(
              '[SharedWorker] Failed to post uninitialized error for GET_EVENTS:',
              e,
            );
          }
          return;
        }
        const events = await getController().handleGetEvents();
        try {
          replyPort.postMessage({ success: true, events });
        } catch (error) {
          logger.error('[SharedWorker] Failed to post events to port:', error);
        }
      } catch (error: unknown) {
        try {
          replyPort.postMessage({
            success: false,
            error:
              error instanceof Error ? error.message : 'Worker not initialized',
          });
        } catch (e: unknown) {
          logger.error('[SharedWorker] Failed to post failure to port:', e);
        }
      }
      return;
    }

    if (messageData.type === 'GET_CONNECTION_STATUS') {
      // Reply via MessageChannel port if provided (for request/response pattern)
      const replyPort = ev.ports && ev.ports.length > 0 ? ev.ports[0] : port;
      try {
        if (!backendUrl || !controller) {
          try {
            replyPort.postMessage({
              success: false,
              error: 'Worker not initialized',
            });
          } catch (e: unknown) {
            logger.debug(
              '[SharedWorker] Failed to post uninitialized error for GET_CONNECTION_STATUS:',
              e,
            );
          }
          return;
        }
        replyPort.postMessage({
          success: true,
          connected: getController().getConnectionStatus(),
        });
      } catch (error: unknown) {
        logger.debug('[SharedWorker] GET_CONNECTION_STATUS failed:', error);
        try {
          replyPort.postMessage({
            success: false,
            error: 'Worker not initialized',
          });
        } catch (e: unknown) {
          logger.debug(
            '[SharedWorker] Failed to post GET_CONNECTION_STATUS failure:',
            e,
          );
        }
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
