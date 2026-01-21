/* eslint-disable no-restricted-globals */
/**
 * MCP Controller
 *
 * Encapsulates the shared WebSocket / MCP server / storage logic used by
 * both SharedWorker and ServiceWorker implementations.
 */

import { storeEvent, queryEvents, UserEvent } from './database';
import { mcpServer } from './mcp-server';
import { WebSocketTransport } from './websocket-transport';

const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

export type BroadcastFn = (message: unknown) => void;

export class MCPController {
  private socket: WebSocket | null = null;
  private transport: WebSocketTransport | null = null;
  private reconnectAttempts = 0;
  private authToken: string | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private backendUrl: string, private broadcastFn: BroadcastFn) {}

  private startKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    this.keepAliveInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // ignore send errors
        }
      }
    }, 20000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  public async connectWebSocket(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Clean up existing transport and socket
    if (this.transport) {
      try {
        await mcpServer.close();
      } catch (error) {
        console.error('[MCPController] Error closing MCP server:', error);
      }
      this.transport = null;
    }

    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      this.socket = null;
    }

    return new Promise((resolve) => {
      const url = this.authToken ? `${this.backendUrl}?token=${this.authToken}` : this.backendUrl;
      this.socket = new WebSocket(url);

      this.socket.onopen = async () => {
        console.log('[MCPController] Connected to backend MCP server');
        this.reconnectAttempts = 0;

        try {
          if (this.socket) {
            this.transport = new WebSocketTransport(this.socket);
            // start transport if available
            if (typeof this.transport.start === 'function') {
              try {
                await this.transport.start();
              } catch {
                // some transport implementations may not require start
                // ignore
              }
            }

            await mcpServer.connect(this.transport);
            console.log('[MCPController] MCP Server connected to WebSocket transport');

            this.startKeepAlive();
            this.broadcastFn({ type: 'CONNECTION_STATUS', connected: true });
            resolve();
          }
        } catch (error) {
          console.error('[MCPController] Error setting up MCP server:', error);
          this.broadcastFn({ type: 'CONNECTION_STATUS', connected: false });
          if (this.socket) {
            this.socket.close();
          }
          resolve();
        }
      };

      this.socket.onclose = async (event: CloseEvent) => {
        console.log('[MCPController] Disconnected from backend MCP server', event?.code, event?.reason);
        this.broadcastFn({ type: 'CONNECTION_STATUS', connected: false });

        if (this.transport) {
          try {
            await mcpServer.close();
          } catch (error) {
            console.error('[MCPController] Error closing MCP server:', error);
          }
          this.transport = null;
        }

        this.socket = null;
        this.stopKeepAlive();

        if (event?.code !== 1000) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
            MAX_RECONNECT_DELAY,
          );
          this.reconnectAttempts++;
          console.log(`[MCPController] Retrying in ${delay}ms...`);
          setTimeout(() => this.connectWebSocket(), delay);
        }

        resolve();
      };

      this.socket.onerror = (event) => {
        console.error('[MCPController] WebSocket error:', event);
        this.broadcastFn({ type: 'CONNECTION_STATUS', connected: false });
      };
    });
  }

  public setAuthToken(token: string | null): void {
    const tokenChanged = this.authToken !== token;
    this.authToken = token;

    if (tokenChanged) {
      console.log('[MCPController] Auth token changed, reconnecting WebSocket...');
      if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
        // Close with normal closure to prevent auto-reconnect in some environments
        this.socket.close(1000, 'Reconnecting with new auth token');
      }

      // small delay before reconnecting
      setTimeout(() => {
        this.connectWebSocket().catch((error) => console.error('[MCPController] Failed to reconnect with new token:', error));
      }, 100);
    }
  }

  public async handleStoreEvent(userEvent: UserEvent): Promise<void> {
    await storeEvent(userEvent);
  }

  public async handleGetEvents(): Promise<ReturnType<typeof queryEvents>> {
    return queryEvents({ limit: 50 });
  }

  public getConnectionStatus(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public dispose(): void {
    this.stopKeepAlive();
    if (this.socket) {
      try {
        this.socket.close(1000, 'Worker disposed');
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }
}
