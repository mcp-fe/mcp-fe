/**
 * MCP Controller
 *
 * Encapsulates the shared WebSocket / MCP server / storage logic used by
 * both SharedWorker and ServiceWorker implementations.
 *
 * Supports dynamic tool registration via handleRegisterTool and handleUnregisterTool.
 */

import { storeEvent, queryEvents, UserEvent } from './database';
import { mcpServer } from './mcp-server';
import { WebSocketTransport } from './websocket-transport';
import { logger } from './logger';

const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

export type BroadcastFn = (message: unknown) => void;

export class MCPController {
  private socket: WebSocket | null = null;
  private transport: WebSocketTransport | null = null;
  private reconnectAttempts = 0;
  private authToken: string | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private requireAuth: boolean;
  private isReconnectingForToken = false;

  constructor(
    private backendUrl: string,
    private broadcastFn: BroadcastFn,
    requireAuth = true,
  ) {
    this.requireAuth = requireAuth;
  }

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
    // If we require auth and don't have a token yet, do not attempt connection
    if (this.requireAuth && !this.authToken) {
      logger.log(
        '[MCPController] Skipping WebSocket connect: auth token not set and requireAuth=true',
      );
      return;
    }

    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    // Clean up existing transport and socket
    if (this.transport) {
      try {
        await mcpServer.close();
      } catch (error) {
        logger.error('[MCPController] Error closing MCP server:', error);
      }
      this.transport = null;
    }

    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      if (
        this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING
      ) {
        this.socket.close();
      }
      this.socket = null;
    }

    return new Promise((resolve) => {
      const url = this.authToken
        ? `${this.backendUrl}?token=${this.authToken}`
        : this.backendUrl;
      this.socket = new WebSocket(url);

      this.socket.onopen = async () => {
        logger.log('[MCPController] Connected to backend MCP server');
        this.reconnectAttempts = 0;
        this.isReconnectingForToken = false;

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
            logger.log(
              '[MCPController] MCP Server connected to WebSocket transport',
            );

            this.startKeepAlive();
            this.broadcastFn({ type: 'CONNECTION_STATUS', connected: true });
            resolve();
          }
        } catch (error) {
          logger.error('[MCPController] Error setting up MCP server:', error);
          this.isReconnectingForToken = false;
          this.broadcastFn({ type: 'CONNECTION_STATUS', connected: false });
          if (this.socket) {
            this.socket.close();
          }
          resolve();
        }
      };

      this.socket.onclose = async (event: CloseEvent) => {
        logger.log(
          '[MCPController] Disconnected from backend MCP server',
          event?.code,
          event?.reason,
        );

        // Only broadcast disconnect if not reconnecting for token
        if (!this.isReconnectingForToken) {
          this.broadcastFn({ type: 'CONNECTION_STATUS', connected: false });
        }

        if (this.transport) {
          try {
            await mcpServer.close();
          } catch (error) {
            logger.error('[MCPController] Error closing MCP server:', error);
          }
          this.transport = null;
        }

        this.socket = null;
        this.stopKeepAlive();

        // Don't auto-reconnect if it's a token reconnect (we handle it in setAuthToken)
        if (!this.isReconnectingForToken && event?.code !== 1000) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
            MAX_RECONNECT_DELAY,
          );
          this.reconnectAttempts++;
          logger.log(`[MCPController] Retrying in ${delay}ms...`);
          setTimeout(() => this.connectWebSocket(), delay);
        }

        resolve();
      };

      this.socket.onerror = (event) => {
        logger.error('[MCPController] WebSocket error:', event);
        this.broadcastFn({ type: 'CONNECTION_STATUS', connected: false });
      };
    });
  }

  public setAuthToken(token: string | null): void {
    const tokenChanged = this.authToken !== token;
    this.authToken = token;

    if (tokenChanged) {
      logger.log(
        '[MCPController] Auth token changed, reconnecting WebSocket...',
      );
      this.isReconnectingForToken = true;

      if (
        this.socket &&
        (this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING)
      ) {
        // Close with normal closure to prevent auto-reconnect in some environments
        this.socket.close(1000, 'Reconnecting with new auth token');
      }

      // small delay before reconnecting
      setTimeout(() => {
        this.connectWebSocket().catch((error) => {
          logger.error(
            '[MCPController] Failed to reconnect with new token:',
            error,
          );
          this.isReconnectingForToken = false;
        });
      }, 100);
    }
  }

  public async handleStoreEvent(userEvent: UserEvent): Promise<void> {
    await storeEvent(userEvent);
  }

  public async handleGetEvents(): Promise<ReturnType<typeof queryEvents>> {
    return queryEvents({ limit: 50 });
  }

  public async handleRegisterTool(
    toolData: Record<string, unknown>,
  ): Promise<void> {
    const { toolRegistry } = await import('./mcp-server');

    const name = toolData['name'] as string;
    const description = toolData['description'] as string;
    const inputSchema = toolData['inputSchema'] as Record<string, unknown>;
    const handlerCode = toolData['handler'] as string;

    if (!name || !description || !inputSchema || !handlerCode) {
      throw new Error(
        'Missing required tool fields: name, description, inputSchema, handler',
      );
    }

    // Create a handler function from the provided code
    // The handler code should be a string that evaluates to an async function
    const handler = new Function('args', `return (${handlerCode})(args)`) as (
      args: unknown,
    ) => Promise<{ content: Array<{ type: string; text: string }> }>;

    toolRegistry.register(
      {
        name,
        description,
        inputSchema,
      },
      handler,
    );

    logger.log(`[MCPController] Registered tool: ${name}`);
  }

  public async handleUnregisterTool(toolName: string): Promise<boolean> {
    const { toolRegistry } = await import('./mcp-server');
    const success = toolRegistry.unregister(toolName);

    if (success) {
      logger.log(`[MCPController] Unregistered tool: ${toolName}`);
    } else {
      logger.log(`[MCPController] Tool not found: ${toolName}`);
    }

    return success;
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

  /**
   * Factory helper to create an MCPController instance. Use this instead of
   * replicating controller creation logic in callers.
   */
  public static create(
    backendUrl: string,
    broadcastFn: BroadcastFn,
    requireAuth = true,
  ): MCPController {
    return new MCPController(backendUrl, broadcastFn, requireAuth);
  }
}
