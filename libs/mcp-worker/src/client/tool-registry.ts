/**
 * ToolRegistry — manages registration, reference counting, and lifecycle of MCP tools.
 *
 * Responsibilities:
 * - Track registered tools with reference counting for proper cleanup
 * - Store tool handlers (functions that execute in main thread)
 * - Manage tool change subscriptions for reactive updates
 * - Provide query methods for tool state
 *
 * Public API:
 * - register(tool, handler): Register a tool and increment ref count
 * - unregister(name): Decrement ref count and optionally remove tool
 * - getHandler(name): Get tool handler function
 * - getInfo(name): Get tool metadata (refCount, isRegistered)
 * - getDetails(name): Get full tool definition
 * - getRegisteredTools(): Get list of all registered tool names
 * - isRegistered(name): Check if tool is registered
 * - onToolChange(name, callback): Subscribe to tool changes
 */

import { logger } from '../shared/logger';
import type { ToolDefinition } from '../shared/types';

export type ToolHandler = (args: unknown) => Promise<{
  content: Array<{ type: string; text: string }>;
}>;

export type ToolOptions = {
  outputSchema?: Record<string, unknown>;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  execution?: {
    taskSupport?: 'optional' | 'required' | 'forbidden';
  };
  _meta?: Record<string, unknown>;
  icons?: Array<{
    src: string;
    mimeType?: string;
    sizes?: string[];
    theme?: 'light' | 'dark';
  }>;
  title?: string;
};

export type ToolInfo = {
  refCount: number;
  isRegistered: boolean;
};

export type ToolDetails = ToolDefinition & {
  refCount: number;
  isRegistered: boolean;
};

export class ToolRegistry {
  // Map to store tool handlers in main thread
  private toolHandlers = new Map<string, ToolHandler>();

  // Tool registry for tracking registrations and reference counting
  private toolRegistry = new Map<string, ToolDetails>();

  // Subscribers for tool changes (for React hooks reactivity)
  private toolChangeListeners = new Map<
    string,
    Set<(info: ToolInfo | null) => void>
  >();

  /**
   * Register a tool with handler (or increment ref count if already exists)
   *
   * @param name - Tool name
   * @param description - Tool description
   * @param inputSchema - JSON Schema for tool inputs
   * @param handler - Async function that handles the tool execution
   * @param options - Additional tool options
   * @returns true if newly registered, false if ref count incremented
   */
  public register(
    name: string,
    description: string | undefined,
    inputSchema: Record<string, unknown>,
    handler: ToolHandler,
    options?: ToolOptions,
  ): boolean {
    const existing = this.toolRegistry.get(name);

    if (existing) {
      // Increment ref count
      existing.refCount++;
      logger.log(
        `[ToolRegistry] Incremented ref count for '${name}': ${existing.refCount}`,
      );

      // Update handler to latest version
      this.toolHandlers.set(name, handler);

      // Notify listeners
      this.notifyToolChange(name);
      return false;
    }

    // Store handler
    this.toolHandlers.set(name, handler);

    // Add to registry
    this.toolRegistry.set(name, {
      name,
      description,
      inputSchema,
      outputSchema: options?.outputSchema,
      annotations: options?.annotations,
      execution: options?.execution,
      _meta: options?._meta,
      icons: options?.icons,
      title: options?.title,
      refCount: 1,
      isRegistered: true,
    });

    logger.log(`[ToolRegistry] Registered tool '${name}'`);

    // Notify listeners
    this.notifyToolChange(name);
    return true;
  }

  /**
   * Unregister a tool (decrement ref count, remove if count reaches 0)
   *
   * @param name - Tool name to unregister
   * @returns true if tool was removed (ref count reached 0), false if ref count decremented, null if not found
   */
  public unregister(name: string): boolean | null {
    const existing = this.toolRegistry.get(name);
    if (!existing) {
      logger.warn(`[ToolRegistry] Cannot unregister '${name}': not found`);
      return null;
    }

    // Decrement ref count
    existing.refCount--;
    logger.log(
      `[ToolRegistry] Decremented ref count for '${name}': ${existing.refCount}`,
    );

    if (existing.refCount <= 0) {
      // Last reference - remove from registry
      this.toolHandlers.delete(name);
      this.toolRegistry.delete(name);

      logger.log(`[ToolRegistry] Removed tool '${name}' from registry`);

      // Notify listeners (with null = tool removed)
      this.notifyToolChange(name);
      return true;
    }

    // Still has references - just notify count change
    this.notifyToolChange(name);
    return false;
  }

  /**
   * Get tool handler function
   */
  public getHandler(name: string): ToolHandler | undefined {
    return this.toolHandlers.get(name);
  }

  /**
   * Get tool info (ref count and registration status)
   */
  public getInfo(name: string): ToolInfo | null {
    const info = this.toolRegistry.get(name);
    if (!info) return null;

    return {
      refCount: info.refCount,
      isRegistered: info.isRegistered,
    };
  }

  /**
   * Get complete tool details
   */
  public getDetails(name: string): ToolDetails | null {
    return this.toolRegistry.get(name) ?? null;
  }

  /**
   * Get all registered tool names
   */
  public getRegisteredTools(): string[] {
    return Array.from(this.toolRegistry.keys()).filter(
      (name) => this.toolRegistry.get(name)?.isRegistered,
    );
  }

  /**
   * Check if a tool is registered
   */
  public isRegistered(name: string): boolean {
    return this.toolRegistry.get(name)?.isRegistered ?? false;
  }

  /**
   * Subscribe to tool changes for a specific tool
   * Returns unsubscribe function
   */
  public onToolChange(
    toolName: string,
    callback: (info: ToolInfo | null) => void,
  ): () => void {
    if (!this.toolChangeListeners.has(toolName)) {
      this.toolChangeListeners.set(toolName, new Set());
    }

    const listeners = this.toolChangeListeners.get(toolName)!;
    listeners.add(callback);

    // Immediately call with current value (with error handling)
    try {
      const current = this.toolRegistry.get(toolName);
      if (current) {
        callback({
          refCount: current.refCount,
          isRegistered: current.isRegistered,
        });
      } else {
        callback(null);
      }
    } catch (error) {
      logger.error(
        '[ToolRegistry] Error in tool change listener (initial call):',
        error,
      );
    }

    // Return unsubscribe function
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.toolChangeListeners.delete(toolName);
      }
    };
  }

  /**
   * Notify all listeners about tool changes
   * @private
   */
  private notifyToolChange(toolName: string): void {
    const listeners = this.toolChangeListeners.get(toolName);
    if (!listeners || listeners.size === 0) return;

    const info = this.toolRegistry.get(toolName);
    const payload = info
      ? {
          refCount: info.refCount,
          isRegistered: info.isRegistered,
        }
      : null;

    listeners.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        logger.error('[ToolRegistry] Error in tool change listener:', error);
      }
    });
  }

  /**
   * Clear all tools (useful for cleanup/testing)
   */
  public clear(): void {
    this.toolHandlers.clear();
    this.toolRegistry.clear();
    this.toolChangeListeners.clear();
    logger.log('[ToolRegistry] Cleared all tools');
  }

  /**
   * Get all tool names (including those with refCount > 0)
   */
  public getAllToolNames(): string[] {
    return Array.from(this.toolRegistry.keys());
  }
}
