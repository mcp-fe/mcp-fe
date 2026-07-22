import { SessionManager } from './session-manager';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { WebSocket } from 'ws';
import type { WebSocketManager } from './websocket-manager';

function makeFakeServer(): jest.Mocked<
  Pick<Server, 'sendToolListChanged' | 'close'>
> {
  return {
    sendToolListChanged: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  } as unknown as jest.Mocked<Pick<Server, 'sendToolListChanged' | 'close'>>;
}

function makeFakeWs(): jest.Mocked<Pick<WebSocket, 'close'>> {
  return { close: jest.fn() } as unknown as jest.Mocked<Pick<WebSocket, 'close'>>;
}

describe('SessionManager', () => {
  let originalTtl: string | undefined;

  beforeEach(() => {
    originalTtl = process.env.SESSION_TTL_MINUTES;
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (originalTtl === undefined) delete process.env.SESSION_TTL_MINUTES;
    else process.env.SESSION_TTL_MINUTES = originalTtl;
    jest.useRealTimers();
  });

  function makeManager(factory = jest.fn()): {
    manager: SessionManager;
    factory: jest.Mock;
  } {
    const manager = new SessionManager(factory as any);
    return { manager, factory };
  }

  describe('getOrCreateSession', () => {
    it('creates a new session on first access', () => {
      const { manager } = makeManager();
      const session = manager.getOrCreateSession('s1');
      expect(session.sessionId).toBe('s1');
      expect(session.isWSConnected).toBe(false);
      expect(session.pendingMessages).toEqual([]);
    });

    it('returns the same session on subsequent access and bumps lastActivity', () => {
      const { manager } = makeManager();
      const first = manager.getOrCreateSession('s1');
      jest.advanceTimersByTime(1000);
      const second = manager.getOrCreateSession('s1');
      expect(second).toBe(first);
      expect(second.lastActivity).toBeGreaterThan(first.createdAt);
    });
  });

  describe('createMCPServerForSession', () => {
    it('builds the server via the injected factory exactly once and caches it', () => {
      const fakeServer = makeFakeServer();
      const factory = jest.fn().mockReturnValue(fakeServer);
      const { manager } = makeManager(factory);
      const wsManager = {} as WebSocketManager;

      const first = manager.createMCPServerForSession('s1', wsManager);
      const second = manager.createMCPServerForSession('s1', wsManager);

      expect(first).toBe(fakeServer);
      expect(second).toBe(fakeServer);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(factory).toHaveBeenCalledWith('s1', wsManager);
    });

    it('exposes the created server via getMCPServer', () => {
      const fakeServer = makeFakeServer();
      const factory = jest.fn().mockReturnValue(fakeServer);
      const { manager } = makeManager(factory);

      manager.createMCPServerForSession('s1', {} as WebSocketManager);
      expect(manager.getMCPServer('s1')).toBe(fakeServer);
    });

    it('getMCPServer returns undefined for unknown session', () => {
      const { manager } = makeManager();
      expect(manager.getMCPServer('unknown')).toBeUndefined();
    });
  });

  describe('registerWebSocket / unregisterWebSocket', () => {
    it('marks the session connected and attempts a tools notification', () => {
      const { manager } = makeManager();
      const spy = jest.spyOn(manager, 'notifyToolsChange');
      const ws = makeFakeWs() as unknown as WebSocket;

      manager.registerWebSocket('s1', ws);

      const session = manager.getSession('s1')!;
      expect(session.isWSConnected).toBe(true);
      expect(session.ws).toBe(ws);
      expect(spy).toHaveBeenCalledWith('s1');
    });

    it('clears connection state on unregister', () => {
      const { manager } = makeManager();
      const ws = makeFakeWs() as unknown as WebSocket;
      manager.registerWebSocket('s1', ws);

      manager.unregisterWebSocket('s1');

      const session = manager.getSession('s1')!;
      expect(session.isWSConnected).toBe(false);
      expect(session.ws).toBeUndefined();
    });

    it('unregister is a no-op for an unknown session', () => {
      const { manager } = makeManager();
      expect(() => manager.unregisterWebSocket('unknown')).not.toThrow();
    });
  });

  describe('notifyToolsChange', () => {
    it('skips when there is no mcpServer', async () => {
      const { manager } = makeManager();
      manager.getOrCreateSession('s1');
      await manager.notifyToolsChange('s1');
      // nothing to assert on directly beyond "it did not throw" — no server to call
    });

    it('skips when there is no transport even if mcpServer exists', async () => {
      const fakeServer = makeFakeServer();
      const factory = jest.fn().mockReturnValue(fakeServer);
      const { manager } = makeManager(factory);
      manager.createMCPServerForSession('s1', {} as WebSocketManager);

      await manager.notifyToolsChange('s1');

      expect(fakeServer.sendToolListChanged).not.toHaveBeenCalled();
    });

    it('sends the notification when both mcpServer and transport are present', async () => {
      const fakeServer = makeFakeServer();
      const factory = jest.fn().mockReturnValue(fakeServer);
      const { manager } = makeManager(factory);
      manager.createMCPServerForSession('s1', {} as WebSocketManager);
      manager.attachTransport('s1', {} as any);

      await manager.notifyToolsChange('s1');

      expect(fakeServer.sendToolListChanged).toHaveBeenCalledTimes(1);
    });

    it('swallows errors from sendToolListChanged', async () => {
      const fakeServer = makeFakeServer();
      fakeServer.sendToolListChanged.mockRejectedValue(new Error('boom'));
      const factory = jest.fn().mockReturnValue(fakeServer);
      const { manager } = makeManager(factory);
      manager.createMCPServerForSession('s1', {} as WebSocketManager);
      manager.attachTransport('s1', {} as any);

      await expect(manager.notifyToolsChange('s1')).resolves.toBeUndefined();
    });
  });

  describe('attachTransport / closeTransport', () => {
    it('attaches and clears the transport', () => {
      const { manager } = makeManager();
      const transport = {} as any;
      manager.attachTransport('s1', transport);
      expect(manager.getSession('s1')?.transport).toBe(transport);

      manager.closeTransport('s1');
      expect(manager.getSession('s1')?.transport).toBeUndefined();
    });

    it('closeTransport is a no-op when there is no transport or session', () => {
      const { manager } = makeManager();
      expect(() => manager.closeTransport('unknown')).not.toThrow();
    });
  });

  describe('enqueueMessage / dequeueMessages', () => {
    it('queues messages and dequeues them all at once, clearing the queue', () => {
      const { manager } = makeManager();
      manager.enqueueMessage('s1', { type: 'a' });
      manager.enqueueMessage('s1', { type: 'b' });

      const messages = manager.dequeueMessages('s1');
      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({ type: 'a' });
      expect(manager.dequeueMessages('s1')).toEqual([]);
    });

    it('dequeueMessages returns an empty array for an unknown session', () => {
      const { manager } = makeManager();
      expect(manager.dequeueMessages('unknown')).toEqual([]);
    });

    it('drops the oldest message once the queue exceeds MESSAGE_QUEUE_MAX (100)', () => {
      const { manager } = makeManager();
      for (let i = 0; i < 101; i++) {
        manager.enqueueMessage('s1', { seq: i });
      }

      const messages = manager.dequeueMessages('s1');
      expect(messages).toHaveLength(100);
      // seq 0 (the oldest) should have been dropped; seq 1 is now the oldest remaining
      expect(messages[0]).toMatchObject({ seq: 1 });
      expect(messages[messages.length - 1]).toMatchObject({ seq: 100 });
    });
  });

  describe('registerPendingRequest / completePendingRequest', () => {
    it('tracks and clears a pending request', () => {
      const { manager } = makeManager();
      manager.registerPendingRequest('s1', 'req-1');
      expect(manager.getSession('s1')?.pendingRequests.has('req-1')).toBe(true);

      manager.completePendingRequest('s1', 'req-1');
      expect(manager.getSession('s1')?.pendingRequests.has('req-1')).toBe(false);
    });

    it('completePendingRequest is a no-op for an unknown session', () => {
      const { manager } = makeManager();
      expect(() => manager.completePendingRequest('unknown', 'req-1')).not.toThrow();
    });
  });

  describe('isSessionHealthy', () => {
    it('reports unhealthy with "Session not found" for an unknown session', () => {
      const { manager } = makeManager();
      expect(manager.isSessionHealthy('unknown')).toEqual({
        healthy: false,
        reason: 'Session not found',
      });
    });

    it('reports unhealthy with "No active connections" for a fresh session with no WS/transport', () => {
      const { manager } = makeManager();
      manager.getOrCreateSession('s1');
      expect(manager.isSessionHealthy('s1')).toEqual({
        healthy: false,
        reason: 'No active connections',
      });
    });

    it('reports healthy once a WebSocket is registered', () => {
      const { manager } = makeManager();
      manager.registerWebSocket('s1', makeFakeWs() as unknown as WebSocket);
      expect(manager.isSessionHealthy('s1')).toEqual({ healthy: true });
    });

    it('reports unhealthy with "Session expired" once lastActivity exceeds the TTL', () => {
      process.env.SESSION_TTL_MINUTES = '5';
      const { manager } = makeManager();
      manager.registerWebSocket('s1', makeFakeWs() as unknown as WebSocket);

      // Just past the TTL boundary, but before the next 60s background cleanup
      // tick would otherwise remove the session out from under this check.
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);

      expect(manager.isSessionHealthy('s1')).toEqual({
        healthy: false,
        reason: 'Session expired',
      });
    });
  });

  describe('cleanupExpiredSessions (background interval)', () => {
    it('closes and removes sessions once they exceed the TTL, closing their WebSocket and MCP server', () => {
      process.env.SESSION_TTL_MINUTES = '1';
      const fakeServer = makeFakeServer();
      const factory = jest.fn().mockReturnValue(fakeServer);
      const { manager } = makeManager(factory);
      const ws = makeFakeWs();

      manager.registerWebSocket('s1', ws as unknown as WebSocket);
      manager.createMCPServerForSession('s1', {} as WebSocketManager);

      jest.advanceTimersByTime(2 * 60 * 1000);

      expect(manager.getSession('s1')).toBeUndefined();
      expect(ws.close).toHaveBeenCalledWith(1001, 'Session expired');
      expect(fakeServer.close).toHaveBeenCalledTimes(1);
    });

    it('leaves fresh sessions untouched', () => {
      process.env.SESSION_TTL_MINUTES = '30';
      const { manager } = makeManager();
      manager.getOrCreateSession('s1');

      jest.advanceTimersByTime(60 * 1000); // one cleanup tick, well under the 30 min TTL

      expect(manager.getSession('s1')).toBeDefined();
    });

    it('does not throw when mcpServer.close() itself throws', () => {
      process.env.SESSION_TTL_MINUTES = '1';
      const fakeServer = makeFakeServer();
      fakeServer.close.mockImplementation(() => {
        throw new Error('close failed');
      });
      const factory = jest.fn().mockReturnValue(fakeServer);
      const { manager } = makeManager(factory);
      manager.createMCPServerForSession('s1', {} as WebSocketManager);

      expect(() => jest.advanceTimersByTime(2 * 60 * 1000)).not.toThrow();
      expect(manager.getSession('s1')).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('stops the cleanup interval and closes all remaining sessions', () => {
      const { manager } = makeManager();
      const ws = makeFakeWs();
      manager.registerWebSocket('s1', ws as unknown as WebSocket);
      manager.getOrCreateSession('s2');

      manager.destroy();

      expect(manager.getSession('s1')).toBeUndefined();
      expect(manager.getSession('s2')).toBeUndefined();
      expect(ws.close).toHaveBeenCalledWith(1001, 'Session expired');

      // Advancing time after destroy must not resurrect the interval / throw
      expect(() => jest.advanceTimersByTime(10 * 60 * 1000)).not.toThrow();
    });
  });

  describe('getAllSessions', () => {
    it('returns every tracked session', () => {
      const { manager } = makeManager();
      manager.getOrCreateSession('s1');
      manager.getOrCreateSession('s2');

      const all = manager.getAllSessions().map((s) => s.sessionId);
      expect(all.sort()).toEqual(['s1', 's2']);
    });
  });
});
