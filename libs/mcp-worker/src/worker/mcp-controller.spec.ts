jest.mock('../shared/logger', () => ({
  logger: {
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../shared/database', () => ({
  storeEvent: jest.fn().mockResolvedValue(undefined),
  queryEvents: jest.fn().mockResolvedValue([]),
}));

jest.mock('./websocket-transport', () => ({
  WebSocketTransport: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('./mcp-server', () => ({
  mcpServer: {
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  },
  notifyToolsChanged: jest.fn(),
}));

import { MCPController, isToolCallResult } from './mcp-controller';
import { mcpServer, notifyToolsChanged } from './mcp-server';
import { storeEvent, queryEvents } from '../shared/database';
import { toolRegistry } from './tool-registry';

type Listener = (event: any) => void;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;

  sent: string[] = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  private listeners: Record<string, Listener[]> = {};

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    (this.listeners[type] ||= []).push(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners[type] = (this.listeners[type] || []).filter(
      (l) => l !== listener,
    );
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000, reason = '') {
    this.closeCalls.push({ code, reason });
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }

  /** Test helper: simulate the server accepting the TCP/WS handshake. */
  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  /** Test helper: simulate a JSON message arriving from the server. */
  simulateServerMessage(data: unknown) {
    const event = {
      data: typeof data === 'string' ? data : JSON.stringify(data),
    };
    this.onmessage?.(event);
    (this.listeners['message'] || []).forEach((l) => l(event));
  }

  /** Test helper: simulate an unexpected disconnect (not our own .close()). */
  simulateAbnormalClose(code = 1006, reason = 'abnormal') {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

(global as any).WebSocket = FakeWebSocket;

function latestSocket(): FakeWebSocket {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
}

describe('MCPController', () => {
  let broadcastFn: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    FakeWebSocket.instances = [];
    toolRegistry.clear();
    broadcastFn = jest.fn();
    (mcpServer.connect as jest.Mock).mockClear().mockResolvedValue(undefined);
    (mcpServer.close as jest.Mock).mockClear().mockResolvedValue(undefined);
    (notifyToolsChanged as jest.Mock).mockClear();
    (storeEvent as jest.Mock).mockClear().mockResolvedValue(undefined);
    (queryEvents as jest.Mock).mockClear().mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('registers the built-in list_browser_tabs tool', () => {
      new MCPController('ws://backend', broadcastFn);
      expect(toolRegistry.getHandler('list_browser_tabs')).toBeDefined();
    });
  });

  describe('connectWebSocket — auth gating', () => {
    it('does not open a socket when requireAuth=true and no token is set', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, true);
      await controller.connectWebSocket();
      expect(FakeWebSocket.instances).toHaveLength(0);
    });

    it('connects immediately when requireAuth=false, without an auth handshake', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const connectPromise = controller.connectWebSocket();

      const ws = latestSocket();
      ws.simulateOpen();
      await connectPromise;

      expect(ws.sent).toHaveLength(0); // no AUTH message sent
      expect(mcpServer.connect).toHaveBeenCalledTimes(1);
      expect(broadcastFn).toHaveBeenCalledWith({
        type: 'CONNECTION_STATUS',
        connected: true,
      });
    });

    it('does not open a second socket while one is already open', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const first = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await first;

      await controller.connectWebSocket();
      expect(FakeWebSocket.instances).toHaveLength(1);
    });
  });

  describe('connectWebSocket — auth handshake', () => {
    it('sends AUTH, connects the MCP transport on AUTH_OK, and broadcasts connected', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, true);
      controller.setAuthToken('token-123');
      // setAuthToken schedules its own reconnect via setTimeout(100ms); fast-forward it.
      await jest.advanceTimersByTimeAsync(100);

      const ws = latestSocket();
      ws.simulateOpen();
      expect(JSON.parse(ws.sent[0])).toEqual({ type: 'AUTH', token: 'token-123' });

      ws.simulateServerMessage({ type: 'AUTH_OK' });
      await jest.advanceTimersByTimeAsync(0);

      expect(mcpServer.connect).toHaveBeenCalledTimes(1);
      expect(broadcastFn).toHaveBeenCalledWith({
        type: 'CONNECTION_STATUS',
        connected: true,
      });
    });

    it('closes with 4001 and broadcasts disconnected on AUTH_ERROR', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, true);
      controller.setAuthToken('bad-token');
      await jest.advanceTimersByTimeAsync(100);

      const ws = latestSocket();
      ws.simulateOpen();
      ws.simulateServerMessage({ type: 'AUTH_ERROR', message: 'nope' });
      await jest.advanceTimersByTimeAsync(0);

      expect(ws.closeCalls[0]).toMatchObject({ code: 4001 });
      expect(mcpServer.connect).not.toHaveBeenCalled();
      expect(broadcastFn).toHaveBeenCalledWith({
        type: 'CONNECTION_STATUS',
        connected: false,
      });
    });

    it('times out and closes with 4001 if neither AUTH_OK nor AUTH_ERROR arrives within 10s', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, true);
      controller.setAuthToken('token-123');
      await jest.advanceTimersByTimeAsync(100);

      const ws = latestSocket();
      ws.simulateOpen();

      await jest.advanceTimersByTimeAsync(10_000);

      expect(ws.closeCalls[0]).toMatchObject({ code: 4001 });
      expect(mcpServer.connect).not.toHaveBeenCalled();
    });
  });

  describe('connectWebSocket — reconnect behavior', () => {
    it('schedules a reconnect with exponential backoff on an abnormal close', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const first = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await first;

      latestSocket().simulateAbnormalClose(1006, 'lost connection');
      expect(FakeWebSocket.instances).toHaveLength(1); // not yet reconnected

      await jest.advanceTimersByTimeAsync(1000); // first backoff: 1000ms
      expect(FakeWebSocket.instances).toHaveLength(2);

      latestSocket().simulateAbnormalClose(1006, 'lost again');
      await jest.advanceTimersByTimeAsync(2000); // second backoff: 2000ms
      expect(FakeWebSocket.instances).toHaveLength(3);
    });

    it('does not schedule a reconnect on a normal (code 1000) close', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const first = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await first;

      latestSocket().simulateAbnormalClose(1000, 'normal');
      await jest.advanceTimersByTimeAsync(60_000);

      expect(FakeWebSocket.instances).toHaveLength(1);
    });
  });

  describe('setAuthToken', () => {
    it('is a no-op when the token is unchanged', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, true);
      controller.setAuthToken('token-123');
      await jest.advanceTimersByTimeAsync(100);
      expect(FakeWebSocket.instances).toHaveLength(1);

      controller.setAuthToken('token-123');
      await jest.advanceTimersByTimeAsync(200);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('closes the existing socket and reconnects when the token changes', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, true);
      controller.setAuthToken('token-a');
      await jest.advanceTimersByTimeAsync(100);
      const wsA = latestSocket();
      wsA.simulateOpen();
      wsA.simulateServerMessage({ type: 'AUTH_OK' });
      await jest.advanceTimersByTimeAsync(0);

      controller.setAuthToken('token-b');
      expect(wsA.closeCalls[0]).toMatchObject({
        code: 1000,
        reason: 'Reconnecting with new auth token',
      });

      await jest.advanceTimersByTimeAsync(100);
      expect(FakeWebSocket.instances).toHaveLength(2);
    });
  });

  describe('tool registration queueing', () => {
    it('queues a registration until the MCP server is ready, then processes it', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);

      const registerPromise = controller.handleRegisterTool({
        name: 'get_cart_items',
        description: 'desc',
        inputSchema: { type: 'object', properties: {} },
        handlerType: 'proxy',
        tabId: 'tab-1',
      });

      expect(toolRegistry.getHandler('get_cart_items')).toBeUndefined();

      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;

      await registerPromise;
      expect(toolRegistry.getHandler('get_cart_items')).toBeDefined();
      expect(notifyToolsChanged).toHaveBeenCalledWith(mcpServer);
    });

    it('registers immediately when the MCP server is already ready', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;

      await controller.handleRegisterTool({
        name: 'get_cart_items',
        inputSchema: { type: 'object', properties: {} },
        handlerType: 'proxy',
        tabId: 'tab-1',
      });

      expect(toolRegistry.getHandler('get_cart_items')).toBeDefined();
    });

    it('rejects when name or inputSchema is missing', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;

      await expect(
        controller.handleRegisterTool({
          inputSchema: {},
          handlerType: 'proxy',
          tabId: 'tab-1',
        }),
      ).rejects.toThrow('Missing required tool fields');
    });

    it('rejects an unsupported handlerType', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;

      await expect(
        controller.handleRegisterTool({
          name: 'get_cart_items',
          inputSchema: {},
          handlerType: 'direct',
          tabId: 'tab-1',
        }),
      ).rejects.toThrow('Unsupported handler type');
    });

    it('does not re-register the tool with the registry for a second tab', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;

      await controller.handleRegisterTool({
        name: 'get_cart_items',
        inputSchema: {},
        handlerType: 'proxy',
        tabId: 'tab-1',
      });
      (notifyToolsChanged as jest.Mock).mockClear();

      await controller.handleRegisterTool({
        name: 'get_cart_items',
        inputSchema: {},
        handlerType: 'proxy',
        tabId: 'tab-2',
      });

      expect(notifyToolsChanged).not.toHaveBeenCalled();
    });
  });

  describe('proxy tool call flow (CALL_TOOL) and handleToolCallResult', () => {
    async function registerAndConnect(controller: MCPController, tabId = 'tab-1') {
      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;
      await controller.handleRegisterTool({
        name: 'get_cart_items',
        inputSchema: {},
        handlerType: 'proxy',
        tabId,
      });
    }

    it('broadcasts CALL_TOOL with the routed tab and resolves on a successful result', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      await registerAndConnect(controller);

      const handler = toolRegistry.getHandler('get_cart_items')!;
      const callPromise = handler({});

      const callToolMessage = broadcastFn.mock.calls.find(
        (c) => c[0].type === 'CALL_TOOL',
      )![0];
      expect(callToolMessage).toMatchObject({
        toolName: 'get_cart_items',
        targetTabId: 'tab-1',
      });

      controller.handleToolCallResult(callToolMessage.callId, {
        success: true,
        result: { content: [{ type: 'text', text: 'ok' }] },
      });

      await expect(callPromise).resolves.toEqual({
        content: [{ type: 'text', text: 'ok' }],
      });
    });

    it('rejects with a descriptive error when routing fails (no tabs registered)', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      await registerAndConnect(controller);

      // Force routing failure by requesting a tabId that never registered this tool.
      const handler = toolRegistry.getHandler('get_cart_items')!;
      await expect(handler({ tabId: 'does-not-exist' })).rejects.toThrow(
        "not available in tab 'does-not-exist'",
      );
    });

    it('adds structuredContent when the tool has an outputSchema and content is valid JSON', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;
      await controller.handleRegisterTool({
        name: 'get_cart_summary',
        inputSchema: {},
        outputSchema: { type: 'object' },
        handlerType: 'proxy',
        tabId: 'tab-1',
      });

      const handler = toolRegistry.getHandler('get_cart_summary')!;
      const callPromise = handler({});
      const callId = broadcastFn.mock.calls.find(
        (c) => c[0].type === 'CALL_TOOL',
      )![0].callId;

      controller.handleToolCallResult(callId, {
        success: true,
        result: {
          content: [{ type: 'text', text: JSON.stringify({ total: 42 }) }],
        },
      });

      await expect(callPromise).resolves.toEqual({
        content: [{ type: 'text', text: JSON.stringify({ total: 42 }) }],
        structuredContent: { total: 42 },
      });
    });

    it('falls back to plain content when structured content fails to parse as JSON', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;
      await controller.handleRegisterTool({
        name: 'get_cart_summary',
        inputSchema: {},
        outputSchema: { type: 'object' },
        handlerType: 'proxy',
        tabId: 'tab-1',
      });

      const handler = toolRegistry.getHandler('get_cart_summary')!;
      const callPromise = handler({});
      const callId = broadcastFn.mock.calls.find(
        (c) => c[0].type === 'CALL_TOOL',
      )![0].callId;

      controller.handleToolCallResult(callId, {
        success: true,
        result: { content: [{ type: 'text', text: 'not json' }] },
      });

      await expect(callPromise).resolves.toEqual({
        content: [{ type: 'text', text: 'not json' }],
      });
    });

    it('serializes the raw result when content is missing an array', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      await registerAndConnect(controller);

      const handler = toolRegistry.getHandler('get_cart_items')!;
      const callPromise = handler({});
      const callId = broadcastFn.mock.calls.find(
        (c) => c[0].type === 'CALL_TOOL',
      )![0].callId;

      controller.handleToolCallResult(callId, {
        success: true,
        result: { unexpected: 'shape' } as any,
      });

      await expect(callPromise).resolves.toEqual({
        content: [{ type: 'text', text: JSON.stringify({ unexpected: 'shape' }) }],
      });
    });

    it('rejects when the result reports failure', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      await registerAndConnect(controller);

      const handler = toolRegistry.getHandler('get_cart_items')!;
      const callPromise = handler({});
      const callId = broadcastFn.mock.calls.find(
        (c) => c[0].type === 'CALL_TOOL',
      )![0].callId;

      controller.handleToolCallResult(callId, {
        success: false,
        error: 'handler threw',
      });

      await expect(callPromise).rejects.toThrow('handler threw');
    });

    it('rejects after 30s if no result ever arrives', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      await registerAndConnect(controller);

      const handler = toolRegistry.getHandler('get_cart_items')!;
      const callPromise = handler({});
      // swallow the rejection reason assertion via expect below; attach now to avoid
      // an unhandled rejection warning before the assertion runs.
      const assertion = expect(callPromise).rejects.toThrow('Tool call timeout');

      await jest.advanceTimersByTimeAsync(30_000);
      await assertion;
    });

    it('ignores a result for an unknown callId without throwing', () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      expect(() =>
        controller.handleToolCallResult('unknown-call-id', {
          success: true,
          result: { content: [] },
        }),
      ).not.toThrow();
    });
  });

  describe('handleUnregisterTool', () => {
    it('returns false when tabId is missing', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      await expect(
        controller.handleUnregisterTool('get_cart_items', undefined),
      ).resolves.toBe(false);
    });

    it('returns false when the tool was never registered for that tab', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      await expect(
        controller.handleUnregisterTool('get_cart_items', 'tab-1'),
      ).resolves.toBe(false);
    });

    it('removes the tool from the registry once the last tab unregisters it', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;
      await controller.handleRegisterTool({
        name: 'get_cart_items',
        inputSchema: {},
        handlerType: 'proxy',
        tabId: 'tab-1',
      });
      (notifyToolsChanged as jest.Mock).mockClear();

      const result = await controller.handleUnregisterTool(
        'get_cart_items',
        'tab-1',
      );

      expect(result).toBe(true);
      expect(toolRegistry.getHandler('get_cart_items')).toBeUndefined();
      expect(notifyToolsChanged).toHaveBeenCalledWith(mcpServer);
    });

    it('keeps the tool registered while other tabs still have it', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;
      await controller.handleRegisterTool({
        name: 'get_cart_items',
        inputSchema: {},
        handlerType: 'proxy',
        tabId: 'tab-1',
      });
      await controller.handleRegisterTool({
        name: 'get_cart_items',
        inputSchema: {},
        handlerType: 'proxy',
        tabId: 'tab-2',
      });
      (notifyToolsChanged as jest.Mock).mockClear();

      const result = await controller.handleUnregisterTool(
        'get_cart_items',
        'tab-1',
      );

      expect(result).toBe(true);
      expect(toolRegistry.getHandler('get_cart_items')).toBeDefined();
      expect(notifyToolsChanged).not.toHaveBeenCalled();
    });
  });

  describe('tab tracking', () => {
    it('registers a tab and broadcasts the updated tab list', () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      controller.handleRegisterTab({
        tabId: 'tab-1',
        url: 'https://example.com',
        title: 'Example',
      });

      expect(broadcastFn).toHaveBeenCalledWith({
        type: 'TAB_LIST_UPDATED',
        tabs: expect.arrayContaining([
          expect.objectContaining({ tabId: 'tab-1' }),
        ]),
      });
    });

    it('ignores a tab registration missing tabId', () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      controller.handleRegisterTab({ url: 'https://example.com', title: 'x' });
      expect(broadcastFn).not.toHaveBeenCalled();
    });

    it('ignores setActiveTab when tabId is missing, without throwing', () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      expect(() => controller.handleSetActiveTab({})).not.toThrow();
    });
  });

  describe('event storage delegation', () => {
    it('handleStoreEvent delegates to storeEvent', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const event = { id: '1', type: 'click', timestamp: Date.now() } as any;
      await controller.handleStoreEvent(event);
      expect(storeEvent).toHaveBeenCalledWith(event);
    });

    it('handleGetEvents delegates to queryEvents with a limit', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      await controller.handleGetEvents();
      expect(queryEvents).toHaveBeenCalledWith({ limit: 50 });
    });
  });

  describe('getConnectionStatus / dispose', () => {
    it('reports connected only while the socket is OPEN', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      expect(controller.getConnectionStatus()).toBe(false);

      const connectPromise = controller.connectWebSocket();
      latestSocket().simulateOpen();
      await connectPromise;

      expect(controller.getConnectionStatus()).toBe(true);
    });

    it('dispose closes the socket with 1000 "Worker disposed"', async () => {
      const controller = new MCPController('ws://backend', broadcastFn, false);
      const connectPromise = controller.connectWebSocket();
      const ws = latestSocket();
      ws.simulateOpen();
      await connectPromise;

      controller.dispose();

      expect(ws.closeCalls[0]).toMatchObject({
        code: 1000,
        reason: 'Worker disposed',
      });
    });
  });

  describe('MCPController.create', () => {
    it('returns an MCPController instance', () => {
      const controller = MCPController.create('ws://backend', broadcastFn);
      expect(controller).toBeInstanceOf(MCPController);
    });
  });

  describe('isToolCallResult', () => {
    it('accepts a well-formed success result', () => {
      expect(
        isToolCallResult({
          success: true,
          result: { content: [{ type: 'text', text: 'ok' }] },
        }),
      ).toBe(true);
    });

    it('accepts a well-formed failure result', () => {
      expect(isToolCallResult({ success: false, error: 'boom' })).toBe(true);
    });

    it('rejects non-objects and objects missing a boolean success field', () => {
      expect(isToolCallResult(null)).toBe(false);
      expect(isToolCallResult('nope')).toBe(false);
      expect(isToolCallResult({})).toBe(false);
      expect(isToolCallResult({ success: 'true' })).toBe(false);
    });

    it('rejects a result whose content is not an array', () => {
      expect(
        isToolCallResult({ success: true, result: { content: 'oops' } }),
      ).toBe(false);
    });
  });
});
