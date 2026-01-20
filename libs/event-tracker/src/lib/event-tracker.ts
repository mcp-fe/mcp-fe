/**
 * Event Tracker - Client-side utilities to send events to the service worker or shared worker
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

let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
let sharedWorker: SharedWorker | null = null;
let sharedWorkerPort: MessagePort | null = null;
let workerType: WorkerType | null = null;

/**
 * Initialize the event tracker with SharedWorker (preferred) or ServiceWorker (fallback)
 */
export async function initEventTracker(
  registration?: ServiceWorkerRegistration,
): Promise<void> {
  // Try SharedWorker first if not explicitly provided with ServiceWorker registration
  if (!registration && typeof SharedWorker !== 'undefined') {
    try {
      sharedWorker = new SharedWorker('/shared-worker.js', { type: 'module' });
      sharedWorkerPort = sharedWorker.port;
      sharedWorkerPort.start();

      // Handle SharedWorker errors (on the SharedWorker object, not the port)
      sharedWorker.onerror = (error) => {
        console.error('[EventTracker] SharedWorker error:', error);
      };

      // Wait a bit for the SharedWorker to initialize
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('SharedWorker initialization timeout'));
        }, 2000);

        sharedWorkerPort!.onmessage = (event) => {
          if (event.data.type === 'CONNECTION_STATUS') {
            clearTimeout(timeout);
            workerType = 'shared';
            resolve();
          }
        };
      });

      console.log('[EventTracker] Using SharedWorker');
      return;
    } catch (error) {
      console.warn('[EventTracker] SharedWorker not available, falling back to ServiceWorker:', error);
      // Fall through to ServiceWorker
    }
  }

  // Fallback to ServiceWorker
  if (registration) {
    serviceWorkerRegistration = registration;
    workerType = 'service';
    console.log('[EventTracker] Using ServiceWorker');
  } else if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      serviceWorkerRegistration = reg;
      workerType = 'service';
      console.log('[EventTracker] Using ServiceWorker (fallback)');
    } catch (error) {
      console.error('[EventTracker] Failed to register ServiceWorker:', error);
    }
  }
}

/**
 * Send an event to the worker (SharedWorker or ServiceWorker) for storage
 */
export async function trackEvent(event: UserEventData): Promise<void> {
  if (workerType === 'shared' && sharedWorkerPort) {
    const eventWithTimestamp = {
      ...event,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error || 'Failed to communicate with SharedWorker'));
        }
      };

      sharedWorkerPort!.postMessage(
        {
          type: 'STORE_EVENT',
          event: eventWithTimestamp,
        },
        [messageChannel.port2],
      );

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Event tracking timeout'));
      }, 5000);
    });
  }

  if (workerType === 'service' && serviceWorkerRegistration) {
    // Wait for service worker to be ready
    if (!serviceWorkerRegistration.active) {
      await navigator.serviceWorker.ready;
      if (!serviceWorkerRegistration.active) {
        console.warn('Service worker not active, event not tracked:', event);
        return;
      }
    }

    const eventWithTimestamp = {
      ...event,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error || 'Failed to communicate with service worker'));
        }
      };

      serviceWorkerRegistration!.active!.postMessage(
        {
          type: 'STORE_EVENT',
          event: eventWithTimestamp,
        },
        [messageChannel.port2],
      );

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Event tracking timeout'));
      }, 5000);
    });
  }

  console.warn('No worker registered, event not tracked:', event);
}

/**
 * Get all events from the worker (SharedWorker or ServiceWorker)
 */
export async function getStoredEvents(): Promise<any[]> {
  if (workerType === 'shared' && sharedWorkerPort) {
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(event.data.events);
        } else {
          reject(new Error(event.data.error || 'Failed to fetch events'));
        }
      };

      sharedWorkerPort!.postMessage(
        {
          type: 'GET_EVENTS',
        },
        [messageChannel.port2],
      );

      setTimeout(() => reject(new Error('Fetch events timeout')), 5000);
    });
  }

  if (workerType === 'service' && serviceWorkerRegistration) {
    if (!serviceWorkerRegistration.active) {
      await navigator.serviceWorker.ready;
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(event.data.events);
        } else {
          reject(new Error(event.data.error || 'Failed to fetch events'));
        }
      };

      serviceWorkerRegistration!.active!.postMessage(
        {
          type: 'GET_EVENTS',
        },
        [messageChannel.port2],
      );

      setTimeout(() => reject(new Error('Fetch events timeout')), 5000);
    });
  }

  return [];
}

/**
 * Get the current connection status from the worker (SharedWorker or ServiceWorker)
 */
export async function getConnectionStatus(): Promise<boolean> {
  if (workerType === 'shared' && sharedWorkerPort) {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(!!event.data.connected);
        } else {
          resolve(false);
        }
      };

      sharedWorkerPort!.postMessage(
        {
          type: 'GET_CONNECTION_STATUS',
        },
        [messageChannel.port2],
      );

      setTimeout(() => resolve(false), 2000);
    });
  }

  if (workerType === 'service' && serviceWorkerRegistration) {
    if (!serviceWorkerRegistration.active) {
      await navigator.serviceWorker.ready;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(!!event.data.connected);
        } else {
          resolve(false);
        }
      };

      serviceWorkerRegistration!.active!.postMessage(
        {
          type: 'GET_CONNECTION_STATUS',
        },
        [messageChannel.port2],
      );

      setTimeout(() => resolve(false), 2000);
    });
  }

  return false;
}

/**
 * Set the auth token for the worker (SharedWorker or ServiceWorker)
 */
export function setAuthToken(token: string): void {
  if (workerType === 'shared' && sharedWorkerPort) {
    sharedWorkerPort.postMessage({
      type: 'SET_AUTH_TOKEN',
      token,
    });
  } else if (workerType === 'service' && serviceWorkerRegistration?.active) {
    serviceWorkerRegistration.active.postMessage({
      type: 'SET_AUTH_TOKEN',
      token,
    });
  } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Fallback: try to send directly to service worker controller
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_AUTH_TOKEN',
      token,
    });
  }
}

/**
 * Track a navigation event
 */
export async function trackNavigation(
  from: string,
  to: string,
  path?: string,
): Promise<void> {
  return trackEvent({
    type: 'navigation',
    from,
    to,
    path: path || to,
  });
}

/**
 * Track a click event
 */
export async function trackClick(
  element: HTMLElement,
  path?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const elementId = element.id || undefined;
  const elementClass = element.className || undefined;
  const elementText =
    element.textContent?.trim().substring(0, 100) || undefined;
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

/**
 * Track an input event
 */
export async function trackInput(
  element: HTMLElement,
  value?: string,
  path?: string,
): Promise<void> {
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

/**
 * Track a custom event
 */
export async function trackCustom(
  eventName: string,
  metadata?: Record<string, unknown>,
  path?: string,
): Promise<void> {
  return trackEvent({
    type: 'custom',
    path: path || window.location.pathname,
    metadata: {
      eventName,
      ...metadata,
    },
  });
}
