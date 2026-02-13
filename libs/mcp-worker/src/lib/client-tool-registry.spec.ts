/**
 * ClientToolRegistry Unit Tests
 */

import {
  ClientToolRegistry,
  ToolHandler,
  ToolMetadata,
  PendingRegistration,
} from './client-tool-registry';

describe('ClientToolRegistry', () => {
  let registry: ClientToolRegistry;

  beforeEach(() => {
    registry = new ClientToolRegistry();
  });

  describe('Tool Registration', () => {
    it('should register a new tool', () => {
      const metadata: ToolMetadata = {
        description: 'A test tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      const isNew = registry.register('test-tool', metadata, handler);

      expect(isNew).toBe(true);
      expect(registry.has('test-tool')).toBe(true);

      const info = registry.getToolInfo('test-tool');
      expect(info).not.toBeNull();
      expect(info?.refCount).toBe(1);
      expect(info?.isRegistered).toBe(true);
      expect(info?.description).toBe('A test tool');
    });

    it('should increment refCount on duplicate registration', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      const isNew1 = registry.register('test-tool', metadata, handler);
      const isNew2 = registry.register('test-tool', metadata, handler);

      expect(isNew1).toBe(true);
      expect(isNew2).toBe(false);

      const info = registry.getToolInfo('test-tool');
      expect(info?.refCount).toBe(2);
    });

    it('should update handler on re-registration', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler1: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'handler1' }],
      });

      const handler2: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'handler2' }],
      });

      registry.register('test-tool', metadata, handler1);
      registry.register('test-tool', metadata, handler2);

      const handler = registry.getHandler('test-tool');
      expect(handler).toBe(handler2);
    });

    it('should register multiple tools', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('tool-1', metadata, handler);
      registry.register('tool-2', metadata, handler);
      registry.register('tool-3', metadata, handler);

      const names = registry.getToolNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('tool-1');
      expect(names).toContain('tool-2');
      expect(names).toContain('tool-3');
    });

    it('should register tool with full metadata', () => {
      const metadata: ToolMetadata = {
        description: 'Complex tool',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        annotations: {
          title: 'Complex Tool',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        execution: {
          taskSupport: 'optional',
        },
        _meta: {
          customField: 'customValue',
        },
        icons: [
          {
            src: 'icon.png',
            mimeType: 'image/png',
            sizes: ['16x16', '32x32'],
            theme: 'light',
          },
        ],
        title: 'Complex Tool',
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('complex-tool', metadata, handler);

      const info = registry.getToolInfo('complex-tool');
      expect(info?.annotations?.readOnlyHint).toBe(true);
      expect(info?.execution?.taskSupport).toBe('optional');
      expect(info?._meta?.['customField']).toBe('customValue');
      expect(info?.icons).toHaveLength(1);
    });
  });

  describe('Tool Unregistration', () => {
    it('should decrement refCount on unregister', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);
      registry.register('test-tool', metadata, handler);

      expect(registry.getToolInfo('test-tool')?.refCount).toBe(2);

      const result = registry.unregister('test-tool');

      expect(result).toBe(false); // Not removed, just decremented
      expect(registry.getToolInfo('test-tool')?.refCount).toBe(1);
      expect(registry.has('test-tool')).toBe(true);
    });

    it('should remove tool when refCount reaches zero', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);

      const result = registry.unregister('test-tool');

      expect(result).toBe(true); // Tool removed
      expect(registry.has('test-tool')).toBe(false);
      expect(registry.getToolInfo('test-tool')).toBeNull();
      expect(registry.getHandler('test-tool')).toBeUndefined();
    });

    it('should return undefined for non-existent tool', () => {
      const result = registry.unregister('non-existent');

      expect(result).toBeUndefined();
    });

    it('should unregister only specified tool', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('tool-1', metadata, handler);
      registry.register('tool-2', metadata, handler);

      registry.unregister('tool-1');

      expect(registry.has('tool-1')).toBe(false);
      expect(registry.has('tool-2')).toBe(true);
    });
  });

  describe('Get Handler', () => {
    it('should return handler for registered tool', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);

      const retrievedHandler = registry.getHandler('test-tool');
      expect(retrievedHandler).toBe(handler);
    });

    it('should return undefined for non-existent tool', () => {
      const handler = registry.getHandler('non-existent');
      expect(handler).toBeUndefined();
    });

    it('should execute handler correctly', async () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async (args: unknown) => ({
        content: [{ type: 'text', text: `echo: ${JSON.stringify(args)}` }],
      });

      registry.register('echo-tool', metadata, handler);

      const retrievedHandler = registry.getHandler('echo-tool');
      if (!retrievedHandler) return;

      const result = await retrievedHandler({ message: 'hello' });
      expect(result.content[0].text).toBe('echo: {"message":"hello"}');
    });
  });

  describe('Get Tool Info', () => {
    it('should return tool info with all metadata', () => {
      const metadata: ToolMetadata = {
        description: 'Test tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);

      const info = registry.getToolInfo('test-tool');
      expect(info).not.toBeNull();
      expect(info?.refCount).toBe(1);
      expect(info?.isRegistered).toBe(true);
      expect(info?.description).toBe('Test tool');
    });

    it('should return null for non-existent tool', () => {
      const info = registry.getToolInfo('non-existent');
      expect(info).toBeNull();
    });

    it('should return a copy of tool info', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);

      const info1 = registry.getToolInfo('test-tool');
      const info2 = registry.getToolInfo('test-tool');

      expect(info1).not.toBe(info2); // Different objects
      expect(info1).toEqual(info2); // But equal content
    });
  });

  describe('Get Tool Names', () => {
    it('should return empty array when no tools registered', () => {
      const names = registry.getToolNames();
      expect(names).toEqual([]);
    });

    it('should return all registered tool names', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('tool-1', metadata, handler);
      registry.register('tool-2', metadata, handler);
      registry.register('tool-3', metadata, handler);

      const names = registry.getToolNames();
      expect(names).toHaveLength(3);
      expect(names).toEqual(
        expect.arrayContaining(['tool-1', 'tool-2', 'tool-3']),
      );
    });
  });

  describe('Has Tool', () => {
    it('should return true for registered tool', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);

      expect(registry.has('test-tool')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.has('non-existent')).toBe(false);
    });

    it('should return false after tool is unregistered', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);
      registry.unregister('test-tool');

      expect(registry.has('test-tool')).toBe(false);
    });
  });

  describe('Change Listeners', () => {
    it('should notify listener on registration', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      const callback = jest.fn();
      registry.onChange('test-tool', callback);

      // Should be called immediately with null (tool doesn't exist yet)
      expect(callback).toHaveBeenCalledWith(null);

      registry.register('test-tool', metadata, handler);

      // Should be called again with tool info
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          refCount: 1,
          isRegistered: true,
        }),
      );
    });

    it('should notify listener on unregistration', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);

      const callback = jest.fn();
      registry.onChange('test-tool', callback);

      callback.mockClear(); // Clear initial call

      registry.unregister('test-tool');

      // Should be notified with null (tool removed)
      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should notify listener on refCount change', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);

      const callback = jest.fn();
      registry.onChange('test-tool', callback);

      callback.mockClear(); // Clear initial call

      registry.register('test-tool', metadata, handler); // Increment

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          refCount: 2,
        }),
      );
    });

    it('should allow unsubscribing', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      const callback = jest.fn();
      const unsubscribe = registry.onChange('test-tool', callback);

      callback.mockClear();
      unsubscribe();

      registry.register('test-tool', metadata, handler);

      // Should not be called after unsubscribe
      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple listeners for same tool', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      registry.onChange('test-tool', callback1);
      registry.onChange('test-tool', callback2);

      callback1.mockClear();
      callback2.mockClear();

      registry.register('test-tool', metadata, handler);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      // First register the tool
      registry.register('test-tool', metadata, handler);

      const errorCallback = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalCallback = jest.fn();

      // Subscribe after tool exists to avoid error during initial callback
      registry.onChange('test-tool', errorCallback);
      registry.onChange('test-tool', normalCallback);

      errorCallback.mockClear();
      normalCallback.mockClear();

      // Re-register to trigger listeners (increment refCount)
      // Should not throw, and normal callback should still be called despite error
      expect(() =>
        registry.register('test-tool', metadata, handler),
      ).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Clear', () => {
    it('should clear all tools and handlers', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('tool-1', metadata, handler);
      registry.register('tool-2', metadata, handler);

      registry.clear();

      expect(registry.getToolNames()).toHaveLength(0);
      expect(registry.has('tool-1')).toBe(false);
      expect(registry.has('tool-2')).toBe(false);
    });

    it('should clear listeners', () => {
      const callback = jest.fn();
      registry.onChange('test-tool', callback);

      registry.clear();

      const stats = registry.getStats();
      expect(stats.activeListeners).toBe(0);
    });

    it('should clear pending queue', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.addPending({
        name: 'pending-tool',
        metadata,
        handler,
        resolve: jest.fn(),
        reject: jest.fn(),
      });

      registry.clear();

      expect(registry.getPendingCount()).toBe(0);
    });
  });

  describe('Pending Queue', () => {
    it('should add pending registration', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      const pending: PendingRegistration = {
        name: 'pending-tool',
        metadata,
        handler,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      registry.addPending(pending);

      expect(registry.getPendingCount()).toBe(1);
      const pendingList = registry.getPending();
      expect(pendingList).toHaveLength(1);
      expect(pendingList[0].name).toBe('pending-tool');
    });

    it('should return copy of pending queue', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.addPending({
        name: 'pending-tool',
        metadata,
        handler,
        resolve: jest.fn(),
        reject: jest.fn(),
      });

      const pending1 = registry.getPending();
      const pending2 = registry.getPending();

      expect(pending1).not.toBe(pending2); // Different arrays
      expect(pending1).toEqual(pending2); // But equal content
    });

    it('should clear pending queue', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.addPending({
        name: 'pending-tool',
        metadata,
        handler,
        resolve: jest.fn(),
        reject: jest.fn(),
      });

      expect(registry.getPendingCount()).toBe(1);

      registry.clearPending();

      expect(registry.getPendingCount()).toBe(0);
      expect(registry.getPending()).toHaveLength(0);
    });
  });

  describe('Update Metadata', () => {
    it('should update tool metadata', () => {
      const metadata: ToolMetadata = {
        description: 'Original description',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);

      const updated = registry.updateMetadata('test-tool', {
        description: 'Updated description',
      });

      expect(updated).toBe(true);

      const info = registry.getToolInfo('test-tool');
      expect(info?.description).toBe('Updated description');
      expect(info?.refCount).toBe(1); // Unchanged
    });

    it('should return false for non-existent tool', () => {
      const updated = registry.updateMetadata('non-existent', {
        description: 'New description',
      });

      expect(updated).toBe(false);
    });

    it('should notify listeners on metadata update', () => {
      const metadata: ToolMetadata = {
        description: 'Original',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      registry.register('test-tool', metadata, handler);

      const callback = jest.fn();
      registry.onChange('test-tool', callback);

      callback.mockClear();

      registry.updateMetadata('test-tool', { description: 'Updated' });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Updated',
        }),
      );
    });
  });

  describe('Get Statistics', () => {
    it('should return correct statistics', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      // Register tools with different refCounts
      registry.register('tool-1', metadata, handler);
      registry.register('tool-2', metadata, handler);
      registry.register('tool-2', metadata, handler); // refCount = 2

      // Add pending
      registry.addPending({
        name: 'pending-tool',
        metadata,
        handler,
        resolve: jest.fn(),
        reject: jest.fn(),
      });

      // Add listener
      registry.onChange('tool-1', jest.fn());

      const stats = registry.getStats();

      expect(stats.totalTools).toBe(2);
      expect(stats.totalReferences).toBe(3); // 1 + 2
      expect(stats.pendingRegistrations).toBe(1);
      expect(stats.activeListeners).toBe(1);
    });

    it('should return zero stats for empty registry', () => {
      const stats = registry.getStats();

      expect(stats.totalTools).toBe(0);
      expect(stats.totalReferences).toBe(0);
      expect(stats.pendingRegistrations).toBe(0);
      expect(stats.activeListeners).toBe(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: register, use, unregister', async () => {
      const metadata: ToolMetadata = {
        description: 'Workflow tool',
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async (args: unknown) => ({
        content: [{ type: 'text', text: `Processed: ${JSON.stringify(args)}` }],
      });

      // Register
      const isNew = registry.register('workflow-tool', metadata, handler);
      expect(isNew).toBe(true);

      // Use
      const retrievedHandler = registry.getHandler('workflow-tool');
      if (!retrievedHandler) return;
      const result = await retrievedHandler({ test: 'data' });
      expect(result.content[0].text).toBe('Processed: {"test":"data"}');

      // Unregister
      const removed = registry.unregister('workflow-tool');
      expect(removed).toBe(true);
      expect(registry.has('workflow-tool')).toBe(false);
    });

    it('should handle React hook mount/unmount pattern', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      // First component mounts
      registry.register('hook-tool', metadata, handler);
      expect(registry.getToolInfo('hook-tool')?.refCount).toBe(1);

      // Second component mounts (same hook)
      registry.register('hook-tool', metadata, handler);
      expect(registry.getToolInfo('hook-tool')?.refCount).toBe(2);

      // First component unmounts
      registry.unregister('hook-tool');
      expect(registry.getToolInfo('hook-tool')?.refCount).toBe(1);
      expect(registry.has('hook-tool')).toBe(true);

      // Second component unmounts
      registry.unregister('hook-tool');
      expect(registry.has('hook-tool')).toBe(false);
    });

    it('should handle listener lifecycle', () => {
      const metadata: ToolMetadata = {
        inputSchema: { type: 'object' },
      };

      const handler: ToolHandler = async () => ({
        content: [{ type: 'text', text: 'result' }],
      });

      const callback = jest.fn();

      // Subscribe before tool exists
      const unsubscribe = registry.onChange('lifecycle-tool', callback);
      expect(callback).toHaveBeenCalledWith(null);

      callback.mockClear();

      // Register tool
      registry.register('lifecycle-tool', metadata, handler);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ refCount: 1 }),
      );

      callback.mockClear();

      // Unregister tool
      registry.unregister('lifecycle-tool');
      expect(callback).toHaveBeenCalledWith(null);

      // Unsubscribe
      unsubscribe();

      callback.mockClear();

      // Register again - should not notify
      registry.register('lifecycle-tool', metadata, handler);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
