/**
 * React hook for registering MCP tools with automatic lifecycle management
 *
 * Features:
 * - Automatic registration on mount
 * - Reference counting for shared tools
 * - Automatic cleanup on unmount
 * - Re-render safe (uses refs)
 * - Works with or without Context
 */

import { useEffect, useRef, useCallback } from 'react';
import { workerClient, type ToolHandler } from '@mcp-fe/mcp-worker';

// Global registry to track tool usage across components
const toolRegistry = new Map<
  string,
  {
    refCount: number;
    handler: ToolHandler;
    schema: {
      description: string;
      inputSchema: Record<string, unknown>;
    };
    isRegistered: boolean;
  }
>();

// Queue for pending registrations (to avoid race conditions)
const registrationQueue = new Map<string, Promise<void>>();

export interface UseMCPToolOptions {
  /**
   * Tool name (must be unique)
   */
  name: string;

  /**
   * Tool description for AI
   */
  description: string;

  /**
   * JSON Schema for tool inputs
   */
  inputSchema: Record<string, unknown>;

  /**
   * Handler function (runs in main thread with full browser access)
   */
  handler: ToolHandler;

  /**
   * Whether to register immediately on mount (default: true)
   */
  autoRegister?: boolean;

  /**
   * Whether to unregister on unmount (default: true)
   * Set to false if tool should persist across component unmounts
   */
  autoUnregister?: boolean;
}

export interface UseMCPToolResult {
  /**
   * Whether the tool is currently registered
   */
  isRegistered: boolean;

  /**
   * Manually register the tool (if autoRegister is false)
   */
  register: () => Promise<void>;

  /**
   * Manually unregister the tool
   */
  unregister: () => Promise<void>;

  /**
   * Current reference count (how many components are using this tool)
   */
  refCount: number;
}

/**
 * Hook for registering MCP tools with automatic lifecycle management
 *
 * @example Basic usage:
 * ```tsx
 * function MyComponent() {
 *   const { isRegistered } = useMCPTool({
 *     name: 'get_time',
 *     description: 'Get current time',
 *     inputSchema: { type: 'object', properties: {} },
 *     handler: async () => ({
 *       content: [{ type: 'text', text: new Date().toISOString() }]
 *     })
 *   });
 *
 *   return <div>Tool registered: {isRegistered ? 'Yes' : 'No'}</div>;
 * }
 * ```
 *
 * @example With dependencies (React state, props, etc.):
 * ```tsx
 * function UserProfile({ userId }) {
 *   const [userData, setUserData] = useState(null);
 *
 *   useMCPTool({
 *     name: 'get_user_profile',
 *     description: 'Get current user profile',
 *     inputSchema: { type: 'object', properties: {} },
 *     handler: async () => {
 *       // Has access to component state!
 *       return {
 *         content: [{
 *           type: 'text',
 *           text: JSON.stringify({ userId, userData })
 *         }]
 *       };
 *     }
 *   });
 * }
 * ```
 *
 * @example Manual registration:
 * ```tsx
 * function AdminPanel() {
 *   const { register, unregister, isRegistered } = useMCPTool({
 *     name: 'admin_action',
 *     description: 'Perform admin action',
 *     inputSchema: { type: 'object', properties: {} },
 *     handler: async () => ({ content: [{ type: 'text', text: 'Done' }] }),
 *     autoRegister: false
 *   });
 *
 *   return (
 *     <button onClick={isRegistered ? unregister : register}>
 *       {isRegistered ? 'Disable' : 'Enable'} Admin Tool
 *     </button>
 *   );
 * }
 * ```
 */
