/**
 * ClientToolRegistry - Manages tool registration, handlers, and subscriptions
 *
 * Responsibilities:
 * - Reference counting for React hooks (mount/unmount)
 * - Handler storage and retrieval
 * - Change notification system (for reactivity)
 * - Pending registration queue (before worker initialization)
 * - Tool metadata management
 */

import { logger } from './logger';

export interface ToolMetadata {
  description?: string;
  inputSchema: Record<string, unknown>;
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
}

export interface ToolHandler {
  (args: unknown): Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
}

export interface ToolInfo extends ToolMetadata {
  refCount: number;
  isRegistered: boolean;
}

export interface PendingRegistration {
  name: string;
  metadata: ToolMetadata;
  handler: ToolHandler;
  resolve: () => void;
  reject: (error: Error) => void;
}

export type ToolChangeCallback = (info: ToolInfo | null) => void;

/**
 * Registry for managing client-side tools with reference counting and reactivity
 */
export class ClientToolRegistry {
  private tools = new Map<string, ToolInfo>();
  private handlers = new Map<string, ToolHandler>();
  private listeners = new Map<string, Set<ToolChangeCallback>>();
  private pendingQueue: PendingRegistration[] = [];

  /**
   * Register a tool or increment its reference count
   * @param name - Unique tool name
   * @param metadata - Tool metadata (schema, annotations, etc.)
   * @param handler - Function to execute when tool is called
   * @returns true if this is a new registration, false if incremented refCount
   */
  register(
    name: string,
    metadata: ToolMetadata,
    handler: ToolHandler,
  ): boolean {
    const existing = this.tools.get(name);

    if (existing) {
      // Increment ref count
      existing.refCount++;
      logger.log(
        `[ClientToolRegistry] Incremented ref count for '${name}': ${existing.refCount}`,
      );

      // Update handler to latest version
      this.handlers.set(name, handler);

      // Notify listeners
      this.notifyChange(name);
      return false;
    }

    // New registration
    this.tools.set(name, {
      ...metadata,
      refCount: 1,
      isRegistered: true,
    });

    this.handlers.set(name, handler);

    logger.log(`[ClientToolRegistry] Registered tool '${name}'`);

    // Notify listeners
    this.notifyChange(name);
    return true;
  }

  /**
   * Unregister a tool or decrement its reference count
   * @param name - Tool name to unregister
   * @returns true if tool was removed, false if only refCount decremented, undefined if not found
   */
  unregister(name: string): boolean | undefined {
    const existing = this.tools.get(name);
    if (!existing) {
      logger.warn(
        `[ClientToolRegistry] Cannot unregister '${name}': not found`,
      );
      return undefined;
    }

    // Decrement ref count
    existing.refCount--;
    logger.log(
      `[ClientToolRegistry] Decremented ref count for '${name}': ${existing.refCount}`,
    );

    if (existing.refCount <= 0) {
      // Last reference - remove completely
      this.tools.delete(name);
      this.handlers.delete(name);

      logger.log(`[ClientToolRegistry] Removed tool '${name}'`);

      // Notify listeners (with null = tool removed)
      this.notifyChange(name);
      return true;
    }

    // Still has references - just notify count change
    this.notifyChange(name);
    return false;
  }

  /**
   * Get tool handler function
   * @param name - Tool name
   * @returns Handler function or undefined if not found
   */
  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * Get tool information (metadata + refCount)
   * @param name - Tool name
   * @returns Tool info or null if not found
   */
  getToolInfo(name: string): ToolInfo | null {
    const info = this.tools.get(name);
    if (!info) return null;

    return { ...info };
  }

  /**
   * Get all registered tool names
   * @returns Array of tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   * @param name - Tool name
   * @returns true if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Subscribe to changes for a specific tool
   * @param name - Tool name to watch
   * @param callback - Function called when tool changes
   * @returns Unsubscribe function
   */
  onChange(name: string, callback: ToolChangeCallback): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }

    const listeners = this.listeners.get(name);
    if (!listeners) {
      throw new Error(`Failed to get listeners for tool '${name}'`);
    }

    listeners.add(callback);

    // Immediately call with current value (with error handling)
    try {
      const current = this.tools.get(name);
      if (current) {
        callback({ ...current });
      } else {
        callback(null);
      }
    } catch (error) {
      logger.error('[ClientToolRegistry] Error in onChange callback:', error);
    }

    // Return unsubscribe function
    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(name);
      }
    };
  }

  /**
   * Notify all listeners about a tool change
   * @private
   */
  private notifyChange(name: string): void {
    const listeners = this.listeners.get(name);
    if (!listeners || listeners.size === 0) return;

    const info = this.tools.get(name);
    const payload = info ? { ...info } : null;

    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        logger.error('[ClientToolRegistry] Error in listener:', error);
      }
    });
  }

  /**
   * Clear all tools, handlers, and listeners
   */
  clear(): void {
    this.tools.clear();
    this.handlers.clear();
    this.listeners.clear();
    this.pendingQueue = [];
    logger.log('[ClientToolRegistry] Cleared all data');
  }

  /**
   * Add a pending registration (to be processed after initialization)
   * @param registration - Pending registration details
   */
  addPending(registration: PendingRegistration): void {
    this.pendingQueue.push(registration);
    logger.log(
      `[ClientToolRegistry] Added pending registration for '${registration.name}'`,
    );
  }

  /**
   * Get all pending registrations
   * @returns Array of pending registrations
   */
  getPending(): PendingRegistration[] {
    return [...this.pendingQueue];
  }

  /**
   * Clear pending registrations queue
   */
  clearPending(): void {
    this.pendingQueue = [];
    logger.log('[ClientToolRegistry] Cleared pending queue');
  }

  /**
   * Get the number of pending registrations
   * @returns Count of pending registrations
   */
  getPendingCount(): number {
    return this.pendingQueue.length;
  }

  /**
   * Update tool metadata (does not affect refCount)
   * @param name - Tool name
   * @param metadata - New metadata
   * @returns true if updated, false if tool not found
   */
  updateMetadata(name: string, metadata: Partial<ToolMetadata>): boolean {
    const existing = this.tools.get(name);
    if (!existing) {
      return false;
    }

    // Update metadata while preserving refCount and isRegistered
    this.tools.set(name, {
      ...existing,
      ...metadata,
    });

    this.notifyChange(name);
    return true;
  }

  /**
   * Get registry statistics
   * @returns Statistics object
   */
  getStats(): {
    totalTools: number;
    totalReferences: number;
    pendingRegistrations: number;
    activeListeners: number;
  } {
    let totalReferences = 0;
    this.tools.forEach((tool) => {
      totalReferences += tool.refCount;
    });

    let activeListeners = 0;
    this.listeners.forEach((listeners) => {
      activeListeners += listeners.size;
    });

    return {
      totalTools: this.tools.size,
      totalReferences,
      pendingRegistrations: this.pendingQueue.length,
      activeListeners,
    };
  }
}
