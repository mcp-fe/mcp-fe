type WorkerType = 'shared' | 'service';

export class WorkerClient {
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private sharedWorker: SharedWorker | null = null;
  private sharedWorkerPort: MessagePort | null = null;
  private workerType: WorkerType | null = null;
  private pendingAuthToken: string | null = null;
  // connection status subscribers
  private connectionStatusCallbacks: Set<(connected: boolean) => void> = new Set();
  private serviceWorkerMessageHandler: ((ev: MessageEvent) => void) | null = null;

  // Mutex/promise to prevent concurrent init runs
  private initPromise: Promise<void> | null = null;

  // Initialize and choose worker implementation (prefer SharedWorker)
  public async init(registration?: ServiceWorkerRegistration): Promise<void> {
    // If an init is already in progress, wait for it and optionally retry if caller provided a registration
    if (this.initPromise) {
      return this.initPromise.then(async () => {
        if (registration && this.workerType !== 'service') {
          // retry once with provided registration after current init finished
          await this.init(registration);
        }
      });
    }

    // Start initialization and store the promise as a mutex
    this.initPromise = (async () => {
      try {
        // If an explicit ServiceWorker registration is provided, use it
        if (registration) {
          this.serviceWorkerRegistration = registration;
          this.workerType = 'service';
          console.log('[WorkerClient] Using ServiceWorker (explicit registration)');
          // send pending token if exists
          if (this.pendingAuthToken) {
            this.sendAuthTokenToServiceWorker(this.pendingAuthToken);
            this.pendingAuthToken = null;
          }
          return;
        }

        // Try SharedWorker first
        if (typeof SharedWorker !== 'undefined') {
          try {
            this.sharedWorker = new SharedWorker('/mcp-shared-worker.js', { type: 'module' });
            this.sharedWorkerPort = this.sharedWorker.port;
            this.sharedWorkerPort.start();

            if (this.pendingAuthToken && this.sharedWorkerPort) {
              try {
                this.sharedWorkerPort.postMessage({ type: 'SET_AUTH_TOKEN', token: this.pendingAuthToken });
              } catch (err) {
                console.warn('[WorkerClient] Immediate postMessage to SharedWorker failed (will retry after init):', err);
              }
            }

            this.sharedWorker.onerror = (event: ErrorEvent) => {
              console.error('[WorkerClient] SharedWorker error:', event.message || event.error || event);
              if (this.workerType !== 'shared') {
                this.initServiceWorkerFallback().catch((err) => {
                  console.error('[WorkerClient] Failed to initialize ServiceWorker fallback:', err);
                });
              }
            };

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
            if (this.pendingAuthToken && portAfterInit) {
              try {
                portAfterInit.postMessage({ type: 'SET_AUTH_TOKEN', token: this.pendingAuthToken });
                this.pendingAuthToken = null;
              } catch (e) {
                console.error('[WorkerClient] Failed to send pending auth token to SharedWorker:', e);
              }
            }

            if (portAfterInit) {
              portAfterInit.onmessage = (ev: MessageEvent) => {
                try {
                  const data = ev.data;
                  if (data && data.type === 'CONNECTION_STATUS') {
                    const connected = !!data.connected;
                    this.connectionStatusCallbacks.forEach((cb) => {
                      try { cb(connected); } catch (e) { /* ignore callback errors */ }
                    });
                  }
                } catch {
                  // ignore
                }
              };
            }

            console.log('[WorkerClient] Using SharedWorker');
            return;
          } catch (error) {
            console.warn('[WorkerClient] SharedWorker not available, falling back to ServiceWorker:', error);
          }
        }

        // If SharedWorker isn't supported or failed, use service worker
        console.log("this should not be called");
        await this.initServiceWorkerFallback();

        // Send pending token if any
        if (this.pendingAuthToken && this.workerType === 'service') {
          this.sendAuthTokenToServiceWorker(this.pendingAuthToken);
          this.pendingAuthToken = null;
        }
      } finally {
        // Clear the mutex so future init calls can proceed
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private async initServiceWorkerFallback(): Promise<void> {
    console.log("initServiceWorkerFallback called");
    if ('serviceWorker' in navigator) {
      try {
        const existingRegistration = await navigator.serviceWorker.getRegistration();
        if (existingRegistration) {
          this.serviceWorkerRegistration = existingRegistration;
          this.workerType = 'service';
          console.log('[WorkerClient] Using existing ServiceWorker registration');
          return;
        }

        const reg = await navigator.serviceWorker.register('/mcp-service-worker.js');
        this.serviceWorkerRegistration = reg;
        this.workerType = 'service';
        console.log('[WorkerClient] Using ServiceWorker (fallback)');
        if (this.serviceWorkerMessageHandler) {
          navigator.serviceWorker.removeEventListener('message', this.serviceWorkerMessageHandler);
          this.serviceWorkerMessageHandler = null;
        }
        this.serviceWorkerMessageHandler = (ev: MessageEvent) => {
          try {
            const data = ev.data;
            if (data && data.type === 'CONNECTION_STATUS') {
              const connected = !!data.connected;
              this.connectionStatusCallbacks.forEach((cb) => {
                try { cb(connected); } catch (e) { /* ignore callback errors */ }
              });
            }
          } catch {
            // ignore
          }
        };
        navigator.serviceWorker.addEventListener('message', this.serviceWorkerMessageHandler);
      } catch (error) {
        console.error('[WorkerClient] Failed to register ServiceWorker:', error);
        throw error;
      }
    } else {
      throw new Error('Neither SharedWorker nor ServiceWorker is supported');
    }
  }

  // Low-level request that expects a reply via MessageChannel
  public async request<T = any>(type: string, payload?: Record<string, unknown>, timeoutMs = 5000): Promise<T> {
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
            return reject(new Error('Service worker active instance not available'));
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
  public async post(type: string, payload?: Record<string, unknown>): Promise<void> {
    if (this.workerType === 'shared' && this.sharedWorkerPort) {
      try {
        this.sharedWorkerPort.postMessage({ type, ...(payload || {}) });
      } catch (e) {
        console.error('[WorkerClient] Failed to post to SharedWorker:', e);
      }
      return;
    }

    if (this.workerType === 'service' && this.serviceWorkerRegistration?.active) {
      try {
        this.serviceWorkerRegistration.active.postMessage({ type, ...(payload || {}) });
      } catch (e) {
        console.error('[WorkerClient] Failed to post to ServiceWorker (active):', e);
      }
      return;
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({ type, ...(payload || {}) });
      } catch (e) {
        console.error('[WorkerClient] Failed to post to ServiceWorker.controller:', e);
      }
      return;
    }

    // If no worker yet, queue token if SET_AUTH_TOKEN
    if (type === 'SET_AUTH_TOKEN' && payload) {
      const token = (payload as any)['token'];
      if (typeof token === 'string') this.pendingAuthToken = token;
    }
  }

  private sendAuthTokenToServiceWorker(token: string): void {
    if (this.serviceWorkerRegistration?.active) {
      try {
        this.serviceWorkerRegistration.active.postMessage({ type: 'SET_AUTH_TOKEN', token });
      } catch (e) {
        console.error('[WorkerClient] Failed to send auth token to ServiceWorker:', e);
      }
    } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({ type: 'SET_AUTH_TOKEN', token });
      } catch (e) {
        console.error('[WorkerClient] Failed to send auth token to ServiceWorker.controller:', e);
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
      const res = await this.request('GET_CONNECTION_STATUS', undefined, 2000);
      if (res && typeof res === 'object' && 'connected' in (res as any)) return !!(res as any).connected;
      return !!(res as any).connected;
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
        console.error('[WorkerClient] Failed to set auth token on SharedWorker:', e);
      }
    } else if (this.workerType === 'service') {
      this.sendAuthTokenToServiceWorker(token);
      this.pendingAuthToken = null;
    } else {
      // queued and will be sent when init finishes
    }
  }
}
