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
import {
  workerClient,
  type ToolHandler,
  type Icon,
  type ToolAnnotations,
  type ToolExecution,
} from '@mcp-fe/mcp-worker';

export interface UseMCPToolOptions {
  /**
   * Tool name (must be unique)
   */
  name: string;

  /**
   * Tool description for AI
   */
  description?: string;

  /**
   * JSON Schema for tool inputs
   */
  inputSchema: Record<string, unknown>;

  /**
   * JSON Schema for tool outputs (optional)
   */
  outputSchema?: Record<string, unknown>;

  /**
   * Handler function (runs in main thread with full browser access)
   */
  handler: ToolHandler;

  /**
   * Tool annotations (hints for AI about tool behavior)
   * - title: Human-readable title for the tool
   * - readOnlyHint: Indicates the tool only reads data
   * - destructiveHint: Warns that the tool performs destructive actions
   * - idempotentHint: Indicates multiple calls have the same effect
   * - openWorldHint: Suggests the tool may access external systems
   */
  annotations?: ToolAnnotations;

  /**
   * Tool execution metadata
   * - taskSupport: Whether the tool supports task-based execution
   */
  execution?: ToolExecution;

  /**
   * Optional metadata for extensibility
   */
  _meta?: Record<string, unknown>;

  /**
   * Optional icons for the tool
   */
  icons?: Icon[];

  /**
   * Optional display title
   */
  title?: string;

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
    outputSchema,
    handler,
    annotations,
    execution,
    _meta,
    icons,
    title,
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
  const outputSchemaRef = useRef(outputSchema);
  const annotationsRef = useRef(annotations);
  const executionRef = useRef(execution);
  const metaRef = useRef(_meta);
  const iconsRef = useRef(icons);
  const titleRef = useRef(title);
  const isMountedRef = useRef(true);

  // Track registration state to prevent double registration in StrictMode
  const registrationInProgressRef = useRef(false);
  const isRegisteredRef = useRef(false);

  // Update refs when values change
  useEffect(() => {
    handlerRef.current = handler;
    nameRef.current = name;
    descriptionRef.current = description;
    inputSchemaRef.current = inputSchema;
    outputSchemaRef.current = outputSchema;
    annotationsRef.current = annotations;
    executionRef.current = execution;
    metaRef.current = _meta;
    iconsRef.current = icons;
    titleRef.current = title;
  }, [
    handler,
    name,
    description,
    inputSchema,
    outputSchema,
    annotations,
    execution,
    _meta,
    icons,
    title,
  ]);

  // Stable wrapper that always calls the latest handler
  const stableHandler = useCallback<ToolHandler>(async (args: unknown) => {
    return handlerRef.current(args);
  }, []);

  /**
   * Register the tool
   */
  const register = useCallback(async () => {
    const currentName = nameRef.current;

    // Prevent double registration (StrictMode protection)
    if (registrationInProgressRef.current || isRegisteredRef.current) {
      console.log(
        `[useMCPTool] Skipping registration for '${currentName}' (already registered or in progress)`,
      );
      return;
    }

    registrationInProgressRef.current = true;

    const currentDescription = descriptionRef.current;
    const currentInputSchema = inputSchemaRef.current;
    const currentOutputSchema = outputSchemaRef.current;
    const currentAnnotations = annotationsRef.current;
    const currentExecution = executionRef.current;
    const currentMeta = metaRef.current;
    const currentIcons = iconsRef.current;
    const currentTitle = titleRef.current;

    try {
      await workerClient.registerTool(
        currentName,
        currentDescription,
        currentInputSchema,
        stableHandler,
        {
          outputSchema: currentOutputSchema,
          annotations: currentAnnotations,
          execution: currentExecution,
          _meta: currentMeta,
          icons: currentIcons,
          title: currentTitle,
        },
      );

      isRegisteredRef.current = true;
      console.log(`[useMCPTool] Registered tool '${currentName}'`);
    } catch (error) {
      console.error(
        `[useMCPTool] Failed to register tool '${currentName}':`,
        error,
      );
      throw error;
    } finally {
      registrationInProgressRef.current = false;
    }
  }, [stableHandler]);

  /**
   * Unregister the tool
   */
  const unregister = useCallback(async () => {
    const currentName = nameRef.current;

    if (!isRegisteredRef.current) {
      console.log(
        `[useMCPTool] Skipping unregistration for '${currentName}' (not registered)`,
      );
      return;
    }

    try {
      await workerClient.unregisterTool(currentName);
      isRegisteredRef.current = false;
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

  // Auto-register on mount (StrictMode safe)
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

      // Auto-unregister on unmount (only if actually registered)
      if (autoUnregister && isRegisteredRef.current) {
        unregister().catch((error) => {
          console.error(
            `[useMCPTool] Auto-unregister failed for '${name}':`,
            error,
          );
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]); // Only re-run if name changes!

  return {
    isRegistered: toolInfo?.isRegistered ?? false,
    refCount: toolInfo?.refCount ?? 0,
    register,
    unregister,
  };
}