export function useMCPTool(options: UseMCPToolOptions): UseMCPToolResult {
  const {
    name,
    description,
    inputSchema,
    handler,
    autoRegister = true,
    autoUnregister = true,
  } = options;

  // Use refs to store values that shouldn't trigger re-renders
  const handlerRef = useRef(handler);
  const isMountedRef = useRef(true);
  const hasRegisteredRef = useRef(false);

  // Update handler ref when it changes (to capture latest closure)
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Stable wrapper that always calls the latest handler
  const stableHandler = useCallback<ToolHandler>(async (args: unknown) => {
    return handlerRef.current(args);
  }, []);

  /**
   * Register the tool with reference counting
   */
  const register = useCallback(async () => {
    // Check if registration is already in progress
    const pendingRegistration = registrationQueue.get(name);
    if (pendingRegistration) {
      await pendingRegistration;
      return;
    }

    const registrationPromise = (async () => {
      try {
        // Wait for worker initialization before registering
        if (!workerClient.initialized) {
          console.log(
            `[useMCPTool] Waiting for worker initialization before registering '${name}'`,
          );
          await workerClient.waitForInit();
        }

        const existing = toolRegistry.get(name);

        if (existing) {
          // Tool already registered - increment ref count
          existing.refCount++;

          // Update handler to latest version
          existing.handler = stableHandler;

          console.log(
            `[useMCPTool] Incremented ref count for '${name}': ${existing.refCount}`,
          );
        } else {
          // First registration - register with worker
          await workerClient.registerTool(
            name,
            description,
            inputSchema,
            stableHandler,
          );

          toolRegistry.set(name, {
            refCount: 1,
            handler: stableHandler,
            schema: { description, inputSchema },
            isRegistered: true,
          });

          console.log(`[useMCPTool] Registered tool '${name}'`);
        }

        hasRegisteredRef.current = true;
      } catch (error) {
        console.error(`[useMCPTool] Failed to register tool '${name}':`, error);
        throw error;
      } finally {
        registrationQueue.delete(name);
      }
    })();

    registrationQueue.set(name, registrationPromise);
    await registrationPromise;
  }, [name, description, inputSchema, stableHandler]);

  /**
   * Unregister the tool with reference counting
   */
  const unregister = useCallback(async () => {
    const existing = toolRegistry.get(name);
    if (!existing) {
      console.warn(`[useMCPTool] Cannot unregister '${name}': not found`);
      return;
    }

    existing.refCount--;
    console.log(
      `[useMCPTool] Decremented ref count for '${name}': ${existing.refCount}`,
    );

    if (existing.refCount <= 0) {
      // Last reference - actually unregister
      try {
        await workerClient.unregisterTool(name);
        toolRegistry.delete(name);
        console.log(`[useMCPTool] Unregistered tool '${name}'`);
      } catch (error) {
        console.error(
          `[useMCPTool] Failed to unregister tool '${name}':`,
          error,
        );
      }
    }

    hasRegisteredRef.current = false;
  }, [name]);

  // Auto-register on mount
  useEffect(() => {
    if (autoRegister) {
      register().catch((error) => {
        console.error(
          `[useMCPTool] Auto-register failed for '${name}':`,
          error,
        );
      });
    }

    return () => {
      isMountedRef.current = false;

      // Auto-unregister on unmount
      if (autoUnregister && hasRegisteredRef.current) {
        unregister().catch((error) => {
          console.error(
            `[useMCPTool] Auto-unregister failed for '${name}':`,
            error,
          );
        });
      }
    };
  }, [name, autoRegister, autoUnregister, register, unregister]);

  // Get current state
  const toolInfo = toolRegistry.get(name);
  const isRegistered = toolInfo?.isRegistered ?? false;
  const refCount = toolInfo?.refCount ?? 0;

  return {
    isRegistered,
    register,
    unregister,
    refCount,
  };
}

/**
 * Utility function to check if a tool is registered
 */
export function isToolRegistered(name: string): boolean {
  return toolRegistry.has(name);
}

/**
 * Utility function to get all registered tools
 */
export function getRegisteredTools(): string[] {
  return Array.from(toolRegistry.keys());
}

/**
 * Utility function to get tool info
 */
export function getToolInfo(name: string) {
  return toolRegistry.get(name);
}
