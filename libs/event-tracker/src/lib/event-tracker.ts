/**
 * Event Tracker - Client-side utilities to send events to the service worker
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

let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

/**
 * Initialize the event tracker with service worker registration
 */
export function initEventTracker(
  registration: ServiceWorkerRegistration,
): void {
  serviceWorkerRegistration = registration;
}

/**
 * Send an event to the service worker for storage
 */
export async function trackEvent(event: UserEventData): Promise<void> {
  if (!serviceWorkerRegistration) {
    console.warn('Service worker not registered, event not tracked:', event);
    return;
  }

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
        resolve();
      } else {
        reject(new Error(event.data.error || 'Failed to store event'));
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
