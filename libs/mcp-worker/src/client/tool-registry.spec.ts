/**
 * ToolRegistry Unit Tests
 */

import { ToolRegistry } from './tool-registry';
import type { ToolHandler, ToolOptions } from './tool-registry';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockHandler: ToolHandler;

  beforeEach(() => {
    registry = new ToolRegistry();
    mockHandler = jest.fn(async (args: unknown) => ({
      content: [{ type: 'text', text: JSON.stringify(args) }],
    }));
  });

  describe('Tool Registration', () => {
    it('should register a new tool', () => {
      const isNew = registry.register(
        'test-tool',
        'A test tool',
        { type: 'object', properties: {} },
        mockHandler,
      );

      expect(isNew).toBe(true);
      expect(registry.isRegistered('test-tool')).toBe(true);
      expect(registry.getHandler('test-tool')).toBe(mockHandler);
    });

    it('should increment ref count for existing tool', () => {
      // First registration
      const isNew1 = registry.register(
        'test-tool',
        'A test tool',
        { type: 'object', properties: {} },
        mockHandler,
      );

      // Second registration (same tool)
      const isNew2 = registry.register(
        'test-tool',
        'A test tool',
        { type: 'object', properties: {} },
        mockHandler,
      );

      expect(isNew1).toBe(true);
      expect(isNew2).toBe(false);

      const info = registry.getInfo('test-tool');
      expect(info?.refCount).toBe(2);
      expect(info?.isRegistered).toBe(true);
    });

    it('should update handler on re-registration', () => {
      const handler1 = jest.fn(async () => ({
        content: [{ type: 'text', text: 'v1' }],
      }));
      const handler2 = jest.fn(async () => ({
        content: [{ type: 'text', text: 'v2' }],
      }));

      registry.register('test-tool', 'A test tool', {}, handler1);
      registry.register('test-tool', 'A test tool', {}, handler2);

      expect(registry.getHandler('test-tool')).toBe(handler2);
    });

    it('should store tool with all options', () => {
      const options: ToolOptions = {
        outputSchema: { type: 'object' },
        annotations: {
          title: 'Test Tool',
          readOnlyHint: true,
          destructiveHint: false,
        },
        execution: {
          taskSupport: 'optional',
        },
        _meta: { version: '1.0' },
        icons: [{ src: '/icon.png' }],
        title: 'Test',
      };

      registry.register('test-tool', 'Description', {}, mockHandler, options);

      const details = registry.getDetails('test-tool');
      expect(details?.outputSchema).toEqual(options.outputSchema);
      expect(details?.annotations).toEqual(options.annotations);
      expect(details?.execution).toEqual(options.execution);
      expect(details?._meta).toEqual(options._meta);
      expect(details?.icons).toEqual(options.icons);
      expect(details?.title).toBe(options.title);
    });
  });

  describe('Tool Unregistration', () => {
    beforeEach(() => {
      registry.register('test-tool', 'A test tool', {}, mockHandler);
    });

    it('should decrement ref count on unregister', () => {
      // Register twice
      registry.register('test-tool', 'A test tool', {}, mockHandler);

      const info1 = registry.getInfo('test-tool');
      expect(info1?.refCount).toBe(2);

      // Unregister once
      const result = registry.unregister('test-tool');
      expect(result).toBe(false); // Still has references

      const info2 = registry.getInfo('test-tool');
      expect(info2?.refCount).toBe(1);
      expect(info2?.isRegistered).toBe(true);
    });

    it('should remove tool when ref count reaches 0', () => {
      const result = registry.unregister('test-tool');

      expect(result).toBe(true); // Tool removed
      expect(registry.isRegistered('test-tool')).toBe(false);
      expect(registry.getHandler('test-tool')).toBeUndefined();
      expect(registry.getInfo('test-tool')).toBeNull();
    });

    it('should return null for non-existent tool', () => {
      const result = registry.unregister('non-existent');

      expect(result).toBeNull();
    });

    it('should handle multiple unregister calls', () => {
      // Register 3 times
      registry.register('test-tool', 'A test tool', {}, mockHandler);
      registry.register('test-tool', 'A test tool', {}, mockHandler);

      expect(registry.getInfo('test-tool')?.refCount).toBe(3);

      // Unregister 3 times
      expect(registry.unregister('test-tool')).toBe(false); // refCount: 2
      expect(registry.unregister('test-tool')).toBe(false); // refCount: 1
      expect(registry.unregister('test-tool')).toBe(true); // removed

      expect(registry.isRegistered('test-tool')).toBe(false);
    });
  });

  describe('Tool Queries', () => {
    beforeEach(() => {
      registry.register('tool-1', 'Tool 1', {}, mockHandler);
      registry.register('tool-2', 'Tool 2', {}, mockHandler);
    });

    it('should get tool handler', () => {
      const handler = registry.getHandler('tool-1');
      expect(handler).toBe(mockHandler);
    });

    it('should return undefined for non-existent handler', () => {
      const handler = registry.getHandler('non-existent');
      expect(handler).toBeUndefined();
    });

    it('should get tool info', () => {
      const info = registry.getInfo('tool-1');

      expect(info).not.toBeNull();
      expect(info?.refCount).toBe(1);
      expect(info?.isRegistered).toBe(true);
    });

    it('should return null info for non-existent tool', () => {
      const info = registry.getInfo('non-existent');
      expect(info).toBeNull();
    });

    it('should get tool details', () => {
      const details = registry.getDetails('tool-1');

      expect(details).not.toBeNull();
      expect(details?.name).toBe('tool-1');
      expect(details?.description).toBe('Tool 1');
      expect(details?.refCount).toBe(1);
      expect(details?.isRegistered).toBe(true);
    });

    it('should get all registered tool names', () => {
      const tools = registry.getRegisteredTools();

      expect(tools).toHaveLength(2);
      expect(tools).toContain('tool-1');
      expect(tools).toContain('tool-2');
    });

    it('should get all tool names including those with refCount > 1', () => {
      // Register tool-3 multiple times to have refCount > 1
      registry.register('tool-3', 'Tool 3', {}, mockHandler);
      registry.register('tool-3', 'Tool 3', {}, mockHandler);

      const allTools = registry.getAllToolNames();
      const registeredTools = registry.getRegisteredTools();

      // All should be registered
      expect(allTools).toContain('tool-1');
      expect(allTools).toContain('tool-2');
      expect(allTools).toContain('tool-3');

      expect(registeredTools).toContain('tool-1');
      expect(registeredTools).toContain('tool-2');
      expect(registeredTools).toContain('tool-3');

      // tool-3 should have refCount of 2
      expect(registry.getInfo('tool-3')?.refCount).toBe(2);
    });

    it('should check if tool is registered', () => {
      expect(registry.isRegistered('tool-1')).toBe(true);
      expect(registry.isRegistered('tool-2')).toBe(true);
      expect(registry.isRegistered('non-existent')).toBe(false);
    });
  });

  describe('Tool Change Subscriptions', () => {
    it('should call callback immediately with current value on subscribe', () => {
      registry.register('test-tool', 'A test tool', {}, mockHandler);

      const callback = jest.fn();
      registry.onToolChange('test-tool', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        refCount: 1,
        isRegistered: true,
      });
    });

    it('should call callback with null for non-existent tool', () => {
      const callback = jest.fn();
      registry.onToolChange('non-existent', callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should notify subscribers on registration', () => {
      const callback = jest.fn();
      registry.onToolChange('test-tool', callback);

      callback.mockClear(); // Clear initial call

      registry.register('test-tool', 'A test tool', {}, mockHandler);

      expect(callback).toHaveBeenCalledWith({
        refCount: 1,
        isRegistered: true,
      });
    });

    it('should notify subscribers on ref count change', () => {
      registry.register('test-tool', 'A test tool', {}, mockHandler);

      const callback = jest.fn();
      registry.onToolChange('test-tool', callback);

      callback.mockClear();

      // Increment ref count
      registry.register('test-tool', 'A test tool', {}, mockHandler);

      expect(callback).toHaveBeenCalledWith({
        refCount: 2,
        isRegistered: true,
      });
    });

    it('should notify subscribers on unregistration', () => {
      registry.register('test-tool', 'A test tool', {}, mockHandler);

      const callback = jest.fn();
      registry.onToolChange('test-tool', callback);

      callback.mockClear();

      registry.unregister('test-tool');

      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should support multiple subscribers', () => {
      registry.register('test-tool', 'A test tool', {}, mockHandler);

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      registry.onToolChange('test-tool', callback1);
      registry.onToolChange('test-tool', callback2);

      callback1.mockClear();
      callback2.mockClear();

      registry.register('test-tool', 'A test tool', {}, mockHandler);

      expect(callback1).toHaveBeenCalledWith({
        refCount: 2,
        isRegistered: true,
      });
      expect(callback2).toHaveBeenCalledWith({
        refCount: 2,
        isRegistered: true,
      });
    });

    it('should unsubscribe correctly', () => {
      registry.register('test-tool', 'A test tool', {}, mockHandler);

      const callback = jest.fn();
      const unsubscribe = registry.onToolChange('test-tool', callback);

      callback.mockClear();

      // Unsubscribe
      unsubscribe();

      // This should NOT trigger callback
      registry.register('test-tool', 'A test tool', {}, mockHandler);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      registry.register('test-tool', 'A test tool', {}, mockHandler);

      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const goodCallback = jest.fn();

      // Subscribe - errorCallback will throw on initial call but shouldn't break
      expect(() => {
        registry.onToolChange('test-tool', errorCallback);
      }).not.toThrow();

      registry.onToolChange('test-tool', goodCallback);

      errorCallback.mockClear();
      goodCallback.mockClear();

      // Should not throw and should still call goodCallback despite errorCallback throwing
      expect(() => {
        registry.register('test-tool', 'A test tool', {}, mockHandler);
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('Clear and Cleanup', () => {
    beforeEach(() => {
      registry.register('tool-1', 'Tool 1', {}, mockHandler);
      registry.register('tool-2', 'Tool 2', {}, mockHandler);
      registry.register('tool-3', 'Tool 3', {}, mockHandler);
    });

    it('should clear all tools', () => {
      registry.clear();

      expect(registry.getRegisteredTools()).toHaveLength(0);
      expect(registry.getAllToolNames()).toHaveLength(0);
      expect(registry.getHandler('tool-1')).toBeUndefined();
    });

    it('should clear all subscriptions', () => {
      const callback = jest.fn();
      registry.onToolChange('tool-1', callback);

      registry.clear();

      callback.mockClear();

      // Register again - callback should not be called
      registry.register('tool-1', 'Tool 1', {}, mockHandler);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle tool with undefined description', () => {
      registry.register('test-tool', undefined, {}, mockHandler);

      const details = registry.getDetails('test-tool');
      expect(details?.description).toBeUndefined();
    });

    it('should handle tool with empty schema', () => {
      registry.register('test-tool', 'Test', {}, mockHandler);

      const details = registry.getDetails('test-tool');
      expect(details?.inputSchema).toEqual({});
    });

    it('should handle concurrent registrations', () => {
      // Simulate multiple components registering the same tool
      registry.register('shared-tool', 'Shared', {}, mockHandler);
      registry.register('shared-tool', 'Shared', {}, mockHandler);
      registry.register('shared-tool', 'Shared', {}, mockHandler);

      expect(registry.getInfo('shared-tool')?.refCount).toBe(3);

      // All should unregister cleanly
      registry.unregister('shared-tool');
      registry.unregister('shared-tool');
      registry.unregister('shared-tool');

      expect(registry.isRegistered('shared-tool')).toBe(false);
    });

    it('should handle over-unregistration gracefully', () => {
      registry.register('test-tool', 'Test', {}, mockHandler);

      registry.unregister('test-tool'); // refCount: 0, removed
      const result = registry.unregister('test-tool'); // Already removed

      expect(result).toBeNull();
    });
  });

  describe('Handler Execution', () => {
    it('should execute handler correctly', async () => {
      const handler = jest.fn(async (args: unknown) => ({
        content: [{ type: 'text', text: `Result: ${JSON.stringify(args)}` }],
      }));

      registry.register('test-tool', 'Test', {}, handler);

      const retrievedHandler = registry.getHandler('test-tool');
      expect(retrievedHandler).toBe(handler);

      const result = await retrievedHandler!({ input: 'test' });

      expect(handler).toHaveBeenCalledWith({ input: 'test' });
      expect(result.content[0].text).toContain('test');
    });

    it('should handle async handler errors', async () => {
      const errorHandler = jest.fn(async () => {
        throw new Error('Handler error');
      });

      registry.register('test-tool', 'Test', {}, errorHandler);

      const retrievedHandler = registry.getHandler('test-tool');

      await expect(retrievedHandler!({})).rejects.toThrow('Handler error');
    });
  });
});
