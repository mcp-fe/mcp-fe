/**
 * Event Tracker - Client-side utilities to send events to the service worker or shared worker
 *
 * Refactored: encapsulate worker selection (SharedWorker preferred, ServiceWorker fallback)
 * into a WorkerClient class that exposes a unified interface used by the rest of the module.
 */

export interface UserEventData {
  type: 'navigation' | 'click' | 'input' | 'custom';
  path?: string;
  from?: string;
  to?: string;
  element?: string;
  elementId?: string;
  elementClass?: string;
  elementText?: string;
  metadata?: Record<string, unknown>;
}

type WorkerType = 'shared' | 'service';

/**
 * WorkerClient encapsulates the worker selection and messaging logic.
 * Public methods provide a unified API to the rest of the library.
 */
class WorkerClient {
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private sharedWorker: SharedWorker | null = null;
  private sharedWorkerPort: MessagePort | null = null;
  private workerType: WorkerType | null = null;
  private pendingAuthToken: string | null = null;

  // Initialize and choose worker implementation (prefer SharedWorker)
  public async init(registration?: ServiceWorkerRegistration): Promise<void> {
    // If an explicit ServiceWorker registration is provided, use it
    if (registration) {
      this.serviceWorkerRegistration = registration;
      this.workerType = 'service';
      console.log('[EventTracker] Using ServiceWorker (explicit registration)');
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
        this.sharedWorker = new SharedWorker('/shared-worker.js', { type: 'module' });
        this.sharedWorkerPort = this.sharedWorker.port;
        this.sharedWorkerPort.start();

        // SharedWorker error handler
        this.sharedWorker.onerror = (event: ErrorEvent) => {
          console.error('[EventTracker] SharedWorker error:', event.message || event.error || event);
          // If we haven't settled on shared worker, fallback to service worker
          if (this.workerType !== 'shared') {
            this.initServiceWorkerFallback().catch((err) => {
              console.error('[EventTracker] Failed to initialize ServiceWorker fallback:', err);
            });
          }
        };

        // Await an initial CONNECTION_STATUS message (or timeout)
        await new Promise<void>((resolve, reject) => {
          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) {
              // Stop listening to avoid leaking handlers
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
            if (resolved) return;
            console.log('[EventTracker] Received initialization message from SharedWorker:', ev.data);
            if (ev.data && ev.data.type === 'CONNECTION_STATUS') {
              clearTimeout(timeout);
              resolved = true;
              this.workerType = 'shared';
              // remove temporary handler
              p.onmessage = null;
              resolve();
            }
          };
        });

        // Send pending auth token if any
        const portAfterInit = this.sharedWorkerPort;
        if (this.pendingAuthToken && portAfterInit) {
          try {
            portAfterInit.postMessage({ type: 'SET_AUTH_TOKEN', token: this.pendingAuthToken });
            this.pendingAuthToken = null;
          } catch (e) {
            console.error('[EventTracker] Failed to send pending auth token to SharedWorker:', e);
          }
        }

        console.log('[EventTracker] Using SharedWorker');
        return;
      } catch (error) {
        console.warn('[EventTracker] SharedWorker not available, falling back to ServiceWorker:', error);
        // fall through to service worker fallback
      }
    }

    // If SharedWorker isn't supported or failed, use service worker
    await this.initServiceWorkerFallback();

    // Send pending token if any
    if (this.pendingAuthToken && this.workerType === 'service') {
      this.sendAuthTokenToServiceWorker(this.pendingAuthToken);
      this.pendingAuthToken = null;
    }
  }

  private async initServiceWorkerFallback(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const existingRegistration = await navigator.serviceWorker.getRegistration();
        if (existingRegistration) {
          this.serviceWorkerRegistration = existingRegistration;
          this.workerType = 'service';
          console.log('[EventTracker] Using existing ServiceWorker registration');
          return;
        }

        const reg = await navigator.serviceWorker.register('/sw.js');
        this.serviceWorkerRegistration = reg;
        this.workerType = 'service';
        console.log('[EventTracker] Using ServiceWorker (fallback)');
      } catch (error) {
        console.error('[EventTracker] Failed to register ServiceWorker:', error);
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
        console.error('[EventTracker] Failed to post to SharedWorker:', e);
      }
      return;
    }

    if (this.workerType === 'service' && this.serviceWorkerRegistration?.active) {
      try {
        this.serviceWorkerRegistration.active.postMessage({ type, ...(payload || {}) });
      } catch (e) {
        console.error('[EventTracker] Failed to post to ServiceWorker (active):', e);
      }
      return;
    }

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({ type, ...(payload || {}) });
      } catch (e) {
        console.error('[EventTracker] Failed to post to ServiceWorker.controller:', e);
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
        console.error('[EventTracker] Failed to send auth token to ServiceWorker:', e);
      }
    } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({ type: 'SET_AUTH_TOKEN', token });
      } catch (e) {
        console.error('[EventTracker] Failed to send auth token to ServiceWorker.controller:', e);
      }
    } else {
      // keep as pending
      this.pendingAuthToken = token;
    }
  }

  // Public convenience wrappers
  public async trackEvent(event: UserEventData): Promise<void> {
    const userEvent = { ...event, timestamp: Date.now() };
    await this.request('STORE_EVENT', { event: userEvent }).catch((err) => { throw err; });
  }

  public async getStoredEvents(): Promise<any[]> {
    const res = await this.request('GET_EVENTS');
    // res may be { success: true, events } or just events; normalize
    if (res && typeof res === 'object' && 'events' in (res as any)) return (res as any).events;
    return Array.isArray(res) ? (res as any) : [];
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
        console.error('[EventTracker] Failed to set auth token on SharedWorker:', e);
      }
    } else if (this.workerType === 'service') {
      this.sendAuthTokenToServiceWorker(token);
      this.pendingAuthToken = null;
    } else {
      // queued and will be sent when init finishes
    }
  }
}

