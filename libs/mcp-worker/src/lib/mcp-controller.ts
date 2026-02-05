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
import { toolRegistry } from './tool-registry';
import { TabManager } from './tab-manager';
import { registerTabManagementTool } from './built-in-tools';

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

  // Queue for tool registrations that arrive before MCP server is ready
  private pendingToolRegistrations: Array<{
    toolData: Record<string, unknown>;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  private isMCPServerReady = false;

  // Multi-tab support via TabManager
  private tabManager = new TabManager();

  // Map to track pending tool calls
  private pendingToolCalls = new Map<
    string,
    {
      resolve: (result: {
        content: Array<{ type: string; text: string }>;
      }) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(
    private backendUrl: string,
    private broadcastFn: BroadcastFn,
    requireAuth = true,
  ) {
    this.requireAuth = requireAuth;
    // Register tab management tool with this controller's TabManager
    registerTabManagementTool(this.tabManager);
  }

  /**
   * Handle tab registration from WorkerClient
   * @public
   */
  public handleRegisterTab(data: Record<string, unknown>): void {
    const tabId = data['tabId'] as string;
    const url = data['url'] as string;
    const title = data['title'] as string;

    if (!tabId) {
      logger.warn('[MCPController] REGISTER_TAB missing tabId');
      return;
    }

    this.tabManager.registerTab(tabId, url, title);

    // Broadcast tab list update to all tabs
    this.broadcastFn({
      type: 'TAB_LIST_UPDATED',
      tabs: this.tabManager.getAllTabs(),
    });
  }

  /**
   * Handle active tab change from WorkerClient
   * @public
   */
  public handleSetActiveTab(data: Record<string, unknown>): void {
    const tabId = data['tabId'] as string;

    if (!tabId) {
      logger.warn('[MCPController] SET_ACTIVE_TAB missing tabId');
      return;
    }

    this.tabManager.setActiveTab(tabId);
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

            this.isMCPServerReady = true;
            this.processPendingToolRegistrations();

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

  /**
   * Process pending tool registrations after MCP server is ready
   * @private
   */
  private processPendingToolRegistrations(): void {
    if (this.pendingToolRegistrations.length === 0) return;

    logger.log(
      `[MCPController] Processing ${this.pendingToolRegistrations.length} pending tool registrations`,
    );

    const pending = [...this.pendingToolRegistrations];
    this.pendingToolRegistrations = [];

    pending.forEach(async ({ toolData, resolve, reject }) => {
      try {
        await this.handleRegisterToolInternal(toolData);
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public async handleRegisterTool(
    toolData: Record<string, unknown>,
  ): Promise<void> {
    // If MCP server is not ready yet, queue the registration
    if (!this.isMCPServerReady) {
      logger.log(
        `[MCPController] Queueing tool registration '${toolData['name']}' (MCP server not ready yet)`,
      );

      return new Promise<void>((resolve, reject) => {
        this.pendingToolRegistrations.push({
          toolData,
          resolve,
          reject,
        });
      });
    }

    // MCP server is ready - register immediately
    return this.handleRegisterToolInternal(toolData);
  }

  /**
   * Internal method to register tool (assumes MCP server is ready)
   * @private
   */
  private async handleRegisterToolInternal(
    toolData: Record<string, unknown>,
  ): Promise<void> {
    const name = toolData['name'] as string;
    const description = toolData['description'] as string | undefined;
    const inputSchema = toolData['inputSchema'] as Record<string, unknown>;
    const outputSchema = toolData['outputSchema'] as
      | Record<string, unknown>
      | undefined;
    const annotations = toolData['annotations'] as
      | Record<string, unknown>
      | undefined;
    const execution = toolData['execution'] as
      | Record<string, unknown>
      | undefined;
    const _meta = toolData['_meta'] as Record<string, unknown> | undefined;
    const icons = toolData['icons'] as
      | Array<Record<string, unknown>>
      | undefined;
    const title = toolData['title'] as string | undefined;
    const handlerType = toolData['handlerType'] as string;
    const tabId = toolData['tabId'] as string;

    if (!name || !inputSchema) {
      throw new Error('Missing required tool fields: name, inputSchema');
    }

    if (handlerType !== 'proxy') {
      throw new Error(
        `Unsupported handler type: ${handlerType}. Only 'proxy' handlers are supported.`,
      );
    }

    // Register tool for this tab using TabManager
    const isNewTab = this.tabManager.registerToolForTab(name, tabId);

    if (!isNewTab) {
      return; // Tab already has this tool registered
    }

    // Only register with MCP server once (first tab)
    const tabsWithTool = this.tabManager.getTabsForTool(name);
    if (tabsWithTool.size === 1) {
      // Create a smart proxy handler with multi-tab routing via TabManager
      const handler: (
        args: unknown,
      ) => Promise<{ content: Array<{ type: string; text: string }> }> = async (
        args: unknown,
      ) => {
        const argsObj = args as Record<string, unknown>;
        const explicitTabId = argsObj['tabId'] as string | undefined;

        // Use TabManager's smart routing
        const routingResult = this.tabManager.routeToolCall(
          name,
          explicitTabId,
        );

        if (!routingResult) {
          const available = Array.from(this.tabManager.getTabsForTool(name));
          if (explicitTabId) {
            throw new Error(
              `Tool '${name}' not available in tab '${explicitTabId}'. Available tabs: ${available.join(', ')}`,
            );
          } else {
            throw new Error(
              `Tool '${name}' has no registered tabs. Please specify tabId parameter.`,
            );
          }
        }

        const { targetTabId, reason } = routingResult;

        logger.log(
          `[MCPController] Routing '${name}' to tab ${targetTabId}: ${reason}`,
        );

        const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Send CALL_TOOL message to main thread and wait for result
        return new Promise((resolve, reject) => {
          const pendingCall = {
            resolve,
            reject,
            timeout: setTimeout(() => {
              this.pendingToolCalls.delete(callId);
              reject(
                new Error(`Tool call timeout: ${name} (tab: ${targetTabId})`),
              );
            }, 30000), // 30 second timeout
          };

          this.pendingToolCalls.set(callId, pendingCall);

          // Broadcast CALL_TOOL message with target tab ID
          this.broadcastFn({
            type: 'CALL_TOOL',
            toolName: name,
            args,
            callId,
            targetTabId,
          });
        });
      };

      toolRegistry.register(
        {
          name,
          description,
          inputSchema,
          outputSchema,
          annotations: annotations as
            | {
                title?: string;
                readOnlyHint?: boolean;
                destructiveHint?: boolean;
                idempotentHint?: boolean;
                openWorldHint?: boolean;
              }
            | undefined,
          execution: execution as
            | {
                taskSupport?: 'optional' | 'required' | 'forbidden';
              }
            | undefined,
          _meta,
          icons: icons as
            | Array<{
                src: string;
                mimeType?: string;
                sizes?: string[];
                theme?: 'light' | 'dark';
              }>
            | undefined,
          title,
        },
        handler,
      );

      logger.log(
        `[MCPController] Registered proxy tool: ${name} with smart multi-tab routing`,
      );
    }
  }

  public handleToolCallResult(callId: string, result: unknown): void {
    const pendingCall = this.pendingToolCalls.get(callId);
    if (!pendingCall) {
      logger.warn(
        `[MCPController] Received result for unknown call: ${callId}`,
      );
      return;
    }

    clearTimeout(pendingCall.timeout);
    this.pendingToolCalls.delete(callId);

    const resultData = result as {
      success?: boolean;
      result?: { content: Array<{ type: string; text: string }> };
      error?: string;
    };

    if (resultData.success && resultData.result) {
      pendingCall.resolve(resultData.result);
    } else {
      pendingCall.reject(new Error(resultData.error || 'Tool call failed'));
    }
  }

  public async handleUnregisterTool(
    toolName: string,
    tabId?: string,
  ): Promise<boolean> {
    if (!tabId) {
      logger.warn(
        `[MCPController] UNREGISTER_TOOL missing tabId for '${toolName}'`,
      );
      return false;
    }

    // Unregister tool from tab using TabManager
    const result = this.tabManager.unregisterToolFromTab(toolName, tabId);

    if (!result.wasRemoved) {
      logger.warn(
        `[MCPController] Tool '${toolName}' not found in tab ${tabId}`,
      );
      return false;
    }

    // Log smart active tab management info
    if (result.wasActiveTab && result.remainingTabs > 0) {
      logger.log(
        `[MCPController] Active tab ${tabId} unregistered '${toolName}', ` +
          `but ${result.remainingTabs} other tab(s) still have it. Future calls will route to available tabs.`,
      );
    }

    // If no more tabs have this tool, unregister from MCP
    if (result.remainingTabs === 0) {
      const success = toolRegistry.unregister(toolName);

      if (success) {
        logger.log(
          `[MCPController] Unregistered tool from MCP: ${toolName} (no tabs remaining)`,
        );
      }

      return success;
    }

    return true; // Still has tabs, so considered successful
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
