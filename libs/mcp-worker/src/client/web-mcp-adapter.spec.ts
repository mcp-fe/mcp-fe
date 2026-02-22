/**
 * WebMcpAdapter Unit Tests
 *
 * Tests for the WebMCP specification adapter:
 * - navigator.modelContext
 * - Synchronous registerTool(tool) / unregisterTool(name) / clearContext()
 * - ModelContextTool dictionary with execute callback
 * - Enabled by default (auto-detects browser support)
 *
 * @see https://webmachinelearning.github.io/webmcp/
 */

import { WebMcpAdapter } from './web-mcp-adapter';
import type { ToolHandler } from './tool-registry';
import type { ModelContext } from './web-mcp-types';

// Mock logger to avoid console noise
jest.mock('../shared/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('WebMcpAdapter', () => {
  let adapter: WebMcpAdapter;
  let mockHandler: ToolHandler;

  beforeEach(() => {
    adapter = new WebMcpAdapter();
    mockHandler = jest.fn(async (args: unknown) => ({
      content: [{ type: 'text', text: JSON.stringify(args) }],
    }));
    // Clean up navigator.modelContext mock if set
    delete (globalThis.navigator as any).modelContext;
  });

  afterEach(() => {
    delete (globalThis.navigator as any).modelContext;
  });

  // ---------------------------------------------------------------------------
  // Feature Detection
  // ---------------------------------------------------------------------------

  describe('isSupported()', () => {
    it('should return false when navigator.modelContext does not exist', () => {
      expect(WebMcpAdapter.isSupported()).toBe(false);
    });

    it('should return false when navigator.modelContext exists but has no registerTool', () => {
      (globalThis.navigator as any).modelContext = {
        clearContext: jest.fn(),
      };
      expect(WebMcpAdapter.isSupported()).toBe(false);
    });

    it('should return true when navigator.modelContext.registerTool is a function', () => {
      (globalThis.navigator as any).modelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      expect(WebMcpAdapter.isSupported()).toBe(true);
    });
  });

  describe('isAvailable()', () => {
    it('should return false when explicitly disabled', () => {
      (globalThis.navigator as any).modelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      adapter.setEnabled(false);
      expect(adapter.isAvailable()).toBe(false);
    });

    it('should return false when enabled but API not present', () => {
      // enabled by default, but no API
      expect(adapter.isAvailable()).toBe(false);
    });

    it('should return true by default when API is present', () => {
      (globalThis.navigator as any).modelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      // enabled by default â€” no setEnabled(true) needed
      expect(adapter.isAvailable()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  describe('registerTool()', () => {
    let mockModelContext: ModelContext;

    beforeEach(() => {
      mockModelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      (globalThis.navigator as any).modelContext =
        mockModelContext;
    });

    it('should be a no-op when adapter is explicitly disabled', () => {
      adapter.setEnabled(false);
      adapter.registerTool(
        'test-tool',
        'A test tool',
        { type: 'object' },
        mockHandler,
      );

      expect(mockModelContext.registerTool).not.toHaveBeenCalled();
      expect(adapter.isRegistered('test-tool')).toBe(false);
    });

    it('should register tool via navigator.modelContext.registerTool() by default when API is present', () => {
      adapter.registerTool(
        'test-tool',
        'A test tool',
        { type: 'object', properties: { name: { type: 'string' } } },
        mockHandler,
        {
          annotations: { readOnlyHint: true },
          title: 'Test Tool',
        },
      );

      expect(mockModelContext.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
          execute: expect.any(Function),
          annotations: { readOnlyHint: true },
        }),
      );
      expect(adapter.isRegistered('test-tool')).toBe(true);
    });

    it('should call unregisterTool before re-registering same tool name', () => {
      adapter.registerTool('test-tool', 'v1', { type: 'object' }, mockHandler);
      adapter.registerTool('test-tool', 'v2', { type: 'object' }, mockHandler);

      expect(mockModelContext.unregisterTool).toHaveBeenCalledWith('test-tool');
      expect(mockModelContext.registerTool).toHaveBeenCalledTimes(2);
      expect(adapter.isRegistered('test-tool')).toBe(true);
    });

    it('should handle API errors gracefully', () => {
      (mockModelContext.registerTool as jest.Mock).mockImplementation(() => {
        throw new Error('WebMCP API error');
      });

      adapter.registerTool(
        'failing-tool',
        'desc',
        { type: 'object' },
        mockHandler,
      );

      expect(adapter.isRegistered('failing-tool')).toBe(false);
    });

    it('should use tool name as description fallback when description is undefined', () => {
      adapter.registerTool(
        'my-tool',
        undefined,
        { type: 'object' },
        mockHandler,
      );

      expect(mockModelContext.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'my-tool',
          description: 'my-tool',
        }),
      );
    });

    it('should provide a working execute callback that wraps the internal handler', async () => {
      adapter.registerTool(
        'test-tool',
        'A tool',
        { type: 'object' },
        mockHandler,
      );

      const registeredTool = (mockModelContext.registerTool as jest.Mock).mock
        .calls[0][0];
      expect(registeredTool.execute).toBeDefined();

      const mockClient = { requestUserInteraction: jest.fn() };
      const result = await registeredTool.execute({ foo: 'bar' }, mockClient);

      expect(mockHandler).toHaveBeenCalledWith({ foo: 'bar' });
      expect(result).toEqual({
        content: [{ type: 'text', text: '{"foo":"bar"}' }],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Unregistration
  // ---------------------------------------------------------------------------

  describe('unregisterTool()', () => {
    let mockModelContext: ModelContext;

    beforeEach(() => {
      mockModelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      (globalThis.navigator as any).modelContext =
        mockModelContext;
      adapter.registerTool(
        'test-tool',
        'desc',
        { type: 'object' },
        mockHandler,
      );
    });

    it('should unregister a tool registered via WebMCP', () => {
      const result = adapter.unregisterTool('test-tool');
      expect(result).toBe(true);
      expect(mockModelContext.unregisterTool).toHaveBeenCalledWith('test-tool');
      expect(adapter.isRegistered('test-tool')).toBe(false);
    });

    it('should return false for unknown tool', () => {
      const result = adapter.unregisterTool('unknown-tool');
      expect(result).toBe(false);
    });

    it('should handle unregister errors gracefully', () => {
      (mockModelContext.unregisterTool as jest.Mock).mockImplementation(() => {
        throw new Error('Unregister failed');
      });
      const result = adapter.unregisterTool('test-tool');
      expect(result).toBe(false);
      expect(adapter.isRegistered('test-tool')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe('clearAll()', () => {
    it('should call clearContext() to unregister all tools', () => {
      const mockModelContext: ModelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      (globalThis.navigator as any).modelContext =
        mockModelContext;

      adapter.registerTool('tool-1', 'desc', { type: 'object' }, mockHandler);
      adapter.registerTool('tool-2', 'desc', { type: 'object' }, mockHandler);

      expect(adapter.getRegisteredTools()).toHaveLength(2);

      adapter.clearAll();

      expect(mockModelContext.clearContext).toHaveBeenCalled();
      expect(adapter.getRegisteredTools()).toHaveLength(0);
    });

    it('should handle empty state gracefully', () => {
      adapter.clearAll();
      expect(adapter.getRegisteredTools()).toHaveLength(0);
    });

    it('should fall back to individual unregisterTool if clearContext throws', () => {
      const mockModelContext: ModelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn().mockImplementation(() => {
          throw new Error('clearContext failed');
        }),
        provideContext: jest.fn(),
      };
      (globalThis.navigator as any).modelContext =
        mockModelContext;

      adapter.registerTool('tool-a', 'desc', { type: 'object' }, mockHandler);

      adapter.clearAll();

      expect(mockModelContext.unregisterTool).toHaveBeenCalledWith('tool-a');
      expect(adapter.getRegisteredTools()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Query Methods
  // ---------------------------------------------------------------------------

  describe('query methods', () => {
    it('getRegisteredTools() returns tool names registered via WebMCP', () => {
      const mockModelContext: ModelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      (globalThis.navigator as any).modelContext =
        mockModelContext;

      adapter.registerTool('tool-a', 'desc', { type: 'object' }, mockHandler);
      adapter.registerTool('tool-b', 'desc', { type: 'object' }, mockHandler);

      const names = adapter.getRegisteredTools();
      expect(names).toContain('tool-a');
      expect(names).toContain('tool-b');
      expect(names).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Static Utility
  // ---------------------------------------------------------------------------

  describe('toModelContextTool()', () => {
    it('should convert ToolDefinition + handler to ModelContextTool', async () => {
      const result = WebMcpAdapter.toModelContextTool(
        {
          name: 'my-tool',
          description: 'My tool',
          inputSchema: {
            type: 'object',
            properties: { x: { type: 'number' } },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
          },
        },
        mockHandler,
      );

      expect(result.name).toBe('my-tool');
      expect(result.description).toBe('My tool');
      expect(result.inputSchema).toEqual({
        type: 'object',
        properties: { x: { type: 'number' } },
      });
      expect(result.annotations).toEqual({ readOnlyHint: true });
      expect(result.execute).toBeDefined();

      const execResult = await result.execute(
        { x: 42 },
        { requestUserInteraction: jest.fn() },
      );
      expect(mockHandler).toHaveBeenCalledWith({ x: 42 });
      expect(execResult).toEqual({
        content: [{ type: 'text', text: '{"x":42}' }],
      });
    });

    it('should use tool name as description fallback', () => {
      const result = WebMcpAdapter.toModelContextTool(
        {
          name: 'no-desc-tool',
          inputSchema: { type: 'object' },
        },
        mockHandler,
      );

      expect(result.description).toBe('no-desc-tool');
    });
  });
});
