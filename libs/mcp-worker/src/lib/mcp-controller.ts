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

  // Multi-tab support: track tabs and their tools
  private tabRegistry = new Map<
    string,
    { url: string; title: string; lastSeen: number }
  >();
  private activeTabId: string | null = null;
  // Tool handlers per tab: Map<ToolName, Set<TabId>>
  private toolHandlersByTab = new Map<string, Set<string>>();
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
    // Register built-in meta tools
    this.registerBuiltInTools();
  }

  /**
   * Register built-in meta tools for tab management
   * @private
   */
  private registerBuiltInTools(): void {
    // Tool for listing all active browser tabs
    toolRegistry.register(
      {
        name: 'list_browser_tabs',
        description:
          'List all active browser tabs running this application. Returns tab IDs, URLs, titles, and active status. Use this to discover available tabs before calling tools with specific tabId parameters.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      async () => {
        const tabs = Array.from(this.tabRegistry.entries()).map(
          ([tabId, info]) => ({
            tabId,
            url: info.url,
            title: info.title,
            isActive: tabId === this.activeTabId,
            lastSeen: new Date(info.lastSeen).toISOString(),
          }),
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tabs, null, 2),
            },
          ],
        };
      },
    );

    logger.log('[MCPController] Registered built-in meta tools');
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

    this.tabRegistry.set(tabId, {
      url: url || '',
      title: title || '',
      lastSeen: Date.now(),
    });

    logger.log(`[MCPController] Registered tab: ${tabId} (${title})`);

    // Broadcast tab list update to all tabs
    this.broadcastFn({
      type: 'TAB_LIST_UPDATED',
      tabs: Array.from(this.tabRegistry.entries()).map(([id, info]) => ({
        tabId: id,
        ...info,
      })),
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

    this.activeTabId = tabId;

    logger.log(`[MCPController] Active tab changed: ${tabId}`);

    // Update lastSeen timestamp
    const tab = this.tabRegistry.get(tabId);
    if (tab) {
      tab.lastSeen = Date.now();
    }
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
    const description = toolData['description'] as string;
    const inputSchema = toolData['inputSchema'] as Record<string, unknown>;
    const handlerType = toolData['handlerType'] as string;
    const tabId = toolData['tabId'] as string;

    if (!name || !description || !inputSchema) {
      throw new Error(
        'Missing required tool fields: name, description, inputSchema',
      );
    }

    if (handlerType !== 'proxy') {
      throw new Error(
        `Unsupported handler type: ${handlerType}. Only 'proxy' handlers are supported.`,
      );
    }

    // Track which tabs have registered this tool
    if (!this.toolHandlersByTab.has(name)) {
      this.toolHandlersByTab.set(name, new Set());
    }
    const tabHandlers = this.toolHandlersByTab.get(name)!;

    // Check if this is a new tab registering or existing tab re-registering
    const isNewTab = !tabHandlers.has(tabId);
    tabHandlers.add(tabId);

    if (!isNewTab) {
      logger.log(
        `[MCPController] Tab ${tabId} re-registered tool '${name}' (already tracked)`,
      );
      return; // Don't re-register with MCP server
    }

    logger.log(
      `[MCPController] Tab ${tabId} registered tool '${name}' (${tabHandlers.size} tab(s) total)`,
    );

    // Only register with MCP server once (first tab)
    if (tabHandlers.size === 1) {
      // Create a smart proxy handler with hybrid multi-tab routing
      const handler: (
        args: unknown,
      ) => Promise<{ content: Array<{ type: string; text: string }> }> = async (
        args: unknown,
      ) => {
        const argsObj = args as Record<string, unknown>;
        let targetTabId = argsObj['tabId'] as string | undefined;

        // Smart routing strategy:
        // 1. Explicit tabId parameter (highest priority)
        // 2. If only one tab has this tool -> use it (regardless of focus)
        // 3. Active/focused tab (if it has the tool)
        // 4. First available tab (fallback)

        if (!targetTabId) {
          // Check if only one tab has this tool
          if (tabHandlers.size === 1) {
            // Only one tab provides this tool - route to it automatically
            targetTabId = tabHandlers.values().next().value;
            logger.log(
              `[MCPController] Tool '${name}' available in only one tab, routing to: ${targetTabId}`,
            );
          } else if (this.activeTabId && tabHandlers.has(this.activeTabId)) {
            // Multiple tabs have tool, prefer active tab if it has it
            targetTabId = this.activeTabId;
            logger.log(
              `[MCPController] Routing '${name}' to active tab: ${targetTabId}`,
            );
          } else if (this.activeTabId && !tabHandlers.has(this.activeTabId)) {
            // Active tab doesn't have tool, use first available
            const firstTab = tabHandlers.values().next().value;
            if (firstTab) {
              targetTabId = firstTab;
              logger.log(
                `[MCPController] Active tab doesn't have '${name}', routing to first available: ${targetTabId}`,
              );
            }
          } else {
            // No active tab - use first available
            const firstTab = tabHandlers.values().next().value;
            if (firstTab) {
              targetTabId = firstTab;
              logger.log(
                `[MCPController] No active tab, routing '${name}' to first available: ${targetTabId}`,
              );
            }
          }
        }

        // Validate we found a target
        if (!targetTabId) {
          throw new Error(
            `Tool '${name}' has no registered tabs. Please specify tabId parameter.`,
          );
        }

        // Check if target tab has this tool
        if (!tabHandlers.has(targetTabId)) {
          const available = Array.from(tabHandlers);
          throw new Error(
            `Tool '${name}' not available in tab '${targetTabId}'. Available tabs: ${available.join(', ')}`,
          );
        }

        const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        logger.log(
          `[MCPController] Routing tool call to tab ${targetTabId}: ${name}`,
          { callId, args },
        );

        // Send CALL_TOOL message to main thread and wait for result
        return new Promise((resolve, reject) => {
          // Store promise handlers for this call
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
            targetTabId, // NEW: specify which tab should handle this
          });
        });
      };

      toolRegistry.register(
        {
          name,
          description,
          inputSchema,
        },
        handler,
      );

      logger.log(
        `[MCPController] Registered proxy tool: ${name} with hybrid multi-tab routing`,
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
    // Get tabs that have this tool
    const tabHandlers = this.toolHandlersByTab.get(toolName);

    if (!tabHandlers || tabHandlers.size === 0) {
      logger.warn(`[MCPController] Tool not found: ${toolName}`);
      return false;
    }

    // If tabId specified, remove only that tab
    if (tabId) {
      const wasActiveTab = tabId === this.activeTabId;
      const hadMultipleTabs = tabHandlers.size > 1;

      tabHandlers.delete(tabId);
      logger.log(
        `[MCPController] Removed tab ${tabId} from tool '${toolName}' (${tabHandlers.size} tab(s) remaining)`,
      );

      // Smart active tab management: If the active tab just lost this tool,
      // but other tabs still have it, we should prefer routing to those tabs
      if (wasActiveTab && hadMultipleTabs && tabHandlers.size > 0) {
        logger.log(
          `[MCPController] Active tab ${tabId} unregistered '${toolName}', ` +
            `but ${tabHandlers.size} other tab(s) still have it. Future calls will route to available tabs.`,
        );
        // Note: We don't change activeTabId itself (tab is still active),
        // but the routing logic will automatically prefer tabs that have the tool
      }
    }

    // If no more tabs have this tool, unregister from MCP
    if (tabHandlers.size === 0) {
      this.toolHandlersByTab.delete(toolName);
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
