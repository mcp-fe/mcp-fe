/**
 * WorkerClient — adapter for communicating with a worker process.
 *
 * Responsibilities
 * - Chooses the transport: prefers a SharedWorker and falls back to a ServiceWorker.
 * - Provides a request/response API (MessageChannel) and a fire-and-forget post API.
 * - Tracks connection status and exposes a subscription API for CONNECTION_STATUS updates.
 * - Buffers an auth token (SET_AUTH_TOKEN) when no worker is available and sends it when a
 *   worker becomes active.
 *
 * Public API
 * - async init(registration?: ServiceWorkerRegistration): Promise<void>
 *   Initializes the client. If a ServiceWorkerRegistration is provided, it will be used directly.
 *
 * - async request<T = any>(type: string, payload?: Record<string, unknown>, timeoutMs = 5000): Promise<T>
 *   Sends a request expecting a reply via MessageChannel. Rejects on timeout, missing worker,
 *   or a worker-reported error.
 *
 * - async post(type: string, payload?: Record<string, unknown>): Promise<void>
 *   Fire-and-forget message. If type === 'SET_AUTH_TOKEN' and no worker is available, the token
 *   is queued and sent after initialization.
 *
 * - getConnectionStatus(): Promise<boolean>
 *   Attempts to obtain the current connection status (uses GET_CONNECTION_STATUS request with a
 *   short timeout) and returns a boolean.
 *
 * - onConnectionStatus(cb: (connected: boolean) => void): void
 * - offConnectionStatus(cb: (connected: boolean) => void): void
 *   Subscribe/unsubscribe to connection status updates.
 *
 * Error model and edge cases
 * - init may throw if neither SharedWorker nor ServiceWorker is supported or registration fails.
 * - request may reject due to timeout, no worker registered, missing active ServiceWorker, or a
 *   worker-reported error payload.
 * - post does not throw for transient postMessage failures; SET_AUTH_TOKEN is queued instead.
 * - Concurrent init calls are serialized via an internal mutex (initPromise).
 *
 */

import { logger } from './logger';

type WorkerKind = 'shared' | 'service';

// New options shape for init: allow consumer to pass worker script URLs instead of registration
export type WorkerClientInitOptions = {
  /** URL to the SharedWorker script (optional) */
  sharedWorkerUrl?: string;
  /** URL to the ServiceWorker script (optional) */
  serviceWorkerUrl?: string;
  /** Backend WebSocket URL to configure inside the worker (optional) */
  backendWsUrl?: string;
};

export class WorkerClient {
  // Configurable worker script URLs (defaults kept for backward compatibility)
  private sharedWorkerUrl = '/mcp-shared-worker.js';
  private serviceWorkerUrl = '/mcp-service-worker.js';
  // Backend websocket URL to pass into the worker(s)
  private backendWsUrl: string | null = 'ws://localhost:3001';

  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private sharedWorker: SharedWorker | null = null;
  private sharedWorkerPort: MessagePort | null = null;
  private workerType: WorkerKind | null = null;
  private pendingAuthToken: string | null = null;
  // connection status subscribers
  private connectionStatusCallbacks: Set<(connected: boolean) => void> =
    new Set();

  // Mutex/promise to prevent concurrent init runs
  private initPromise: Promise<void> | null = null;

  // Initialization state
  private isInitialized = false;
  private initResolvers: Array<() => void> = [];

  // Queue for operations that need to wait for initialization
  private pendingRegistrations: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    handler: (
      args: unknown,
    ) => Promise<{ content: Array<{ type: string; text: string }> }>;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  // Map to store tool handlers in main thread
  private toolHandlers = new Map<
    string,
    (
      args: unknown,
    ) => Promise<{ content: Array<{ type: string; text: string }> }>
  >();

  // Tool registry for tracking registrations and reference counting
  private toolRegistry = new Map<
    string,
    {
      refCount: number;
      description: string;
      inputSchema: Record<string, unknown>;
      isRegistered: boolean;
    }
  >();

  // Subscribers for tool changes (for React hooks reactivity)
  private toolChangeListeners = new Map<
    string,
    Set<(info: { refCount: number; isRegistered: boolean } | null) => void>
  >();

  // Tab tracking for multi-tab support
  private tabId: string;
  private static activeTabId: string | null = null;
  private static readonly TAB_ID_STORAGE_KEY = 'mcp_tab_id';

