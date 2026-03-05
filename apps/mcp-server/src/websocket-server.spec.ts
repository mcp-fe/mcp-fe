import * as http from 'http';
import { WebSocket } from 'ws';
import { setupWebSocketServer } from './websocket-server';
import * as auth from './auth';

jest.mock('./auth', () => ({
  verifyToken: jest.fn(),
}));

const mockVerifyToken = auth.verifyToken as jest.MockedFunction<
  typeof auth.verifyToken
>;

function makeMockWsManager() {
  return {
    registerSession: jest.fn(),
    unregisterSession: jest.fn(),
    handleMessage: jest.fn(),
  };
}

/** Resolves with the parsed JSON of the next message received on `ws`. */
function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    ws.once('message', (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch {
        reject(new Error(`Failed to parse WS message: ${data}`));
      }
    });
  });
}

/** Resolves when `ws` closes, with the close code and reason string. */
function nextClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.once('close', (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });
}

/** Flushes one event loop tick (I/O + check phase). */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Retries `assertion` on each event loop tick until it passes or `maxTicks`
 * is exhausted. Needed for side-effects that require a loopback network round-trip.
 */
async function waitFor(assertion: () => void, maxTicks = 30): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < maxTicks; i++) {
    try {
      assertion();
      return;
    } catch (e) {
      lastError = e;
      await flushAsync();
    }
  }
  throw lastError;
}

describe('setupWebSocketServer', () => {
  let httpServer: http.Server;
  let wsManager: ReturnType<typeof makeMockWsManager>;
  let port: number;
  const openClients: WebSocket[] = [];

  beforeEach((done) => {
    // Fake only setTimeout/setInterval; leave setImmediate/nextTick real so
    // WebSocket I/O and async handlers continue to work.
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
    jest.clearAllMocks();

    wsManager = makeMockWsManager();
    httpServer = http.createServer();
    setupWebSocketServer(httpServer as any, wsManager as any);

    httpServer.listen(0, () => {
      port = (httpServer.address() as { port: number }).port;
      done();
    });
  });

  afterEach((done) => {
    jest.useRealTimers();
    for (const client of openClients.splice(0)) {
      if (client.readyState === WebSocket.OPEN) client.close();
    }
    httpServer.close(done);
  });

  /** Opens a WebSocket connection and waits for it to be ready. */
  function connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      openClients.push(ws);
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  /** Connects and completes a successful AUTH handshake. Returns the authenticated socket. */
  async function connectAndAuth(sessionId = 'session-abc'): Promise<WebSocket> {
    mockVerifyToken.mockResolvedValueOnce(sessionId);
    const ws = await connect();
    const msgPromise = nextMessage(ws);
    ws.send(JSON.stringify({ type: 'AUTH', token: 'valid-token' }));
    await msgPromise; // consume AUTH_OK
    return ws;
  }

  // ── Auth handshake ──────────────────────────────────────────────────────────

  describe('auth handshake', () => {
    it('replies AUTH_OK and registers session for a valid token', async () => {
      mockVerifyToken.mockResolvedValueOnce('user-123');
      const ws = await connect();

      const msgPromise = nextMessage(ws);
      ws.send(JSON.stringify({ type: 'AUTH', token: 'good-token' }));
      const msg = await msgPromise;

      expect(msg).toEqual({ type: 'AUTH_OK' });
      expect(mockVerifyToken).toHaveBeenCalledWith('good-token');
      expect(wsManager.registerSession).toHaveBeenCalledWith(
        'user-123',
        expect.anything(),
      );
    });

    it('replies AUTH_ERROR and closes with 4001 for an invalid token', async () => {
      mockVerifyToken.mockResolvedValueOnce(null);
      const ws = await connect();

      const msgPromise = nextMessage(ws);
      const closePromise = nextClose(ws);
      ws.send(JSON.stringify({ type: 'AUTH', token: 'bad-token' }));

      const msg = await msgPromise;
      const { code } = await closePromise;

      expect(msg).toEqual({ type: 'AUTH_ERROR', message: 'Invalid or expired token' });
      expect(code).toBe(4001);
      expect(wsManager.registerSession).not.toHaveBeenCalled();
    });

    it('closes with 4001 when the first message is not AUTH', async () => {
      const ws = await connect();
      const closePromise = nextClose(ws);

      ws.send(JSON.stringify({ type: 'ping' }));

      const { code } = await closePromise;
      expect(code).toBe(4001);
      expect(wsManager.registerSession).not.toHaveBeenCalled();
    });

    it('closes unauthenticated connections after the auth timeout', async () => {
      const ws = await connect();
      const closePromise = nextClose(ws);

      // Advance past the 10-second auth timeout
      jest.advanceTimersByTime(10_000);

      const { code } = await closePromise;
      expect(code).toBe(4001);
      expect(wsManager.registerSession).not.toHaveBeenCalled();
    });

    it('does not close the connection when auth completes before the timeout', async () => {
      const ws = await connectAndAuth('user-ok');

      // Advancing past the timeout should have no effect on an authenticated socket
      jest.advanceTimersByTime(10_000);
      await flushAsync();

      expect(ws.readyState).toBe(WebSocket.OPEN);
    });
  });

  // ── Post-auth message routing ───────────────────────────────────────────────

  describe('message routing after authentication', () => {
    it('forwards JSON-RPC messages to wsManager.handleMessage', async () => {
      const ws = await connectAndAuth('user-xyz');

      const rpcMessage = { jsonrpc: '2.0', method: 'tools/list', id: 1 };
      ws.send(JSON.stringify(rpcMessage));

      await waitFor(() =>
        expect(wsManager.handleMessage).toHaveBeenCalledWith('user-xyz', rpcMessage),
      );
    });

    it('ignores ping messages and does not forward them to wsManager', async () => {
      const ws = await connectAndAuth();

      ws.send(JSON.stringify({ type: 'ping' }));
      // Wait a few ticks to confirm handleMessage is never called
      await flushAsync();
      await flushAsync();
      await flushAsync();

      expect(wsManager.handleMessage).not.toHaveBeenCalled();
    });

    it('forwards a second AUTH message as a regular message after authentication', async () => {
      const ws = await connectAndAuth('user-1');

      ws.send(JSON.stringify({ type: 'AUTH', token: 'valid-token' }));

      await waitFor(() =>
        expect(wsManager.handleMessage).toHaveBeenCalledWith(
          'user-1',
          { type: 'AUTH', token: 'valid-token' },
        ),
      );
    });
  });

  // ── Session cleanup ─────────────────────────────────────────────────────────

  describe('session cleanup', () => {
    it('calls wsManager.unregisterSession when an authenticated connection closes', async () => {
      const ws = await connectAndAuth('user-to-cleanup');
      const closePromise = nextClose(ws);

      ws.close();
      await closePromise;

      await waitFor(() =>
        expect(wsManager.unregisterSession).toHaveBeenCalledWith('user-to-cleanup'),
      );
    });

    it('does not call unregisterSession when an unauthenticated connection closes', async () => {
      const ws = await connect();
      const closePromise = nextClose(ws);

      ws.close();
      await closePromise;
      await flushAsync();
      await flushAsync();

      expect(wsManager.unregisterSession).not.toHaveBeenCalled();
    });
  });
});
