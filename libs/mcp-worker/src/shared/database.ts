/**
 * IndexedDB operations for storing and querying user events
 */

import type { UserEvent, EventFilters } from '../shared/types';

const DB_NAME = 'user-activity-db';
const DB_VERSION = 1;
const STORE_NAME = 'user-events';

// Initialize IndexedDB
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('path', 'path', { unique: false });
      }
    };
  });
}

// Store event in IndexedDB
export async function storeEvent(event: Omit<UserEvent, 'id'>): Promise<void> {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const eventWithId: UserEvent = {
    ...event,
    id: `${event.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
  };

  await new Promise<void>((resolve, reject) => {
    const request = store.add(eventWithId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Clean up old events (keep last 1000 events)
  const countRequest = store.count();
  countRequest.onsuccess = () => {
    if (countRequest.result > 1000) {
      const index = store.index('timestamp');
      const getAllRequest = index.getAll();
      getAllRequest.onsuccess = () => {
        const events = getAllRequest.result as UserEvent[];
        events.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = events.slice(0, events.length - 1000);
        toDelete.forEach((event) => store.delete(event.id));
      };
    }
  };
}

// Query events from IndexedDB
export async function queryEvents(
  filters?: EventFilters,
): Promise<UserEvent[]> {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('timestamp');

  return new Promise((resolve, reject) => {
    const request = index.getAll();
    request.onsuccess = () => {
      let events = request.result as UserEvent[];

      // Apply filters
      if (filters?.type) {
        events = events.filter((e) => e.type === filters.type);
      }
      if (filters?.startTime) {
        events = events.filter((e) => e.timestamp >= filters.startTime!);
      }
      if (filters?.endTime) {
        events = events.filter((e) => e.timestamp <= filters.endTime!);
      }
      if (filters?.path) {
        events = events.filter((e) => e.path?.includes(filters.path!));
      }

      // Sort by timestamp descending (newest first)
      events.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (filters?.limit) {
        events = events.slice(0, filters.limit);
      }

      resolve(events);
    };
    request.onerror = () => reject(request.error);
  });
}