  constructor() {
    // Get or create tab ID from session storage
    this.tabId = this.getOrCreateTabId();

    // Track focus changes for active tab management
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.setActiveTab();
      });

      // Track visibility changes (more reliable than focus)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.setActiveTab();
        }
      });
    }
  }

  /**
   * Get existing tab ID from session storage or create new one using crypto.randomUUID()
   * @private
   */
  private getOrCreateTabId(): string {
    try {
      // Try to get existing tab ID
      const existing = sessionStorage.getItem(WorkerClient.TAB_ID_STORAGE_KEY);
      if (existing) {
        logger.log(`[WorkerClient] Reusing existing tab ID: ${existing}`);
        return existing;
      }

      // Generate new UUID using crypto API
      const newId = crypto.randomUUID();
      sessionStorage.setItem(WorkerClient.TAB_ID_STORAGE_KEY, newId);
      logger.log(`[WorkerClient] Generated new tab ID: ${newId}`);
      return newId;
    } catch (error) {
      // Fallback if sessionStorage unavailable (private mode, etc.)
      logger.warn(
        '[WorkerClient] Session storage unavailable, using fallback ID:',
        error,
      );
      return `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  /**
   * Register this tab with the worker
   * @private
   */
  private registerTab(): void {
    this.post('REGISTER_TAB', {
      tabId: this.tabId,
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
    }).catch((error) => {
      logger.warn('[WorkerClient] Failed to register tab:', error);
    });
  }

  /**
   * Mark this tab as the active tab
   * @private
   */
  private setActiveTab(): void {
    WorkerClient.activeTabId = this.tabId;
    this.post('SET_ACTIVE_TAB', { tabId: this.tabId }).catch((error) => {
      logger.warn('[WorkerClient] Failed to set active tab:', error);
    });
  }

  /**
   * Get the unique ID of this tab
   * @public
   */
  public getTabId(): string {
    return this.tabId;
  }

  /**
   * Get current tab info (for debugging)
   * @public
   */
  public getTabInfo(): {
    tabId: string;
    isActive: boolean;
    url: string;
    title: string;
  } {
    return {
      tabId: this.tabId,
      isActive: WorkerClient.activeTabId === this.tabId,
      url: typeof window !== 'undefined' ? window.location.href : '',
      title: typeof document !== 'undefined' ? document.title : '',
    };
  }

  /**
   * Clear tab ID from session storage (useful for testing)
   * @public
   */
  public static clearTabId(): void {
    try {
      sessionStorage.removeItem(WorkerClient.TAB_ID_STORAGE_KEY);
      logger.log('[WorkerClient] Cleared tab ID from session storage');
    } catch (error) {
      logger.warn('[WorkerClient] Failed to clear tab ID:', error);
    }
  }

  // Initialize and choose worker implementation (prefer SharedWorker)
  // Accept either a ServiceWorkerRegistration OR WorkerInitOptions to configure URLs
  public async init(
    registrationOrOptions?: ServiceWorkerRegistration | WorkerClientInitOptions,
  ): Promise<void> {
    logger.log('[WorkerClient] init() called', {
      hasOptions: !!registrationOrOptions,
      currentWorkerType: this.workerType,
      initInProgress: !!this.initPromise,
      timestamp: Date.now(),
    });

    // Normalize args: if a ServiceWorkerRegistration is provided, use it. Otherwise
    // treat the argument as WorkerInitOptions (or undefined).
    let explicitRegistration: ServiceWorkerRegistration | undefined;
    const maybeReg = registrationOrOptions as unknown as
      | { scope?: string }
      | undefined;
    if (maybeReg && typeof maybeReg.scope === 'string') {
      explicitRegistration = registrationOrOptions as ServiceWorkerRegistration;
      logger.log('[WorkerClient] Using explicit ServiceWorker registration');
    } else if (registrationOrOptions) {
      const opts = registrationOrOptions as WorkerClientInitOptions;
      logger.log('[WorkerClient] Using WorkerClientInitOptions:', opts);
      if (opts.sharedWorkerUrl) this.sharedWorkerUrl = opts.sharedWorkerUrl;
      if (opts.serviceWorkerUrl) this.serviceWorkerUrl = opts.serviceWorkerUrl;
      if (opts.backendWsUrl) this.backendWsUrl = opts.backendWsUrl;
    }

    // If an init is already in progress, wait for it and optionally retry if caller provided a registration
    if (this.initPromise) {
      return this.initPromise.then(async () => {
        if (explicitRegistration && this.workerType !== 'service') {
          // retry once with provided registration after current init finished
          await this.init(explicitRegistration);
        }
      });
    }

    // Start initialization and store the promise as a mutex
    this.initPromise = (async () => {
      try {
        // If an explicit ServiceWorker registration is provided, use it
        if (explicitRegistration) {
          this.serviceWorkerRegistration = explicitRegistration;
          this.workerType = 'service';
          logger.info(
            '[WorkerClient] Using ServiceWorker (explicit registration)',
          );
          // Send INIT (backend URL + auth token if available) to the worker (best-effort)
          try {
            const initMsg: Record<string, unknown> = {
              type: 'INIT',
              backendUrl: this.backendWsUrl,
            };
            if (this.pendingAuthToken) initMsg['token'] = this.pendingAuthToken;
            // try active first
            if (this.serviceWorkerRegistration.active) {
              this.serviceWorkerRegistration.active.postMessage(initMsg);
            } else if (
              'serviceWorker' in navigator &&
              navigator.serviceWorker.controller
            ) {
              navigator.serviceWorker.controller.postMessage(initMsg);
            }
            // keep pendingAuthToken; will be cleared when INIT successfully sent on other paths
          } catch {
            // ignore; worker may not be active yet
          }
          return;
        }

        // Try SharedWorker first
        const sharedOk = await this.initSharedWorker();
        if (sharedOk) {
          this.markAsInitialized();
          return;
        }

        // If SharedWorker isn't supported or failed, use service worker
        await this.initServiceWorkerFallback();
        this.markAsInitialized();
      } finally {
        // Clear the mutex so future init calls can proceed
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Mark worker as initialized and process pending registrations
   * @private
   */
  private markAsInitialized(): void {
    this.isInitialized = true;
    logger.log(
      '[WorkerClient] Worker initialized, processing pending operations',
    );

    // Register this tab with the worker
    this.registerTab();
    // Set as active tab immediately
    this.setActiveTab();

    // Notify all waiters
    this.initResolvers.forEach((resolve) => resolve());
    this.initResolvers = [];

    // Process pending registrations
    const pending = [...this.pendingRegistrations];
    this.pendingRegistrations = [];

    pending.forEach(
      async ({ name, description, inputSchema, handler, resolve, reject }) => {
        try {
          await this.registerToolInternal(
            name,
            description,
            inputSchema,
            handler,
          );
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
    );
  }

  /**
   * Wait for worker initialization
   * @returns Promise that resolves when worker is initialized
   */
  public async waitForInit(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve();
    }

    // If init is in progress, wait for it
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    // Otherwise, create a promise that will resolve when initialized
    return new Promise<void>((resolve) => {
      this.initResolvers.push(resolve);
    });
  }

  /**
   * Check if worker is initialized
   */
  public get initialized(): boolean {
    return this.isInitialized;
  }

  private async initSharedWorker(): Promise<boolean> {
    if (typeof SharedWorker === 'undefined') {
      return Promise.resolve(false);
    }

    try {
      this.sharedWorker = new SharedWorker(this.sharedWorkerUrl, {
        type: 'module',
      });
      this.sharedWorkerPort = this.sharedWorker.port;
      this.sharedWorkerPort.start();

      // We will send INIT (backendUrl + optional token) once the shared worker confirms availability
      await new Promise<boolean>((resolve, reject) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            const p = this.sharedWorkerPort;
            if (p) p.onmessage = null;
            reject(new Error('SharedWorker initialization timeout'));
          }
        }, 2000);

        const p = this.sharedWorkerPort;
        if (!p) {
          clearTimeout(timeout);
          return reject(new Error('SharedWorker port not available'));
        }

        p.onmessage = (ev: MessageEvent) => {
          try {
            const data = ev.data;
            if (data && data.type === 'CONNECTION_STATUS') {
              clearTimeout(timeout);
              resolved = true;
              this.workerType = 'shared';
              p.onmessage = null;
              resolve(true);
            }
          } catch {
            // ignore parse/handler errors
          }
        };
      });

      const portAfterInit = this.sharedWorkerPort;
      // After init, send a single INIT message containing backend URL and optional token
      if (portAfterInit) {
        try {
          const initMsg: Record<string, unknown> = {
            type: 'INIT',
            backendUrl: this.backendWsUrl,
          };
          if (this.pendingAuthToken) initMsg['token'] = this.pendingAuthToken;
          portAfterInit.postMessage(initMsg);
          // clear pending token after sending INIT
          this.pendingAuthToken = null;
        } catch (e) {
          logger.warn(
            '[WorkerClient] Failed to send INIT to SharedWorker port:',
            e,
          );
        }

        portAfterInit.onmessage = (ev: MessageEvent) => {
          try {
            const data = ev.data;
            if (data && data.type === 'CONNECTION_STATUS') {
              const connected = !!data.connected;
              this.connectionStatusCallbacks.forEach((cb) => {
                try {
                  cb(connected);
                } catch {
                  /* ignore callback errors */
                }
              });
            } else if (data && data.type === 'CALL_TOOL') {
              // Check if this call is intended for this tab
              const targetTabId = data.targetTabId;

              if (targetTabId && targetTabId !== this.tabId) {
                // Not for this tab, ignore
                logger.log(
                  `[WorkerClient] Ignoring CALL_TOOL (not for this tab): ${data.toolName}`,
                  { targetTabId, myTabId: this.tabId },
                );
                return;
              }

              // Worker is asking us to execute a tool handler
              this.handleToolCall(data.toolName, data.args, data.callId).catch(
                (error) => {
                  logger.error(
                    '[WorkerClient] Failed to handle tool call:',
                    error,
                  );
                },
              );
            }
          } catch {
            // ignore
          }
        };
      }

      logger.info('[WorkerClient] Using SharedWorker');

      return true;
    } catch (error) {
      logger.warn(
        '[WorkerClient] SharedWorker not available, falling back to ServiceWorker:',
        error,
      );
      return false;
    }
  }

  private async initServiceWorkerFallback(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const existingRegistration =
          await navigator.serviceWorker.getRegistration();
        if (existingRegistration) {
          this.serviceWorkerRegistration = existingRegistration;
          this.workerType = 'service';
          logger.info(
            '[WorkerClient] Using existing ServiceWorker registration',
          );
          return;
        }

        this.serviceWorkerRegistration = await navigator.serviceWorker.register(
          this.serviceWorkerUrl,
        );
        this.workerType = 'service';

        // Setup message listener for ServiceWorker
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener(
            'message',
            (ev: MessageEvent) => {
              try {
                const data = ev.data;
                if (data && data.type === 'CALL_TOOL') {
                  // Check if this call is intended for this tab
                  const targetTabId = data.targetTabId;

                  if (targetTabId && targetTabId !== this.tabId) {
                    // Not for this tab, ignore
                    logger.log(
                      `[WorkerClient] Ignoring CALL_TOOL (not for this tab): ${data.toolName}`,
                      { targetTabId, myTabId: this.tabId },
                    );
                    return;
                  }

                  // Worker is asking us to execute a tool handler
                  this.handleToolCall(
                    data.toolName,
                    data.args,
                    data.callId,
                  ).catch((error) => {
                    logger.error(
                      '[WorkerClient] Failed to handle tool call:',
                      error,
                    );
                  });
                }
              } catch (error) {
                logger.error(
                  '[WorkerClient] Error processing ServiceWorker message:',
                  error,
                );
              }
            },
          );
        }

        logger.info('[WorkerClient] Using MCP ServiceWorker (fallback)');
        // Send INIT (backend URL + optional token) to service worker (best-effort)
        try {
          const initMsg: Record<string, unknown> = {
            type: 'INIT',
            backendUrl: this.backendWsUrl,
          };
          if (this.pendingAuthToken) initMsg['token'] = this.pendingAuthToken;
          if (this.serviceWorkerRegistration.active) {
            this.serviceWorkerRegistration.active.postMessage(initMsg);
          } else if (
            'serviceWorker' in navigator &&
            navigator.serviceWorker.controller
          ) {
            navigator.serviceWorker.controller.postMessage(initMsg);
          }
          // clear pending token after sending INIT
          this.pendingAuthToken = null;
        } catch {
          // ignore
        }
      } catch (error) {
        logger.error('[WorkerClient] Failed to register ServiceWorker:', error);
        throw error;
      }
    } else {
      throw new Error('Neither SharedWorker nor ServiceWorker is supported');
    }
  }

  // Low-level request that expects a reply via MessageChannel
  public async request<T = unknown>(
    type: string,
    payload?: Record<string, unknown>,
    timeoutMs = 5000,
  ): Promise<T> {
    logger.log('[WorkerClient] Request started:', {
      type,
      payload,
      timeoutMs,
      workerType: this.workerType,
      hasSharedWorkerPort: !!this.sharedWorkerPort,
      hasServiceWorkerReg: !!this.serviceWorkerRegistration,
    });

    // If using shared worker
    if (this.workerType === 'shared' && this.sharedWorkerPort) {
      return new Promise<T>((resolve, reject) => {
        const mc = new MessageChannel();
        const requestId = Math.random().toString(36).substring(7);
        const startTime = Date.now();

        const timer = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          logger.error('[WorkerClient] Request timeout:', {
            type,
            requestId,
            elapsed,
            timeoutMs,
          });
          mc.port1.onmessage = null;
          reject(new Error('Request timeout'));
        }, timeoutMs);

        mc.port1.onmessage = (ev: MessageEvent) => {
          try {
            const elapsed = Date.now() - startTime;
            logger.log('[WorkerClient] Request response received:', {
              type,
              requestId,
              elapsed,
              success: ev.data?.success,
            });
            clearTimeout(timer);
            if (ev.data && ev.data.success) {
              resolve(ev.data as T);
            } else if (ev.data && ev.data.success === false) {
              reject(new Error(ev.data.error || 'Worker error'));
            } else {
              resolve(ev.data as T);
            }
          } catch (handlerError) {
            clearTimeout(timer);
            mc.port1.onmessage = null;
            reject(
              handlerError instanceof Error
                ? handlerError
                : new Error(String(handlerError)),
            );
          }
        };

        try {
          const port = this.sharedWorkerPort;
          if (!port) {
            clearTimeout(timer);
            logger.error('[WorkerClient] SharedWorker port not available');
            return reject(new Error('SharedWorker port not available'));
          }
          logger.log('[WorkerClient] Posting message to SharedWorker:', {
            type,
            requestId,
          });
          port.postMessage({ type, ...(payload || {}) }, [mc.port2]);
        } catch (e) {
          clearTimeout(timer);
          logger.error('[WorkerClient] Failed to post message:', e);
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
    }

    // If using service worker
    if (this.workerType === 'service' && this.serviceWorkerRegistration) {
      // Ensure service worker active
      const reg = this.serviceWorkerRegistration;
      if (!reg) throw new Error('Service worker registration missing');
      if (!reg.active) {
        logger.log('[WorkerClient] ServiceWorker not active, waiting...');
        await navigator.serviceWorker.ready;
        if (!reg.active) {
          throw new Error('Service worker not active');
        }
      }

      return new Promise<T>((resolve, reject) => {
        const mc = new MessageChannel();
        const requestId = Math.random().toString(36).substring(7);
        const startTime = Date.now();

        const timer = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          logger.error('[WorkerClient] ServiceWorker request timeout:', {
            type,
            requestId,
            elapsed,
            timeoutMs,
          });
          mc.port1.onmessage = null;
          reject(new Error('Request timeout'));
        }, timeoutMs);

        mc.port1.onmessage = (ev: MessageEvent) => {
          try {
            const elapsed = Date.now() - startTime;
            logger.log('[WorkerClient] ServiceWorker response received:', {
              type,
              requestId,
              elapsed,
              success: ev.data?.success,
            });
            clearTimeout(timer);
            if (ev.data && ev.data.success) {
              resolve(ev.data as T);
            } else if (ev.data && ev.data.success === false) {
              reject(new Error(ev.data.error || 'Worker error'));
            } else {
              resolve(ev.data as T);
            }
          } catch (handlerError) {
            clearTimeout(timer);
            mc.port1.onmessage = null;
            reject(
              handlerError instanceof Error
                ? handlerError
                : new Error(String(handlerError)),
            );
          }
        };

        try {
          const active = reg.active;
          if (!active) {
            clearTimeout(timer);
            logger.error(
              '[WorkerClient] ServiceWorker active instance not available',
            );
            return reject(
              new Error('Service worker active instance not available'),
            );
          }
          logger.log('[WorkerClient] Posting message to ServiceWorker:', {
            type,
            requestId,
          });
          active.postMessage({ type, ...(payload || {}) }, [mc.port2]);
        } catch (e) {
          clearTimeout(timer);
          logger.error(
            '[WorkerClient] Failed to post message to ServiceWorker:',
            e,
          );
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
    }

    // No worker available
    throw new Error('No worker registered');
  }

  // Fire-and-forget postMessage (no response expected)
  public async post(
    type: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    if (this.workerType === 'shared' && this.sharedWorkerPort) {
      try {
        this.sharedWorkerPort.postMessage({ type, ...(payload || {}) });
      } catch (e) {
        logger.error('[WorkerClient] Failed to post to SharedWorker:', e);
      }
      return;
    }

    if (
      this.workerType === 'service' &&
      this.serviceWorkerRegistration?.active
    ) {
      try {
        this.serviceWorkerRegistration.active.postMessage({
          type,
          ...(payload || {}),
        });
      } catch (e) {
        logger.error(
          '[WorkerClient] Failed to post to ServiceWorker (active):',
          e,
        );
      }
      return;
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type,
          ...(payload || {}),
        });
      } catch (e) {
        logger.error(
          '[WorkerClient] Failed to post to ServiceWorker.controller:',
          e,
        );
      }
      return;
    }

    // If no worker yet, queue token if SET_AUTH_TOKEN
    if (type === 'SET_AUTH_TOKEN' && payload) {
      const token = (payload as Record<string, unknown>)['token'];
      if (typeof token === 'string') this.pendingAuthToken = token;
    }
  }

  private sendAuthTokenToServiceWorker(token: string): void {
    if (this.serviceWorkerRegistration?.active) {
      try {
        this.serviceWorkerRegistration.active.postMessage({
          type: 'SET_AUTH_TOKEN',
          token,
        });
      } catch (e) {
        console.error(
          '[WorkerClient] Failed to send auth token to ServiceWorker:',
          e,
        );
      }
    } else if (
      'serviceWorker' in navigator &&
      navigator.serviceWorker.controller
    ) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'SET_AUTH_TOKEN',
          token,
        });
      } catch (e) {
        console.error(
          '[WorkerClient] Failed to send auth token to ServiceWorker.controller:',
          e,
        );
      }
    } else {
      // keep as pending
      this.pendingAuthToken = token;
    }
  }

  // Subscription API for consumers to listen for connection status updates
  public onConnectionStatus(cb: (connected: boolean) => void): void {
    this.connectionStatusCallbacks.add(cb);
  }

  public offConnectionStatus(cb: (connected: boolean) => void): void {
    this.connectionStatusCallbacks.delete(cb);
  }

  public async getConnectionStatus(): Promise<boolean> {
    try {
      const res = await this.request<{ connected?: boolean }>(
        'GET_CONNECTION_STATUS',
        undefined,
        2000,
      );
      if (res && typeof res === 'object' && 'connected' in res)
        return !!res.connected;
      return !!res?.connected;
    } catch {
      return false;
    }
  }

  public setAuthToken(token: string): void {
    this.pendingAuthToken = token;
    // Try to send immediately if possible
    if (this.workerType === 'shared' && this.sharedWorkerPort) {
      try {
        this.sharedWorkerPort.postMessage({ type: 'SET_AUTH_TOKEN', token });
        this.pendingAuthToken = null;
      } catch (e) {
        logger.error(
          '[WorkerClient] Failed to set auth token on SharedWorker:',
          e,
        );
      }
    } else if (this.workerType === 'service') {
      this.sendAuthTokenToServiceWorker(token);
      this.pendingAuthToken = null;
    } else {
      // queued and will be sent when init finishes
    }
  }

  /**
   * Register a custom MCP tool dynamically
   *
   * The handler function runs in the MAIN THREAD (browser context), not in the worker.
   * This means you have full access to:
   * - React context, hooks, Redux store
   * - DOM API, window, localStorage
   * - All your imports and dependencies
   * - Closures and external variables
   *
   * The worker acts as a proxy - it receives MCP tool calls and forwards them
   * to your handler via MessageChannel.
   *
   * @param name - Tool name
   * @param description - Tool description
   * @param inputSchema - JSON Schema for tool inputs
   * @param handler - Async function that handles the tool execution (runs in main thread)
   * @returns Promise that resolves when tool is registered
   *
   * @example With full access to imports and context:
   * ```typescript
   * import { z } from 'zod';
   * import { useMyStore } from './store';
   *
   * const store = useMyStore();
   *
   * await client.registerTool(
   *   'validate_user',
   *   'Validate user data',
   *   { type: 'object', properties: { username: { type: 'string' } } },
   *   async (args: any) => {
   *     // Full access to everything!
   *     const schema = z.object({ username: z.string().min(3) });
   *     const validated = schema.parse(args);
   *
   *     // Can access store, context, etc.
   *     const currentUser = store.getState().user;
   *
   *     return {
   *       content: [{
   *         type: 'text',
   *         text: JSON.stringify({ validated, currentUser })
   *       }]
   *     };
   *   }
   * );
   * ```
   */
  public async registerTool(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: (
      args: unknown,
    ) => Promise<{ content: Array<{ type: string; text: string }> }>,
  ): Promise<void> {
    // If not initialized, queue the registration
    if (!this.isInitialized) {
      logger.log(
        `[WorkerClient] Queueing tool registration '${name}' (worker not initialized yet)`,
      );

      return new Promise<void>((resolve, reject) => {
        this.pendingRegistrations.push({
          name,
          description,
          inputSchema,
          handler,
          resolve,
          reject,
        });
      });
    }

    // Already initialized - register immediately
    return this.registerToolInternal(name, description, inputSchema, handler);
  }

  /**
   * Enhance tool input schema with optional tabId parameter for multi-tab support
   * @private
   */
  private enhanceSchemaWithTabId(
    schema: Record<string, unknown>,
  ): Record<string, unknown> {
    // Clone schema to avoid mutation
    const enhanced = JSON.parse(JSON.stringify(schema));

    // Ensure properties object exists
    if (!enhanced.properties) {
      enhanced.properties = {};
    }

    // Add optional tabId parameter
    enhanced.properties['tabId'] = {
      type: 'string',
      description:
        'Optional: Target specific tab by ID. If not provided, uses the currently focused tab. Use list_browser_tabs to discover available tabs.',
    };

    return enhanced;
  }

  /**
   * Internal method to register tool (assumes worker is initialized)
   * @private
   */
  private async registerToolInternal(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: (
      args: unknown,
    ) => Promise<{ content: Array<{ type: string; text: string }> }>,
  ): Promise<void> {
    // Check if tool already exists (for reference counting)
    const existing = this.toolRegistry.get(name);

    if (existing) {
      // Increment ref count
      existing.refCount++;
      logger.log(
        `[WorkerClient] Incremented ref count for '${name}': ${existing.refCount}`,
      );

      // Update handler to latest version
      this.toolHandlers.set(name, handler);

      // Notify listeners
      this.notifyToolChange(name);
      return;
    }

    // Store handler in main thread
    this.toolHandlers.set(name, handler);

    // Enhance schema with optional tabId parameter for multi-tab support
    const enhancedSchema = this.enhanceSchemaWithTabId(inputSchema);

    // Register tool in worker with proxy handler
    await this.request('REGISTER_TOOL', {
      name,
      description,
      inputSchema: enhancedSchema,
      handlerType: 'proxy', // Tell worker this is a proxy handler
      tabId: this.tabId, // Tell worker which tab registered this
    });

    // Add to registry
    this.toolRegistry.set(name, {
      refCount: 1,
      description,
      inputSchema: enhancedSchema,
      isRegistered: true,
    });

    logger.log(
      `[WorkerClient] Registered tool '${name}' with main-thread handler`,
    );

    // Notify listeners
    this.notifyToolChange(name);
  }

  /**
   * Unregister a previously registered MCP tool
   * @param name - Tool name to unregister
   * @returns Promise that resolves to true if tool was found and removed
   */
  public async unregisterTool(name: string): Promise<boolean> {
    const existing = this.toolRegistry.get(name);
    if (!existing) {
      logger.warn(`[WorkerClient] Cannot unregister '${name}': not found`);
      return false;
    }

    // Decrement ref count
    existing.refCount--;
    logger.log(
      `[WorkerClient] Decremented ref count for '${name}': ${existing.refCount}`,
    );

    if (existing.refCount <= 0) {
      // Last reference - actually unregister
      // Remove from local handlers
      this.toolHandlers.delete(name);

      // Unregister from worker
      const result = await this.request<{ success?: boolean }>(
        'UNREGISTER_TOOL',
        { name },
      );

      // Remove from registry
      this.toolRegistry.delete(name);

      logger.log(`[WorkerClient] Unregistered tool '${name}'`);

      // Notify listeners (with null = tool removed)
      this.notifyToolChange(name);

      return result?.success ?? false;
    }

    // Still has references - just notify count change
    this.notifyToolChange(name);
    return true;
  }

  /**
   * Subscribe to tool changes for a specific tool
   * Returns unsubscribe function
   */
  public onToolChange(
    toolName: string,
    callback: (
      info: { refCount: number; isRegistered: boolean } | null,
    ) => void,
  ): () => void {
    if (!this.toolChangeListeners.has(toolName)) {
      this.toolChangeListeners.set(toolName, new Set());
    }

    const listeners = this.toolChangeListeners.get(toolName)!;
    listeners.add(callback);

    // Immediately call with current value
    const current = this.toolRegistry.get(toolName);
    if (current) {
      callback({
        refCount: current.refCount,
        isRegistered: current.isRegistered,
      });
    } else {
      callback(null);
    }

    // Return unsubscribe function
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.toolChangeListeners.delete(toolName);
      }
    };
  }

  /**
   * Notify all listeners about tool changes
   * @private
   */
  private notifyToolChange(toolName: string): void {
    const listeners = this.toolChangeListeners.get(toolName);
    if (!listeners || listeners.size === 0) return;

    const info = this.toolRegistry.get(toolName);
    const payload = info
      ? {
          refCount: info.refCount,
          isRegistered: info.isRegistered,
        }
      : null;

    listeners.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        logger.error('[WorkerClient] Error in tool change listener:', error);
      }
    });
  }

  /**
   * Get tool info from registry
   */
  public getToolInfo(
    toolName: string,
  ): { refCount: number; isRegistered: boolean } | null {
    const info = this.toolRegistry.get(toolName);
    if (!info) return null;

    return {
      refCount: info.refCount,
      isRegistered: info.isRegistered,
    };
  }

  /**
   * Get all registered tool names
   */
  public getRegisteredTools(): string[] {
    return Array.from(this.toolRegistry.keys()).filter(
      (name) => this.toolRegistry.get(name)?.isRegistered,
    );
  }

  /**
   * Check if a tool is registered
   */
  public isToolRegistered(toolName: string): boolean {
    return this.toolRegistry.get(toolName)?.isRegistered ?? false;
  }

  /**
   * Handle tool call from worker - execute handler in main thread and return result
   * @private
   */
  private async handleToolCall(
    toolName: string,
    args: unknown,
    callId: string,
  ): Promise<void> {
    logger.log(`[WorkerClient] Handling tool call: ${toolName}`, {
      callId,
      args,
    });

    try {
      const handler = this.toolHandlers.get(toolName);

      if (!handler) {
        throw new Error(`Tool handler not found: ${toolName}`);
      }

      // Execute handler in main thread (with full access to everything!)
      const result = await handler(args);

      // Send result back to worker
      this.sendToolCallResult(callId, { success: true, result });
    } catch (error) {
      logger.error(`[WorkerClient] Tool call failed: ${toolName}`, error);

      // Send error back to worker
      this.sendToolCallResult(callId, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send tool call result back to worker
   * @private
   */
  private sendToolCallResult(
    callId: string,
    result: { success: boolean; result?: unknown; error?: string },
  ): void {
    const message = {
      type: 'TOOL_CALL_RESULT',
      callId,
      success: result.success,
      result: result.result,
      error: result.error,
    };

    if (this.workerType === 'shared' && this.sharedWorkerPort) {
      try {
        this.sharedWorkerPort.postMessage(message);
      } catch (error) {
        logger.error(
          '[WorkerClient] Failed to send result to SharedWorker:',
          error,
        );
      }
    } else if (
      this.workerType === 'service' &&
      this.serviceWorkerRegistration?.active
    ) {
      try {
        this.serviceWorkerRegistration.active.postMessage(message);
      } catch (error) {
        logger.error(
          '[WorkerClient] Failed to send result to ServiceWorker:',
          error,
        );
      }
    }
  }
}
