import { WebSocket } from 'ws';
import { SessionManager } from './session-manager';

/**
 * WebSocket Manager - handles WebSocket communication with service workers
 *
 * Responsibilities:
 * - Track pending requests/responses
 * - Send and receive JSON-RPC messages
 * - Handle timeouts
 *
 * Session state management is delegated to SessionManager
 */
export class WebSocketManager {
  // Track pending requests: key = `${sessionId}:${requestId}`, value = resolve/reject handlers
  private pendingRequests = new Map<
    string,
    { resolve: (value: any) => void; reject: (error: any) => void }
  >();

  constructor(private sessionManager: SessionManager) {}

  /**
   * Register a WebSocket connection for a session in SessionManager
   */
  registerSession(sessionId: string, ws: WebSocket): void {
    console.log(`[WS] Registered WebSocket for session: ${sessionId}`);
    this.sessionManager.registerWebSocket(sessionId, ws);
  }

  /**
   * Unregister a WebSocket connection for a session from SessionManager
   */
  unregisterSession(sessionId: string): void {
    console.log(`[WS] Unregistered WebSocket for session: ${sessionId}`);
    // Clear any pending requests for this session
    for (const key of this.pendingRequests.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        const handler = this.pendingRequests.get(key);
        if (handler) {
          handler.reject(
            new Error(`WebSocket disconnected for session ${sessionId}`),
          );
        }
        this.pendingRequests.delete(key);
      }
    }
    this.sessionManager.unregisterWebSocket(sessionId);
  }

  /**
   * Handle a message from a service worker (typically a response to a request)
   */
  handleMessage(sessionId: string, message: any): void {
    // Handle MCP protocol messages (JSON-RPC)
    if (message.jsonrpc === '2.0' && message.id !== undefined) {
      // Handle responses (result or error)
      if (message.result !== undefined || message.error !== undefined) {
        const handlerKey = `${sessionId}:${message.id}`;
        const handler = this.pendingRequests.get(handlerKey);

        if (handler) {
          console.debug(
            `[WS] Response handler found for session ${sessionId}, id: ${message.id}`,
          );
          if (message.error) {
            handler.reject(
              new Error(
                message.error.message || 'Unknown error from Service Worker',
              ),
            );
          } else {
            handler.resolve(message);
          }
          this.pendingRequests.delete(handlerKey);
        } else {
          console.warn(
            `[WS] No pending request handler found for session ${sessionId}, id: ${message.id}`,
          );
        }
      }
    }
  }

  /**
   * Send a message to service worker and wait for response
   * Delegated to SessionManager for WebSocket retrieval
   */
  async callServiceWorkerTool(sessionId: string, message: any): Promise<any> {
    // Get WebSocket from SessionManager
    const ws = this.sessionManager.getWebSocket(sessionId);
    if (!ws) {
      console.error(`[WS] No WebSocket connected for session: ${sessionId}`);
      throw new Error(`No Service Worker connected for session: ${sessionId}`);
    }

    // Ensure message has a unique ID
    const requestId = message.id || Math.random().toString(36).substring(7);
    const mcpMessage = { ...message, id: requestId };
    const handlerKey = `${sessionId}:${requestId}`;

    console.debug(
      `[WS] Sending request to SW (${sessionId}): ${mcpMessage.method} (id: ${requestId})`,
    );

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(handlerKey);
        console.error(
          `[WS] Timeout waiting for SW response for session ${sessionId}, id: ${requestId} (15s)`,
        );
        reject(
          new Error(
            `Timeout waiting for Service Worker response (method: ${mcpMessage.method})`,
          ),
        );
      }, 15000);

      this.pendingRequests.set(handlerKey, {
        resolve: (data) => {
          console.debug(
            `[WS] Received response from SW for session ${sessionId}, id: ${requestId}`,
          );
          clearTimeout(timeout);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      try {
        ws.send(JSON.stringify(mcpMessage));
        console.debug(`[WS] Message sent successfully to SW (${sessionId})`);
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(handlerKey);
        console.error(
          `[WS] Error sending message to SW (${sessionId}):`,
          err instanceof Error ? err.message : String(err),
        );
        reject(err);
      }
    });
  }

  /**
   * Get diagnostic info about WebSocket pending requests
   */
  getDiagnostics(): { pendingRequests: Record<string, number> } {
    const result: Record<string, number> = {};

    for (const key of this.pendingRequests.keys()) {
      const sessionId = key.split(':')[0];
      result[sessionId] = (result[sessionId] || 0) + 1;
    }

    return { pendingRequests: result };
  }

  /**
   * Get WebSocket connection for a session
   */
  getWebSocket(sessionId: string) {
    return this.sessionManager.getWebSocket(sessionId);
  }

  /**
   * Check if session is healthy
   */
  isSessionHealthy(sessionId: string) {
    return this.sessionManager.isSessionHealthy(sessionId);
  }
}
