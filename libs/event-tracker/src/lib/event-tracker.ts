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
let pendingAuthToken: string | null = null;

/**
 * Initialize the event tracker with SharedWorker (preferred) or ServiceWorker (fallback)
 * Only one worker type will be used - SharedWorker if supported, otherwise ServiceWorker
 */
export async function initEventTracker(
  registration?: ServiceWorkerRegistration,
): Promise<void> {
  // If explicitly provided with ServiceWorker registration, use it directly
  if (registration) {
    serviceWorkerRegistration = registration;
    workerType = 'service';
    console.log('[EventTracker] Using ServiceWorker (explicit registration)');
    return;
  }

  // Try SharedWorker first if supported
  if (typeof SharedWorker !== 'undefined') {
    try {
      sharedWorker = new SharedWorker('/shared-worker.js', { type: 'module' });
      sharedWorkerPort = sharedWorker.port;
      sharedWorkerPort.start();

      // Handle SharedWorker errors (on the SharedWorker object, not the port)
      // Note: onerror receives an ErrorEvent, not an Error
      sharedWorker.onerror = (event: ErrorEvent) => {
        console.error('[EventTracker] SharedWorker error:', event.message || event.error || event);
        // On error, fall back to ServiceWorker only if we haven't successfully initialized
        // Don't fallback if we're already using SharedWorker - let it handle its own errors
        if (workerType !== 'shared') {
          initServiceWorkerFallback().catch((err) => {
            console.error('[EventTracker] Failed to initialize ServiceWorker fallback:', err);
          });
        }
      };

      // Wait a bit for the SharedWorker to initialize
      let isResolved = false;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!isResolved && sharedWorkerPort) {
            sharedWorkerPort.onmessage = null;
          }
          reject(new Error('SharedWorker initialization timeout'));
        }, 2000);

        // Set up temporary message handler just for initialization
        const initializationHandler = (event: MessageEvent) => {
          if (isResolved) {
            // Already resolved, ignore subsequent messages
            return;
          }
          
          console.log('[EventTracker] Received initialization message from SharedWorker:', event.data);
          if (event.data.type === 'CONNECTION_STATUS') {
            clearTimeout(timeout);
            workerType = 'shared';
            isResolved = true;
            console.log('[EventTracker] SharedWorker is ready, workerType set to:', workerType);
            
            // Remove this temporary handler to prevent it from firing on subsequent CONNECTION_STATUS messages
            if (sharedWorkerPort) {
              sharedWorkerPort.onmessage = null;
            }
            
            resolve();
          }
        };
        
        sharedWorkerPort!.onmessage = initializationHandler;
      });

      console.log('[EventTracker] Using SharedWorker');
      
      // Send any pending auth token immediately after initialization
      const tokenToSend = pendingAuthToken;
      if (tokenToSend && sharedWorkerPort) {
        console.log('[EventTracker] Sending pending auth token to SharedWorker after initialization:', tokenToSend);
        try {
          sharedWorkerPort.postMessage({
            type: 'SET_AUTH_TOKEN',
            token: tokenToSend,
          });
          console.log('[EventTracker] Successfully posted SET_AUTH_TOKEN message with token');
          pendingAuthToken = null;
        } catch (error) {
          console.error('[EventTracker] Failed to send pending auth token:', error);
        }
      } else {
        console.log('[EventTracker] No pending auth token to send. pendingAuthToken:', pendingAuthToken, 'hasPort:', !!sharedWorkerPort);
      }

      return; // Successfully initialized SharedWorker, don't register ServiceWorker
    } catch (error) {
      console.warn('[EventTracker] SharedWorker not available, falling back to ServiceWorker:', error);
      // Fall through to ServiceWorker
    }
  }

  // Fallback to ServiceWorker only if SharedWorker is not supported or failed
  await initServiceWorkerFallback();

  // Send any pending auth token to ServiceWorker
  if (pendingAuthToken && workerType === 'service') {
    if (serviceWorkerRegistration?.active) {
      serviceWorkerRegistration.active.postMessage({
        type: 'SET_AUTH_TOKEN',
        token: pendingAuthToken,
      });
    } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_AUTH_TOKEN',
        token: pendingAuthToken,
      });
    }
    pendingAuthToken = null;
  }
}

/**
 * Initialize ServiceWorker as fallback
 */
async function initServiceWorkerFallback(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      // Check if ServiceWorker is already registered
      const existingRegistration = await navigator.serviceWorker.getRegistration();
      if (existingRegistration) {
        serviceWorkerRegistration = existingRegistration;
        workerType = 'service';
        console.log('[EventTracker] Using existing ServiceWorker registration');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      serviceWorkerRegistration = reg;
      workerType = 'service';
      console.log('[EventTracker] Using ServiceWorker (fallback)');
    } catch (error) {
      console.error('[EventTracker] Failed to register ServiceWorker:', error);
      throw error;
    }
  } else {
    throw new Error('Neither SharedWorker nor ServiceWorker is supported');
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
 * If the worker is not yet initialized, the token will be queued and sent once ready
 */
export function setAuthToken(token: string): void {
  console.log('[EventTracker] setAuthToken called:', token, 'workerType:', workerType, 'hasPort:', !!sharedWorkerPort);
  
  // Store the token in case worker isn't ready yet
  pendingAuthToken = token;

  if (workerType === 'shared' && sharedWorkerPort) {
    console.log('[EventTracker] Sending auth token to SharedWorker immediately');
    console.log('[EventTracker] sharedWorkerPort details:', {
      hasPort: !!sharedWorkerPort,
      portType: typeof sharedWorkerPort,
      hasPostMessage: typeof sharedWorkerPort.postMessage,
    });
    try {
      if (typeof sharedWorkerPort.postMessage === 'function') {
        sharedWorkerPort.postMessage({
          type: 'SET_AUTH_TOKEN',
          token,
        });
        console.log('[EventTracker] Successfully posted SET_AUTH_TOKEN message');
        pendingAuthToken = null; // Clear pending since we sent it
      } else {
        console.error('[EventTracker] sharedWorkerPort.postMessage is not a function!');
      }
    } catch (error) {
      console.error('[EventTracker] Failed to send auth token to SharedWorker:', error);
      // Keep it as pending so it can be retried
    }
  } else if (workerType === 'service' && serviceWorkerRegistration?.active) {
    console.log('[EventTracker] Sending auth token to ServiceWorker');
    serviceWorkerRegistration.active.postMessage({
      type: 'SET_AUTH_TOKEN',
      token,
    });
    pendingAuthToken = null; // Clear pending since we sent it
  } else if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Fallback: try to send directly to service worker controller
    console.log('[EventTracker] Sending auth token to ServiceWorker controller (fallback)');
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_AUTH_TOKEN',
      token,
    });
    pendingAuthToken = null; // Clear pending since we sent it
  } else {
    // Worker not ready yet, token is stored in pendingAuthToken
    // It will be sent once the worker initializes
    console.log('[EventTracker] Worker not ready, queuing auth token. workerType:', workerType);
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
