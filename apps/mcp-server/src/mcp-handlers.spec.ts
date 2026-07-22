import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createMCPServer,
  createMCPServerForSession,
  setupSessionMCPHandlers,
} from './mcp-handlers';
import type { WebSocketManager } from './websocket-manager';

type RequestHandler = (request: any, extra: any) => Promise<any>;

/** Captures handlers registered via server.setRequestHandler(schema, handler). */
function makeFakeServer() {
  const handlers = new Map<unknown, RequestHandler>();
  const server = {
    setRequestHandler: jest.fn((schema: unknown, handler: RequestHandler) => {
      handlers.set(schema, handler);
    }),
  };
  return { server, handlers };
}

function makeWsManager(overrides: Partial<WebSocketManager> = {}) {
  return {
    getWebSocket: jest.fn(),
    callServiceWorkerTool: jest.fn(),
    isSessionHealthy: jest.fn().mockReturnValue({ healthy: true }),
    ...overrides,
  } as unknown as WebSocketManager;
}

describe('mcp-handlers', () => {
  describe('createMCPServer / createMCPServerForSession', () => {
    it('creates a real SDK Server instance', () => {
      const server = createMCPServer();
      expect(server).toBeDefined();
    });

    it('createMCPServerForSession wires up handlers on a fresh server', () => {
      const wsManager = makeWsManager();
      const server = createMCPServerForSession('s1', wsManager);
      expect(server).toBeDefined();
    });
  });

  describe('tools/list handler', () => {
    it('returns only the local client_status tool when no WebSocket is connected', async () => {
      const { server, handlers } = makeFakeServer();
      const wsManager = makeWsManager({ getWebSocket: jest.fn().mockReturnValue(undefined) });
      setupSessionMCPHandlers(server as any, 's1', wsManager);

      const result = await handlers.get(ListToolsRequestSchema)!({}, {});

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('client_status');
      expect(wsManager.callServiceWorkerTool).not.toHaveBeenCalled();
    });

    it('merges local tools with tools returned by the connected client', async () => {
      const { server, handlers } = makeFakeServer();
      const wsManager = makeWsManager({
        getWebSocket: jest.fn().mockReturnValue({}),
        callServiceWorkerTool: jest.fn().mockResolvedValue({
          result: { tools: [{ name: 'get_cart_items', inputSchema: {} }] },
        }),
      });
      setupSessionMCPHandlers(server as any, 's1', wsManager);

      const result = await handlers.get(ListToolsRequestSchema)!({}, {});

      expect(result.tools.map((t: any) => t.name)).toEqual([
        'client_status',
        'get_cart_items',
      ]);
      expect(wsManager.callServiceWorkerTool).toHaveBeenCalledWith('s1', {
        jsonrpc: '2.0',
        method: 'tools/list',
      });
    });

    it('falls back to local tools only when the client response has no tools array', async () => {
      const { server, handlers } = makeFakeServer();
      const wsManager = makeWsManager({
        getWebSocket: jest.fn().mockReturnValue({}),
        callServiceWorkerTool: jest.fn().mockResolvedValue({ result: {} }),
      });
      setupSessionMCPHandlers(server as any, 's1', wsManager);

      const result = await handlers.get(ListToolsRequestSchema)!({}, {});

      expect(result.tools).toHaveLength(1);
    });

    it('falls back to local tools only when callServiceWorkerTool rejects', async () => {
      const { server, handlers } = makeFakeServer();
      const wsManager = makeWsManager({
        getWebSocket: jest.fn().mockReturnValue({}),
        callServiceWorkerTool: jest.fn().mockRejectedValue(new Error('timeout')),
      });
      setupSessionMCPHandlers(server as any, 's1', wsManager);

      const result = await handlers.get(ListToolsRequestSchema)!({}, {});

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('client_status');
    });
  });

  describe('tools/call handler', () => {
    it('answers client_status locally using the WebSocketManager, without proxying', async () => {
      const { server, handlers } = makeFakeServer();
      const wsManager = makeWsManager({
        getWebSocket: jest.fn().mockReturnValue({}),
        isSessionHealthy: jest.fn().mockReturnValue({ healthy: true }),
      });
      setupSessionMCPHandlers(server as any, 's1', wsManager);

      const result = await handlers.get(CallToolRequestSchema)!(
        { params: { name: 'client_status', arguments: {} } },
        {},
      );

      const payload = JSON.parse(result.content[0].text);
      expect(payload).toMatchObject({
        isConnected: true,
        sessionId: 's1',
        isHealthy: true,
      });
      expect(wsManager.callServiceWorkerTool).not.toHaveBeenCalled();
    });

    it('reports isConnected: false for client_status when no WebSocket is present', async () => {
      const { server, handlers } = makeFakeServer();
      const wsManager = makeWsManager({
        getWebSocket: jest.fn().mockReturnValue(undefined),
        isSessionHealthy: jest.fn().mockReturnValue({ healthy: false, reason: 'No active connections' }),
      });
      setupSessionMCPHandlers(server as any, 's1', wsManager);

      const result = await handlers.get(CallToolRequestSchema)!(
        { params: { name: 'client_status', arguments: {} } },
        {},
      );

      const payload = JSON.parse(result.content[0].text);
      expect(payload.isConnected).toBe(false);
      expect(payload.isHealthy).toBe(false);
    });

    it('proxies other tool calls to the connected client and returns the result', async () => {
      const { server, handlers } = makeFakeServer();
      const wsManager = makeWsManager({
        getWebSocket: jest.fn().mockReturnValue({}),
        callServiceWorkerTool: jest.fn().mockResolvedValue({
          result: { content: [{ type: 'text', text: 'ok' }] },
        }),
      });
      setupSessionMCPHandlers(server as any, 's1', wsManager);

      const result = await handlers.get(CallToolRequestSchema)!(
        { params: { name: 'get_cart_items', arguments: { foo: 'bar' } } },
        {},
      );

      expect(wsManager.callServiceWorkerTool).toHaveBeenCalledWith('s1', {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'get_cart_items', arguments: { foo: 'bar' } },
      });
      expect(result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
    });

    it('throws when no WebSocket is connected for a non-client_status tool', async () => {
      const { server, handlers } = makeFakeServer();
      const wsManager = makeWsManager({ getWebSocket: jest.fn().mockReturnValue(undefined) });
      setupSessionMCPHandlers(server as any, 's1', wsManager);

      await expect(
        handlers.get(CallToolRequestSchema)!(
          { params: { name: 'get_cart_items', arguments: {} } },
          {},
        ),
      ).rejects.toThrow('No WebSocket connection for session s1');
    });

    it('throws when the client response itself contains an error', async () => {
      const { server, handlers } = makeFakeServer();
      const wsManager = makeWsManager({
        getWebSocket: jest.fn().mockReturnValue({}),
        callServiceWorkerTool: jest.fn().mockResolvedValue({
          error: { message: 'tool handler threw' },
        }),
      });
      setupSessionMCPHandlers(server as any, 's1', wsManager);

      await expect(
        handlers.get(CallToolRequestSchema)!(
          { params: { name: 'get_cart_items', arguments: {} } },
          {},
        ),
      ).rejects.toThrow('tool handler threw');
    });

    it('propagates a rejection from callServiceWorkerTool (e.g. bridge timeout)', async () => {
      const { server, handlers } = makeFakeServer();
      const wsManager = makeWsManager({
        getWebSocket: jest.fn().mockReturnValue({}),
        callServiceWorkerTool: jest.fn().mockRejectedValue(new Error('Request timeout')),
      });
      setupSessionMCPHandlers(server as any, 's1', wsManager);

      await expect(
        handlers.get(CallToolRequestSchema)!(
          { params: { name: 'get_cart_items', arguments: {} } },
          {},
        ),
      ).rejects.toThrow('Request timeout');
    });
  });
});
