import { queryEvents, type UserEvent, workerClient } from '@mcp-fe/mcp-worker';
export type { UserEvent } from '@mcp-fe/mcp-worker';


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


// Public API - thin wrappers around workerClient
export async function initEventTracker(registration?: ServiceWorkerRegistration): Promise<void> {
  return workerClient.init(registration);
}

export async function trackEvent(event: UserEventData): Promise<void> {
  const userEvent = { ...event, timestamp: Date.now() };
  // use request to ensure the worker stored the event; mimic previous behavior
  await workerClient.request('STORE_EVENT', { event: userEvent });
}

export async function getStoredEvents(): Promise<UserEvent[]> {
  const res = await queryEvents();
  return Array.isArray(res) ? res : [];
}

export async function getConnectionStatus(): Promise<boolean> {
  return workerClient.getConnectionStatus();
}

export function setAuthToken(token: string): void {
  workerClient.setAuthToken(token);
}

// Connection status subscription helpers
export function onConnectionStatus(cb: (connected: boolean) => void): void {
  workerClient.onConnectionStatus(cb);
}

export function offConnectionStatus(cb: (connected: boolean) => void): void {
  workerClient.offConnectionStatus(cb);
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
