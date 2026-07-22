import request from 'supertest';
import type { Server as HttpServer } from 'http';
import { createHTTPServer } from './http-server';
import { createMCPServerForSession } from './mcp-handlers';
import { SessionManager } from './session-manager';
import { WebSocketManager } from './websocket-manager';
import { issueToken } from './auth';

/** A stub SessionManager satisfying only what http-server.ts touches, for tests that
 * never need to reach real transport/session plumbing (missing header / unknown session). */
function makeStubSessionManager(overrides: Record<string, unknown> = {}) {
  return {
    getSession: jest.fn().mockReturnValue(undefined),
    isSessionHealthy: jest.fn().mockReturnValue({ healthy: false }),
    createMCPServerForSession: jest.fn(),
    attachTransport: jest.fn(),
    closeTransport: jest.fn(),
    ...overrides,
  };
}

function makeStubWsManager() {
  return {
    getWebSocket: jest.fn(),
    callServiceWorkerTool: jest.fn(),
    isSessionHealthy: jest.fn().mockReturnValue({ healthy: false }),
  };
}

describe('createHTTPServer', () => {
  let server: HttpServer;
  let sessionManager: ReturnType<typeof makeStubSessionManager>;
  let wsManager: ReturnType<typeof makeStubWsManager>;

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  function boot(config: Parameters<typeof createHTTPServer>[2] = {}) {
    sessionManager = makeStubSessionManager();
    wsManager = makeStubWsManager();
    const result = createHTTPServer(sessionManager as any, wsManager as any, {
      port: 0,
      ...config,
    });
    server = result.server;
    return request(server);
  }

  describe('health endpoints', () => {
    it('GET /health/live returns 200 UP', async () => {
      const agent = boot();
      const res = await agent.get('/health/live').set('Host', 'localhost');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'UP', service: 'mcp-server' });
    });

    it('GET /health/ready returns 200 UP with component checks', async () => {
      const agent = boot();
      const res = await agent.get('/health/ready').set('Host', 'localhost');
      expect(res.status).toBe(200);
      expect(res.body.checks).toEqual({
        sessionManager: 'UP',
        webSocketManager: 'UP',
      });
    });

    it('GET /health returns 200 with uptime and version', async () => {
      const agent = boot();
      const res = await agent.get('/health').set('Host', 'localhost');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(typeof res.body.uptime).toBe('number');
    });
  });

  describe('CORS', () => {
    it('defaults to Access-Control-Allow-Origin: * when CORS_ORIGIN is unset', async () => {
      delete process.env.CORS_ORIGIN;
      const agent = boot();
      const res = await agent.get('/health/live').set('Host', 'localhost');
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('reflects only an allow-listed origin when CORS_ORIGIN is set', async () => {
      process.env.CORS_ORIGIN = 'https://app.example.com';
      const agent = boot();

      const allowed = await agent
        .get('/health/live')
        .set('Host', 'localhost')
        .set('Origin', 'https://app.example.com');
      expect(allowed.headers['access-control-allow-origin']).toBe(
        'https://app.example.com',
      );

      const denied = await agent
        .get('/health/live')
        .set('Host', 'localhost')
        .set('Origin', 'https://evil.example.com');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();

      delete process.env.CORS_ORIGIN;
    });

    it('responds to an OPTIONS preflight with 204', async () => {
      const agent = boot();
      const res = await agent.options('/mcp').set('Host', 'localhost');
      expect(res.status).toBe(204);
    });
  });

  describe('/debug/sessions gating', () => {
    it('is not mounted (404) when ENABLE_DEBUG_ENDPOINTS is unset', async () => {
      delete process.env.ENABLE_DEBUG_ENDPOINTS;
      const agent = boot();
      const res = await agent.get('/debug/sessions').set('Host', 'localhost');
      expect(res.status).toBe(404);
    });

    it('is mounted and requires auth when ENABLE_DEBUG_ENDPOINTS=true', async () => {
      process.env.ENABLE_DEBUG_ENDPOINTS = 'true';
      const agent = boot();
      const res = await agent.get('/debug/sessions').set('Host', 'localhost');
      expect(res.status).toBe(401);
      delete process.env.ENABLE_DEBUG_ENDPOINTS;
    });
  });

  describe('/mcp session-id handling', () => {
    it('POST without mcp-session-id header and a non-initialize body returns 400', async () => {
      const agent = boot();
      const res = await agent
        .post('/mcp')
        .set('Host', 'localhost')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
      expect(res.status).toBe(400);
      expect(res.text).toContain('Missing mcp-session-id header');
    });

    it('POST with an unknown mcp-session-id header returns 400', async () => {
      const agent = boot();
      const res = await agent
        .post('/mcp')
        .set('Host', 'localhost')
        .set('mcp-session-id', 'does-not-exist')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
      expect(res.status).toBe(400);
      expect(res.text).toContain('Invalid session ID');
    });

    it('GET without mcp-session-id header returns 400', async () => {
      const agent = boot();
      const res = await agent.get('/mcp').set('Host', 'localhost');
      expect(res.status).toBe(400);
    });

    it('GET with an unknown mcp-session-id header returns 400', async () => {
      const agent = boot();
      const res = await agent
        .get('/mcp')
        .set('Host', 'localhost')
        .set('mcp-session-id', 'does-not-exist');
      expect(res.status).toBe(400);
    });

    it('DELETE without mcp-session-id header returns 400', async () => {
      const agent = boot();
      const res = await agent.delete('/mcp').set('Host', 'localhost');
      expect(res.status).toBe(400);
    });

    it('POST initialize request without a token returns 401', async () => {
      const agent = boot();
      const res = await agent
        .post('/mcp')
        .set('Host', 'localhost')
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} });
      expect(res.status).toBe(401);
    });

    it('POST initialize request with an invalid token returns 401', async () => {
      const agent = boot();
      const res = await agent
        .post('/mcp')
        .set('Host', 'localhost')
        .set('Authorization', 'Bearer not-a-real-token')
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} });
      expect(res.status).toBe(401);
    });
  });

  describe('/auth/token (local mode)', () => {
    it('rejects a missing sessionUser with 400', async () => {
      const agent = boot();
      const res = await agent.post('/auth/token').set('Host', 'localhost').send({});
      expect(res.status).toBe(400);
    });

    it('issues a JWT for a valid sessionUser', async () => {
      const agent = boot();
      const res = await agent
        .post('/auth/token')
        .set('Host', 'localhost')
        .send({ sessionUser: 'alice' });
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.split('.')).toHaveLength(3); // JWT shape
    });
  });

  describe('/auth/token (demo mode)', () => {
    afterEach(() => {
      delete process.env.AUTH_MODE;
      jest.resetModules();
    });

    it('echoes the sessionUser back as-is (no signing)', async () => {
      process.env.AUTH_MODE = 'demo';
      jest.resetModules();
      // Re-require with AUTH_MODE=demo baked into the freshly-loaded ./auth module.
      const { createHTTPServer: createDemoHTTPServer } = require('./http-server');
      const demoSessionManager = makeStubSessionManager();
      const demoWsManager = makeStubWsManager();
      const { server: demoServer } = createDemoHTTPServer(
        demoSessionManager,
        demoWsManager,
        { port: 0 },
      );

      try {
        const res = await request(demoServer)
          .post('/auth/token')
          .set('Host', 'localhost')
          .send({ sessionUser: 'demo-user-12345' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ token: 'demo-user-12345' });
      } finally {
        await new Promise((resolve) => demoServer.close(resolve));
      }
    });
  });

  describe('end-to-end initialize + session reuse (real SessionManager + real mcp-handlers)', () => {
    it('creates a session on initialize and allows reuse via the mcp-session-id header', async () => {
      const realSessionManager = new SessionManager(createMCPServerForSession);
      const realWsManager = new WebSocketManager(realSessionManager);
      const { server: realServer } = createHTTPServer(
        realSessionManager,
        realWsManager,
        { port: 0 },
      );

      try {
        const token = await issueToken('user-e2e-1');

        const initRes = await request(realServer)
          .post('/mcp')
          .set('Host', 'localhost')
          .set('Authorization', `Bearer ${token}`)
          .set('Accept', 'application/json, text/event-stream')
          .send({
            jsonrpc: '2.0',
            method: 'initialize',
            id: 1,
            params: {
              protocolVersion: '2025-06-18',
              capabilities: {},
              clientInfo: { name: 'test-client', version: '1.0.0' },
            },
          });

        expect(initRes.status).toBeLessThan(300);
        expect(initRes.headers['mcp-session-id']).toBe('user-e2e-1');

        // Reuse the session for a follow-up tools/list call. (Deliberately not
        // testing the GET SSE-stream path here: that request is designed to
        // stay open, which would hang this test rather than complete it.)
        const followUp = await request(realServer)
          .post('/mcp')
          .set('Host', 'localhost')
          .set('Accept', 'application/json, text/event-stream')
          .set('mcp-session-id', 'user-e2e-1')
          .send({ jsonrpc: '2.0', method: 'tools/list', id: 2 });

        expect(followUp.status).toBeLessThan(300);
        expect(followUp.text).toContain('client_status');

        expect(realSessionManager.getSession('user-e2e-1')).toBeDefined();
      } finally {
        await new Promise((resolve) => realServer.close(resolve));
        realSessionManager.destroy();
      }
    });
  });
});
