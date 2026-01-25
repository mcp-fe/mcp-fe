import { WebSocket } from 'ws';

/**
 * Manages WebSocket connections to service workers and handles communication
 */
export class WebSocketManager {
  // Track pending requests and active connections
  private pendingRequests = new Map<string, (value: any) => void>();
  // Map sessionId to WebSocket connection
  private activeSessions = new Map<string, WebSocket>();

  /**
   * Register a WebSocket connection for a session
   */
  registerSession(sessionId: string, ws: WebSocket): void {
    console.error(`[WS Manager] Registered session: ${sessionId}`);
    this.activeSessions.set(sessionId, ws);
  }

  /**
   * Unregister a WebSocket connection for a session
   */
  unregisterSession(sessionId: string, ws: WebSocket): void {
    console.error(`[WS Manager] Unregistered session: ${sessionId}`);
    if (this.activeSessions.get(sessionId) === ws) {
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * Check if a session has an active connection
   */
  hasSession(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Get the WebSocket connection for a session
   */
  getSession(sessionId: string): WebSocket | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Handle a message from a service worker (typically a response to a request)
   */
  handleMessage(sessionId: string, message: any): void {
    // Handle MCP protocol messages (JSON-RPC)
    if (message.jsonrpc === '2.0') {
      // Handle responses from SW to our requests
      if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
        const handler = this.pendingRequests.get(`${sessionId}:${message.id}`);
        if (handler) {
          console.error(`[WS Manager] Response handler found for session ${sessionId}, id: ${message.id}`);
          handler(message);
          this.pendingRequests.delete(`${sessionId}:${message.id}`);
          return;
        } else {
          console.warn(`[WS Manager] No handler found for response in session ${sessionId}, id: ${message.id}`);
        }
      }
    }
  }

  /**
   * Call a tool on the service worker via WebSocket
   */
  async callServiceWorkerTool(sessionId: string, message: any): Promise<any> {
    const ws = this.activeSessions.get(sessionId);
    if (!ws) {
      console.error(`[WS Manager] No Service Worker connected for session: ${sessionId}`);
      throw new Error(`No Service Worker connected for session: ${sessionId}`);
    }

    // Ensure message has a unique ID
    const requestId = message.id || Math.random().toString(36).substring(7);
    const mcpMessage = { ...message, id: requestId };

    console.error(`[WS Manager] Sending request to SW (${sessionId}): ${mcpMessage.method} (id: ${requestId})`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(`${sessionId}:${requestId}`);
        console.error(`[WS Manager] Timeout waiting for SW response for session ${sessionId}, id: ${requestId} (15s)`);
        reject(new Error(`Timeout waiting for Service Worker response (method: ${mcpMessage.method})`));
      }, 15000); // Increased timeout to 15s

      this.pendingRequests.set(`${sessionId}:${requestId}`, (data) => {
        console.error(`[WS Manager] Received response from SW for session ${sessionId}, id: ${requestId}`);
        clearTimeout(timeout);
        resolve(data);
      });

      try {
        ws.send(JSON.stringify(mcpMessage));
        console.error(`[WS Manager] Message sent successfully to SW (${sessionId})`);
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(`${sessionId}:${requestId}`);
        console.error(`[WS Manager] Error sending message to SW (${sessionId}):`, err instanceof Error ? err.message : String(err));
        reject(err);
      }
    });
  }

  /**
   * Get diagnostic info about active sessions
   */
  getDiagnostics(): { [key: string]: { isConnected: boolean; pendingRequests: number } } {
    const result: { [key: string]: { isConnected: boolean; pendingRequests: number } } = {};
    for (const [sessionId, ws] of this.activeSessions.entries()) {
      const pendingCount = Array.from(this.pendingRequests.keys()).filter(k => k.startsWith(`${sessionId}:`)).length;
      result[sessionId] = {
        isConnected: ws.readyState === WebSocket.OPEN,
        pendingRequests: pendingCount,
      };
    }
    return result;
  }
}
