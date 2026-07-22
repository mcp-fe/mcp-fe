import 'fake-indexeddb/auto';
import { initDB, storeEvent, queryEvents, __closeDbForTests } from './database';

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('user-activity-db');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('database (IndexedDB)', () => {
  afterEach(async () => {
    // The cached connection (see database.ts) must be closed before
    // deleteDatabase can proceed — otherwise it blocks indefinitely.
    await __closeDbForTests();
    await deleteDb();
  });

  it('initDB creates the object store with the expected indexes', async () => {
    const db = await initDB();
    expect(db.objectStoreNames.contains('user-events')).toBe(true);

    const tx = db.transaction(['user-events'], 'readonly');
    const store = tx.objectStore('user-events');
    expect(Array.from(store.indexNames).sort()).toEqual([
      'path',
      'timestamp',
      'type',
    ]);
    db.close();
  });

  it('reuses the same cached connection across calls instead of opening a new one each time', async () => {
    const db1 = await initDB();
    const db2 = await initDB();
    expect(db2).toBe(db1);
    db1.close();
  });

  // Not covered here: re-opening after the connection is closed relies on
  // IDBDatabase's `close` event, which fake-indexeddb does not emit — that
  // branch is exercised only against a real browser IndexedDB implementation.

  it('stores an event and assigns it a generated string id', async () => {
    await storeEvent({ type: 'click', timestamp: 1000, path: '/home' });

    const events = await queryEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'click',
      timestamp: 1000,
      path: '/home',
    });
    expect(typeof events[0].id).toBe('string');
  });

  it('returns events sorted newest-first', async () => {
    await storeEvent({ type: 'click', timestamp: 100 });
    await storeEvent({ type: 'click', timestamp: 300 });
    await storeEvent({ type: 'click', timestamp: 200 });

    const events = await queryEvents();
    expect(events.map((e) => e.timestamp)).toEqual([300, 200, 100]);
  });

  it('filters by event type', async () => {
    await storeEvent({ type: 'click', timestamp: 1 });
    await storeEvent({ type: 'navigation', timestamp: 2 });

    const events = await queryEvents({ type: 'navigation' });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('navigation');
  });

  it('filters by a startTime/endTime range', async () => {
    await storeEvent({ type: 'click', timestamp: 100 });
    await storeEvent({ type: 'click', timestamp: 200 });
    await storeEvent({ type: 'click', timestamp: 300 });

    const events = await queryEvents({ startTime: 150, endTime: 250 });
    expect(events.map((e) => e.timestamp)).toEqual([200]);
  });

  it('filters by a path substring', async () => {
    await storeEvent({
      type: 'navigation',
      timestamp: 1,
      path: '/checkout/step1',
    });
    await storeEvent({ type: 'navigation', timestamp: 2, path: '/home' });

    const events = await queryEvents({ path: 'checkout' });
    expect(events).toHaveLength(1);
    expect(events[0].path).toBe('/checkout/step1');
  });

  it('applies a limit after sorting newest-first', async () => {
    for (let i = 0; i < 5; i++) {
      await storeEvent({ type: 'click', timestamp: i });
    }

    const events = await queryEvents({ limit: 2 });
    expect(events.map((e) => e.timestamp)).toEqual([4, 3]);
  });

  it('prunes down to the most recent 1000 events once the cap is exceeded', async () => {
    for (let i = 0; i < 1005; i++) {
      await storeEvent({ type: 'click', timestamp: i });
    }
    // Pruning runs fire-and-forget after storeEvent's own promise resolves;
    // give the outstanding delete requests a moment to finish.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const events = await queryEvents({ limit: 2000 });
    expect(events.length).toBeLessThanOrEqual(1000);
    expect(events.some((e) => e.timestamp === 0)).toBe(false);
    expect(events.some((e) => e.timestamp === 1004)).toBe(true);
  }, 20_000);
});
