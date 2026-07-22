/**
 * IndexedDB operations for storing and querying user events
 */

import { logger } from './logger';
import type { UserEvent, EventFilters } from './types';

const DB_NAME = 'user-activity-db';
const DB_VERSION = 1;
const STORE_NAME = 'user-events';

// Cached connection: every storeEvent/queryEvents call used to open (and never
// close) a brand new IndexedDB connection, leaking one connection per operation.
// Open once and reuse it, re-opening only if the connection is later closed.
let dbPromise: Promise<IDBDatabase> | null = null;

// Initialize IndexedDB
export async function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onblocked = () => {
      logger.warn(
        `[Database] Open blocked: another connection to '${DB_NAME}' is holding an older version open`,
      );
    };

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

  return dbPromise;
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
  countRequest.onerror = () => {
    logger.warn('[Database] Failed to count events for pruning:', countRequest.error);
  };
  countRequest.onsuccess = () => {
    if (countRequest.result > 1000) {
      const index = store.index('timestamp');
      const getAllRequest = index.getAll();
      getAllRequest.onerror = () => {
        logger.warn(
          '[Database] Failed to load events for pruning:',
          getAllRequest.error,
        );
      };
      getAllRequest.onsuccess = () => {
        const events = getAllRequest.result as UserEvent[];
        events.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = events.slice(0, events.length - 1000);
        toDelete.forEach((event) => {
          const deleteRequest = store.delete(event.id);
          deleteRequest.onerror = () => {
            logger.warn(
              `[Database] Failed to prune event ${event.id}:`,
              deleteRequest.error,
            );
          };
        });
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

/**
 * Test-only: close the cached connection so the next initDB() call opens a
 * fresh one. Not used by production code paths.
 */
export async function __closeDbForTests(): Promise<void> {
  const current = dbPromise;
  dbPromise = null;
  if (!current) return;
  try {
    (await current).close();
  } catch {
    // already closed/errored — nothing to do
  }
}
