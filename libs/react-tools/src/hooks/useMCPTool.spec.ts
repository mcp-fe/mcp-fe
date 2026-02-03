/**
 * Tests for useMCPTool hook lifecycle and behavior
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useMCPTool } from '../hooks/useMCPTool';
import { workerClient } from '@mcp-fe/mcp-worker';

// Mock workerClient
vi.mock('@mcp-fe/mcp-worker', () => ({
  workerClient: {
    initialized: true,
    registerTool: vi.fn().mockResolvedValue(undefined),
    unregisterTool: vi.fn().mockResolvedValue(true),
    waitForInit: vi.fn().mockResolvedValue(undefined),
    onToolChange: vi.fn((name, callback) => {
      // Immediately call with null (not registered yet)
      callback(null);
      // Return unsubscribe function
      return vi.fn();
    }),
    getToolInfo: vi.fn(() => null),
    getRegisteredTools: vi.fn(() => []),
    isToolRegistered: vi.fn(() => false),
  },
}));

describe('useMCPTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic registration', () => {
    it('should register tool on mount', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      // Mock onToolChange to simulate registration
      let changeCallback: ((info: any) => void) | null = null;
      (workerClient.onToolChange as any).mockImplementation(
        (name: string, callback: any) => {
          changeCallback = callback;
          // Initial call with null
          callback(null);
          return () => {};
        },
      );

      const { result } = renderHook(() =>
        useMCPTool({
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: { type: 'object', properties: {} },
          handler,
        }),
      );

      // Wait for registration to be called
      await waitFor(() => {
        expect(workerClient.registerTool).toHaveBeenCalledTimes(1);
      });

      expect(workerClient.registerTool).toHaveBeenCalledWith(
        'test_tool',
        'Test tool',
        { type: 'object', properties: {} },
        expect.any(Function),
      );

      // Simulate WorkerClient notifying that tool is registered
      act(() => {
        if (changeCallback) {
          changeCallback({ refCount: 1, isRegistered: true });
        }
      });

      // Wait for state to update
      await waitFor(() => {
        expect(result.current.isRegistered).toBe(true);
      });

      expect(result.current.refCount).toBe(1);
    });

    it('should unregister tool on unmount', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      const { unmount } = renderHook(() =>
        useMCPTool({
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: { type: 'object', properties: {} },
          handler,
        }),
      );

      await waitFor(() => {
        expect(workerClient.registerTool).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(workerClient.unregisterTool).toHaveBeenCalledWith('test_tool');
      });
    });

    it('should NOT re-register on re-render', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      let count = 0;
      const { rerender } = renderHook(() => {
        count++;
        return useMCPTool({
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: { type: 'object', properties: {} },
          handler,
        });
      });

      await waitFor(() => {
        expect(workerClient.registerTool).toHaveBeenCalledTimes(1);
      });

      // Force multiple re-renders
      rerender();
      rerender();
      rerender();

      expect(count).toBeGreaterThan(1); // Confirm re-renders happened

      // Should still only be called once (on mount)
      expect(workerClient.registerTool).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reference counting', () => {
    it('should increment refCount when same tool is used in multiple components', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      // Track callbacks for each subscription
      const callbacks: Map<string, (info: any) => void> = new Map();
      let callbackCounter = 0;

      (workerClient.onToolChange as any).mockImplementation(
        (name: string, callback: any) => {
          const id = `cb_${callbackCounter++}`;
          callbacks.set(id, callback);
          // Initial call with null
          callback(null);
          return () => callbacks.delete(id);
        },
      );

      const { result: result1 } = renderHook(() =>
        useMCPTool({
          name: 'shared_tool',
          description: 'Shared tool',
          inputSchema: { type: 'object', properties: {} },
          handler,
        }),
      );

      // Wait for first registration
      await waitFor(() => {
        expect(workerClient.registerTool).toHaveBeenCalledTimes(1);
      });

      // Simulate WorkerClient notifying refCount = 1
      act(() => {
        callbacks.forEach((cb) => cb({ refCount: 1, isRegistered: true }));
      });

      await waitFor(() => {
        expect(result1.current.refCount).toBe(1);
      });

      // Second component with same tool
      const { result: result2 } = renderHook(() =>
        useMCPTool({
          name: 'shared_tool',
          description: 'Shared tool',
          inputSchema: { type: 'object', properties: {} },
          handler,
        }),
      );

      // Should only register once (WorkerClient handles increment internally)
      expect(workerClient.registerTool).toHaveBeenCalledTimes(2); // Both call, but WorkerClient decides

      // Simulate WorkerClient notifying refCount = 2
      act(() => {
        callbacks.forEach((cb) => cb({ refCount: 2, isRegistered: true }));
      });

      await waitFor(() => {
        expect(result2.current.refCount).toBe(2);
      });
    });

    it('should decrement refCount when component unmounts but not unregister if still in use', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      const callbacks: Map<string, (info: any) => void> = new Map();
      let callbackCounter = 0;

      (workerClient.onToolChange as any).mockImplementation(
        (name: string, callback: any) => {
          const id = `cb_${callbackCounter++}`;
          callbacks.set(id, callback);
          callback(null);
          return () => callbacks.delete(id);
        },
      );

      const { unmount: unmount1 } = renderHook(() =>
        useMCPTool({
          name: 'shared_tool',
          description: 'Shared tool',
          inputSchema: { type: 'object', properties: {} },
          handler,
        }),
      );

      await waitFor(() => {
        expect(workerClient.registerTool).toHaveBeenCalled();
      });

      // Simulate registered with refCount 1
      act(() => {
        callbacks.forEach((cb) => cb({ refCount: 1, isRegistered: true }));
      });

      const { result: result2, unmount: unmount2 } = renderHook(() =>
        useMCPTool({
          name: 'shared_tool',
          description: 'Shared tool',
          inputSchema: { type: 'object', properties: {} },
          handler,
        }),
      );

      // Simulate refCount 2
      act(() => {
        callbacks.forEach((cb) => cb({ refCount: 2, isRegistered: true }));
      });

      await waitFor(() => {
        expect(result2.current.refCount).toBe(2);
      });

      // Unmount first instance
      unmount1();

      await waitFor(() => {
        expect(workerClient.unregisterTool).toHaveBeenCalledTimes(1);
      });

      // Simulate refCount decrement to 1
      act(() => {
        callbacks.forEach((cb) => cb({ refCount: 1, isRegistered: true }));
      });

      await waitFor(() => {
        expect(result2.current.refCount).toBe(1);
      });

      // Unmount second instance
      unmount2();

      // NOW it should unregister again
      await waitFor(() => {
        expect(workerClient.unregisterTool).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Manual registration control', () => {
    it('should not auto-register when autoRegister is false', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      const { result } = renderHook(() =>
        useMCPTool({
          name: 'manual_tool',
          description: 'Manual tool',
          inputSchema: { type: 'object', properties: {} },
          handler,
          autoRegister: false,
        }),
      );

      // Wait a bit to ensure it doesn't register
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(workerClient.registerTool).not.toHaveBeenCalled();
      expect(result.current.isRegistered).toBe(false);
    });

    it('should register when manually calling register()', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      let changeCallback: ((info: any) => void) | null = null;
      (workerClient.onToolChange as any).mockImplementation(
        (name: string, callback: any) => {
          changeCallback = callback;
          callback(null);
          return () => {};
        },
      );

      const { result } = renderHook(() =>
        useMCPTool({
          name: 'manual_tool',
          description: 'Manual tool',
          inputSchema: { type: 'object', properties: {} },
          handler,
          autoRegister: false,
        }),
      );

      expect(result.current.isRegistered).toBe(false);

      await act(async () => {
        await result.current.register();
      });

      await waitFor(() => {
        expect(workerClient.registerTool).toHaveBeenCalled();
      });

      // Simulate WorkerClient notifying registration
      act(() => {
        if (changeCallback) {
          changeCallback({ refCount: 1, isRegistered: true });
        }
      });

      await waitFor(() => {
        expect(result.current.isRegistered).toBe(true);
      });
    });

    it('should not auto-unregister when autoUnregister is false', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      const { unmount } = renderHook(() =>
        useMCPTool({
          name: 'persistent_tool',
          description: 'Persistent tool',
          inputSchema: { type: 'object', properties: {} },
          handler,
          autoUnregister: false,
        }),
      );

      await waitFor(() => {
        expect(workerClient.registerTool).toHaveBeenCalled();
      });

      unmount();

      // Wait a bit to ensure it doesn't unregister
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(workerClient.unregisterTool).not.toHaveBeenCalled();
    });
  });

  describe('Handler updates', () => {
    it('should use updated handler after re-render', async () => {
      let callCount = 0;

      const { rerender } = renderHook(
        ({ handler }) =>
          useMCPTool({
            name: 'dynamic_tool',
            description: 'Dynamic tool',
            inputSchema: { type: 'object', properties: {} },
            handler,
          }),
        {
          initialProps: {
            handler: vi.fn().mockResolvedValue({
              content: [{ type: 'text', text: `call ${++callCount}` }],
            }),
          },
        },
      );

      await waitFor(() => {
        expect(workerClient.registerTool).toHaveBeenCalled();
      });

      const firstHandler = (workerClient.registerTool as any).mock.calls[0][3];

      // Call the handler
      const result1 = await firstHandler({});
      expect(result1.content[0].text).toContain('call 1');

      // Re-render with new handler
      const newHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: `call ${++callCount}` }],
      });

      rerender({ handler: newHandler });

      // The handler should be updated in the registry
      // Call it again to verify
      const result2 = await firstHandler({});
      expect(result2.content[0].text).toContain('call 2');

      // Should NOT re-register
      expect(workerClient.registerTool).toHaveBeenCalledTimes(1);
    });
  });

  describe('Initialization handling', () => {
    it('should register tool even if worker is not initialized (WorkerClient queues)', async () => {
      // Mock worker as not initialized
      (workerClient as any).initialized = false;

      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      renderHook(() =>
        useMCPTool({
          name: 'wait_tool',
          description: 'Tool that waits',
          inputSchema: { type: 'object', properties: {} },
          handler,
        }),
      );

      // Hook should call registerTool immediately
      // WorkerClient internally handles queueing if not initialized
      await waitFor(() => {
        expect(workerClient.registerTool).toHaveBeenCalled();
      });

      // Simulate initialization complete (WorkerClient would process queue)
      (workerClient as any).initialized = true;
    });
  });

  describe('Error handling', () => {
    it('should handle registration errors gracefully', async () => {
      const registerError = new Error('Registration failed');
      (workerClient.registerTool as any).mockRejectedValueOnce(registerError);

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test' }],
      });

      const { result } = renderHook(() =>
        useMCPTool({
          name: 'error_tool',
          description: 'Tool that errors',
          inputSchema: { type: 'object', properties: {} },
          handler,
        }),
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Auto-register failed'),
          registerError,
        );
      });

      expect(result.current.isRegistered).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });
});
