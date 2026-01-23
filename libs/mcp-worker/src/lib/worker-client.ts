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

  // Initialize and choose worker implementation (prefer SharedWorker)
  // Accept either a ServiceWorkerRegistration OR WorkerInitOptions to configure URLs
  public async init(
    registrationOrOptions?: ServiceWorkerRegistration | WorkerClientInitOptions,
  ): Promise<void> {
    // Normalize args: if a ServiceWorkerRegistration is provided, use it. Otherwise
    // treat the argument as WorkerInitOptions (or undefined).
    let explicitRegistration: ServiceWorkerRegistration | undefined;
    const maybeReg = registrationOrOptions as unknown as { scope?: string } | undefined;
    if (maybeReg && typeof maybeReg.scope === 'string') {
      explicitRegistration = registrationOrOptions as ServiceWorkerRegistration;
    } else if (registrationOrOptions) {
      const opts = registrationOrOptions as WorkerClientInitOptions;
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
          console.log(
            '[WorkerClient] Using ServiceWorker (explicit registration)',
          );
          // Send INIT (backend URL + auth token if available) to the worker (best-effort)
          try {
            const initMsg: Record<string, unknown> = { type: 'INIT', backendUrl: this.backendWsUrl };
            if (this.pendingAuthToken) initMsg['token'] = this.pendingAuthToken;
            // try active first
            if (this.serviceWorkerRegistration.active) {
              this.serviceWorkerRegistration.active.postMessage(initMsg);
            } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
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
        if (sharedOk) return;

        // If SharedWorker isn't supported or failed, use service worker
        await this.initServiceWorkerFallback();
      } finally {
        // Clear the mutex so future init calls can proceed
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private async initSharedWorker(): Promise<boolean> {
    if (typeof SharedWorker === 'undefined') {
      return false;
    }

    try {
      this.sharedWorker = new SharedWorker(this.sharedWorkerUrl, {
        type: 'module',
      });
      this.sharedWorkerPort = this.sharedWorker.port;
      this.sharedWorkerPort.start();

      // We will send INIT (backendUrl + optional token) once the shared worker confirms availability
      await new Promise<void>((resolve, reject) => {
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
              resolve();
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
          const initMsg: Record<string, unknown> = { type: 'INIT', backendUrl: this.backendWsUrl };
          if (this.pendingAuthToken) initMsg['token'] = this.pendingAuthToken;
          portAfterInit.postMessage(initMsg);
          // clear pending token after sending INIT
          this.pendingAuthToken = null;
        } catch (e) {
          console.warn('[WorkerClient] Failed to send INIT to SharedWorker port:', e);
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
            }
          } catch {
            // ignore
          }
        };
      }

      console.log('[WorkerClient] Using SharedWorker');
      return true;
    } catch (error) {
      console.warn(
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
          console.log(
            '[WorkerClient] Using existing ServiceWorker registration',
          );
          return;
        }

        this.serviceWorkerRegistration = await navigator.serviceWorker.register(
          this.serviceWorkerUrl,
        );
        this.workerType = 'service';
        console.log('[WorkerClient] Using MCP ServiceWorker (fallback)');
        // Send INIT (backend URL + optional token) to service worker (best-effort)
        try {
          const initMsg: Record<string, unknown> = { type: 'INIT', backendUrl: this.backendWsUrl };
          if (this.pendingAuthToken) initMsg['token'] = this.pendingAuthToken;
          if (this.serviceWorkerRegistration.active) {
            this.serviceWorkerRegistration.active.postMessage(initMsg);
          } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage(initMsg);
          }
          // clear pending token after sending INIT
          this.pendingAuthToken = null;
        } catch {
          // ignore
        }
      } catch (error) {
        console.error(
          '[WorkerClient] Failed to register ServiceWorker:',
          error,
        );
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
    // If using shared worker
    if (this.workerType === 'shared' && this.sharedWorkerPort) {
      return new Promise<T>((resolve, reject) => {
        const mc = new MessageChannel();
        const timer = setTimeout(() => {
          mc.port1.onmessage = null;
          reject(new Error('Request timeout'));
        }, timeoutMs);

        mc.port1.onmessage = (ev: MessageEvent) => {
          clearTimeout(timer);
          if (ev.data && ev.data.success) {
            resolve(ev.data as T);
          } else if (ev.data && ev.data.success === false) {
            reject(new Error(ev.data.error || 'Worker error'));
          } else {
            resolve(ev.data as T);
          }
        };

        try {
          const port = this.sharedWorkerPort;
          if (!port) {
            clearTimeout(timer);
            return reject(new Error('SharedWorker port not available'));
          }
          port.postMessage({ type, ...(payload || {}) }, [mc.port2]);
        } catch (e) {
          clearTimeout(timer);
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
        await navigator.serviceWorker.ready;
        if (!reg.active) {
          throw new Error('Service worker not active');
        }
      }

      return new Promise<T>((resolve, reject) => {
        const mc = new MessageChannel();
        const timer = setTimeout(() => {
          mc.port1.onmessage = null;
          reject(new Error('Request timeout'));
        }, timeoutMs);

        mc.port1.onmessage = (ev: MessageEvent) => {
          clearTimeout(timer);
          if (ev.data && ev.data.success) {
            resolve(ev.data as T);
          } else if (ev.data && ev.data.success === false) {
            reject(new Error(ev.data.error || 'Worker error'));
          } else {
            resolve(ev.data as T);
          }
        };

        try {
          const active = reg.active;
          if (!active) {
            clearTimeout(timer);
            return reject(
              new Error('Service worker active instance not available'),
            );
          }
          active.postMessage({ type, ...(payload || {}) }, [mc.port2]);
        } catch (e) {
          clearTimeout(timer);
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
        console.error('[WorkerClient] Failed to post to SharedWorker:', e);
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
        console.error(
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
        console.error(
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
        console.error(
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
}
