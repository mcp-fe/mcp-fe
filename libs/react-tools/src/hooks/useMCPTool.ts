/**
 * React hook for registering MCP tools with automatic lifecycle management
 *
 * Features:
 * - Automatic registration on mount
 * - Reference counting for shared tools (managed by WorkerClient)
 * - Automatic cleanup on unmount
 * - Re-render safe (uses refs)
 * - Reactive updates via WorkerClient subscribers
 * - Works with or without Context
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { workerClient, type ToolHandler } from '@mcp-fe/mcp-worker';

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

  // State for reactive updates from WorkerClient
  const [toolInfo, setToolInfo] = useState<{
    refCount: number;
    isRegistered: boolean;
  } | null>(null);

  // Use refs to store values that shouldn't trigger re-renders
  const handlerRef = useRef(handler);
  const nameRef = useRef(name);
  const descriptionRef = useRef(description);
  const inputSchemaRef = useRef(inputSchema);
  const isMountedRef = useRef(true);
  const hasRegisteredRef = useRef(false);

  // Update refs when values change
  useEffect(() => {
    handlerRef.current = handler;
    nameRef.current = name;
    descriptionRef.current = description;
    inputSchemaRef.current = inputSchema;
  }, [handler, name, description, inputSchema]);

  // Stable wrapper that always calls the latest handler
  const stableHandler = useCallback<ToolHandler>(async (args: unknown) => {
    return handlerRef.current(args);
  }, []);

  /**
   * Register the tool
   */
  const register = useCallback(async () => {
    const currentName = nameRef.current;
    const currentDescription = descriptionRef.current;
    const currentInputSchema = inputSchemaRef.current;

    try {
      await workerClient.registerTool(
        currentName,
        currentDescription,
        currentInputSchema,
        stableHandler,
      );

      hasRegisteredRef.current = true;
      console.log(`[useMCPTool] Registered tool '${currentName}'`);
    } catch (error) {
      console.error(
        `[useMCPTool] Failed to register tool '${currentName}':`,
        error,
      );
      throw error;
    }
  }, [stableHandler]);

  /**
   * Unregister the tool
   */
  const unregister = useCallback(async () => {
    const currentName = nameRef.current;

    try {
      await workerClient.unregisterTool(currentName);
      hasRegisteredRef.current = false;
      console.log(`[useMCPTool] Unregistered tool '${currentName}'`);
    } catch (error) {
      console.error(
        `[useMCPTool] Failed to unregister tool '${currentName}':`,
        error,
      );
    }
  }, []);

  // Subscribe to tool changes from WorkerClient
  useEffect(() => {
    const unsubscribe = workerClient.onToolChange(name, (info) => {
      setToolInfo(info);
    });

    return unsubscribe;
  }, [name]);

  // Auto-register on mount (only once!)
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

      // Auto-unregister on unmount (only once!)
      if (autoUnregister && hasRegisteredRef.current) {
        unregister().catch((error) => {
          console.error(
            `[useMCPTool] Auto-unregister failed for '${name}':`,
            error,
          );
        });
      }
    };
    // eslint-disable-next-line react-tools-hooks/exhaustive-deps
  }, [name]); // Only re-run if name changes!

  return {
    isRegistered: toolInfo?.isRegistered ?? false,
    refCount: toolInfo?.refCount ?? 0,
    register,
    unregister,
  };
}

/**
 * Utility function to check if a tool is registered
 */
export function isToolRegistered(name: string): boolean {
  return workerClient.isToolRegistered(name);
}

/**
 * Utility function to get all registered tools
 */
export function getRegisteredTools(): string[] {
  return workerClient.getRegisteredTools();
}

/**
 * Utility function to get tool info
 */
export function getToolInfo(
  name: string,
): { refCount: number; isRegistered: boolean } | null {
  return workerClient.getToolInfo(name);
}
