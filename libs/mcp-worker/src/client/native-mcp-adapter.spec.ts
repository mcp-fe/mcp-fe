/**
 * NativeMcpAdapter Unit Tests
 *
 * Tests adapted to the WebMCP specification:
 * - navigator.modelContext (not navigator.mcp)
 * - Synchronous registerTool(tool) / unregisterTool(name) / clearContext()
 * - ModelContextTool dictionary with execute callback
 *
 * @see https://webmachinelearning.github.io/webmcp/
 */

import { NativeMcpAdapter } from './native-mcp-adapter';
import type { ToolHandler } from './tool-registry';
import type { ModelContext } from './native-mcp-types';

// Mock logger to avoid console noise
jest.mock('../shared/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('NativeMcpAdapter', () => {
  let adapter: NativeMcpAdapter;
  let mockHandler: ToolHandler;

  beforeEach(() => {
    adapter = new NativeMcpAdapter();
    mockHandler = jest.fn(async (args: unknown) => ({
      content: [{ type: 'text', text: JSON.stringify(args) }],
    }));
    // Clean up navigator.modelContext mock if set
    delete (globalThis.navigator as Record<string, unknown>).modelContext;
  });

  afterEach(() => {
    delete (globalThis.navigator as Record<string, unknown>).modelContext;
  });

  // ---------------------------------------------------------------------------
  // Feature Detection
  // ---------------------------------------------------------------------------

  describe('isSupported()', () => {
    it('should return false when navigator.modelContext does not exist', () => {
      expect(NativeMcpAdapter.isSupported()).toBe(false);
    });

    it('should return false when navigator.modelContext exists but has no registerTool', () => {
      (globalThis.navigator as Record<string, unknown>).modelContext = {
        clearContext: jest.fn(),
      };
      expect(NativeMcpAdapter.isSupported()).toBe(false);
    });

    it('should return true when navigator.modelContext.registerTool is a function', () => {
      (globalThis.navigator as Record<string, unknown>).modelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      expect(NativeMcpAdapter.isSupported()).toBe(true);
    });
  });

  describe('isAvailable()', () => {
    it('should return false when explicitly disabled', () => {
      (globalThis.navigator as Record<string, unknown>).modelContext = {
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
      (globalThis.navigator as Record<string, unknown>).modelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      // enabled by default — no setEnabled(true) needed
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
      (globalThis.navigator as Record<string, unknown>).modelContext =
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
      expect(adapter.isRegisteredNatively('test-tool')).toBe(false);
    });

    it('should register tool via navigator.modelContext.registerTool() by default when API is present', () => {
      // enabled by default — no setEnabled(true) needed

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
      expect(adapter.isRegisteredNatively('test-tool')).toBe(true);
    });

    it('should call unregisterTool before re-registering same tool name', () => {
      // First registration
      adapter.registerTool('test-tool', 'v1', { type: 'object' }, mockHandler);

      // Second registration (update)
      adapter.registerTool('test-tool', 'v2', { type: 'object' }, mockHandler);

      // unregisterTool should have been called for the first one
      expect(mockModelContext.unregisterTool).toHaveBeenCalledWith('test-tool');
      // registerTool should have been called twice
      expect(mockModelContext.registerTool).toHaveBeenCalledTimes(2);
      expect(adapter.isRegisteredNatively('test-tool')).toBe(true);
    });

    it('should handle native API errors gracefully', () => {
      (mockModelContext.registerTool as jest.Mock).mockImplementation(() => {
        throw new Error('Native API error');
      });

      // Should not throw
      adapter.registerTool(
        'failing-tool',
        'desc',
        { type: 'object' },
        mockHandler,
      );

      expect(adapter.isRegisteredNatively('failing-tool')).toBe(false);
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
          description: 'my-tool', // fallback
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

      // Extract the ModelContextTool passed to registerTool
      const registeredTool = (mockModelContext.registerTool as jest.Mock).mock
        .calls[0][0];
      expect(registeredTool.execute).toBeDefined();

      // Call the execute callback with a mock client
      const mockClient = {
        requestUserInteraction: jest.fn(),
      };
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
      (globalThis.navigator as Record<string, unknown>).modelContext =
        mockModelContext;
      adapter.registerTool(
        'test-tool',
        'desc',
        { type: 'object' },
        mockHandler,
      );
    });

    it('should unregister a natively registered tool', () => {
      const result = adapter.unregisterTool('test-tool');
      expect(result).toBe(true);
      expect(mockModelContext.unregisterTool).toHaveBeenCalledWith('test-tool');
      expect(adapter.isRegisteredNatively('test-tool')).toBe(false);
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
      // Should remove from local tracking even on failure
      expect(adapter.isRegisteredNatively('test-tool')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe('clearAll()', () => {
    it('should call clearContext() to unregister all native tools', () => {
      const mockModelContext: ModelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      (globalThis.navigator as Record<string, unknown>).modelContext =
        mockModelContext;

      adapter.registerTool('tool-1', 'desc', { type: 'object' }, mockHandler);
      adapter.registerTool('tool-2', 'desc', { type: 'object' }, mockHandler);

      expect(adapter.getNativelyRegisteredTools()).toHaveLength(2);

      adapter.clearAll();

      expect(mockModelContext.clearContext).toHaveBeenCalled();
      expect(adapter.getNativelyRegisteredTools()).toHaveLength(0);
    });

    it('should handle empty state gracefully', () => {
      // Should not throw
      adapter.clearAll();
      expect(adapter.getNativelyRegisteredTools()).toHaveLength(0);
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
      (globalThis.navigator as Record<string, unknown>).modelContext =
        mockModelContext;

      adapter.registerTool('tool-a', 'desc', { type: 'object' }, mockHandler);

      adapter.clearAll();

      // Should have attempted individual unregister as fallback
      expect(mockModelContext.unregisterTool).toHaveBeenCalledWith('tool-a');
      expect(adapter.getNativelyRegisteredTools()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Query Methods
  // ---------------------------------------------------------------------------

  describe('query methods', () => {
    it('getNativelyRegisteredTools() returns registered tool names', () => {
      const mockModelContext: ModelContext = {
        registerTool: jest.fn(),
        unregisterTool: jest.fn(),
        clearContext: jest.fn(),
        provideContext: jest.fn(),
      };
      (globalThis.navigator as Record<string, unknown>).modelContext =
        mockModelContext;
      adapter.setEnabled(true);

      adapter.registerTool('tool-a', 'desc', { type: 'object' }, mockHandler);
      adapter.registerTool('tool-b', 'desc', { type: 'object' }, mockHandler);

      const names = adapter.getNativelyRegisteredTools();
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
      const result = NativeMcpAdapter.toModelContextTool(
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

      // Verify execute wraps the handler
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
      const result = NativeMcpAdapter.toModelContextTool(
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