// Singleton client used by exported functions
const workerClient = new WorkerClient();

// Public API - thin wrappers around workerClient
export async function initEventTracker(registration?: ServiceWorkerRegistration): Promise<void> {
  return workerClient.init(registration);
}

export async function trackEvent(event: UserEventData): Promise<void> {
  return workerClient.trackEvent(event);
}

export async function getStoredEvents(): Promise<any[]> {
  return workerClient.getStoredEvents();
}

export async function getConnectionStatus(): Promise<boolean> {
  return workerClient.getConnectionStatus();
}

export function setAuthToken(token: string): void {
  workerClient.setAuthToken(token);
}

// Convenience helpers (kept outside for ergonomic API)
export async function trackNavigation(from: string, to: string, path?: string): Promise<void> {
  return trackEvent({ type: 'navigation', from, to, path: path || to });
}

export async function trackClick(element: HTMLElement, path?: string, metadata?: Record<string, unknown>): Promise<void> {
  const elementId = element.id || undefined;
  const elementClass = element.className || undefined;
  const elementText = element.textContent?.trim().substring(0, 100) || undefined;
  const tagName = element.tagName.toLowerCase();

  return trackEvent({
    type: 'click',
    element: tagName,
    elementId,
    elementClass,
    elementText,
    path: path || window.location.pathname,
    metadata,
  });
}

export async function trackInput(element: HTMLElement, value?: string, path?: string): Promise<void> {
  const elementId = element.id || undefined;
  const elementClass = element.className || undefined;
  const tagName = element.tagName.toLowerCase();

  return trackEvent({
    type: 'input',
    element: tagName,
    elementId,
    elementClass,
    path: path || window.location.pathname,
    metadata: {
      valueLength: value?.length || 0,
      value: value,
    },
  });
}

export async function trackCustom(eventName: string, metadata?: Record<string, unknown>, path?: string): Promise<void> {
  return trackEvent({
    type: 'custom',
    path: path || window.location.pathname,
    metadata: {
      eventName,
      ...metadata,
    },
  });
}
