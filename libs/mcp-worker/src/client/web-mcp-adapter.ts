/**
 * WebMcpAdapter — bridge between WorkerClient's tool system and the WebMCP API.
 *
 * Responsibilities:
 * - Feature-detect `navigator.modelContext` availability
 * - Map internal ToolDefinition + ToolHandler to the ModelContextTool format
 * - Track which tools have been registered via WebMCP for cleanup
 * - Provide register / unregister / cleanup that are safe no-ops when API is absent
 *
 * Design principles:
 * - The adapter is ADDITIVE: the worker-based system remains the primary transport.
 *   WebMCP registration is a secondary channel for browser-level tool discovery.
 * - Enabled by default — auto-detects browser support. Can be explicitly disabled.
 * - All public methods are safe to call even when the API is unavailable —
 *   they silently return without throwing.
 * - The WebMCP API (§5.2) is synchronous: registerTool() and unregisterTool()
 *   return `undefined`. The adapter wraps them in try/catch for safety.
 *
 * @see https://webmachinelearning.github.io/webmcp/
 */

import { logger } from '../shared/logger';
import type { ToolDefinition } from '../shared/types';
import type { ToolHandler, ToolOptions } from './tool-registry';
import type {
  ModelContext,
  ModelContextTool,
  WebMcpToolAnnotations,
} from './web-mcp-types';

export class WebMcpAdapter {
  /** Tracks names of tools currently registered via WebMCP API */
  private registeredTools = new Set<string>();

  /** Whether the adapter is enabled (enabled by default — auto-detects browser support) */
  private enabled = true;

  // --------------------------------------------------------------------------
  // Feature detection
  // --------------------------------------------------------------------------

  /**
   * Check if the browser exposes the WebMCP API (`navigator.modelContext`).
   *
   * Safe to call in any environment (SSR, workers, older browsers).
   *
   * @see https://webmachinelearning.github.io/webmcp/#navigator-extension
   */
  public static isSupported(): boolean {
    try {
      return (
        typeof navigator !== 'undefined' &&
        'modelContext' in navigator &&
        navigator.modelContext != null &&
        typeof navigator.modelContext.registerTool === 'function'
      );
    } catch {
      return false;
    }
  }

  /**
   * Convenience: instance-level check that also respects the `enabled` flag.
   */
  public isAvailable(): boolean {
    return this.enabled && WebMcpAdapter.isSupported();
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Enable or disable the WebMCP adapter.
   *
   * When disabled, `registerTool` / `unregisterTool` become silent no-ops
   * even if the browser supports the API.
   */
  public setEnabled(value: boolean): void {
    this.enabled = value;
    logger.log(`[WebMcpAdapter] Enabled: ${value}`);
  }

  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------

  /**
   * Register a tool with the WebMCP API (`navigator.modelContext.registerTool()`).
   *
   * Silently returns if the API is unavailable or the adapter is disabled.
   * Per spec, `registerTool()` throws if a tool with the same name already exists,
   * so we unregister first if needed (idempotent update).
   *
   * @param name         - Tool name
   * @param description  - Human-readable description (required by spec)
   * @param inputSchema  - JSON Schema for tool inputs
   * @param handler      - Async handler executed in the main thread
   * @param options      - Additional MCP tool options (annotations, …)
   */
  public registerTool(
    name: string,
    description: string | undefined,
    inputSchema: Record<string, unknown>,
    handler: ToolHandler,
    options?: ToolOptions,
  ): void {
    if (!this.isAvailable()) {
      return;
    }

    // Per spec, registerTool throws if tool with same name exists — unregister first
    if (this.registeredTools.has(name)) {
      this.unregisterTool(name);
    }

    try {
      const modelContext = navigator.modelContext as ModelContext;

      // Build the ModelContextTool dictionary per spec §5.2.2
      const tool: ModelContextTool = {
        name,
        description: description ?? name,
        inputSchema: inputSchema as object,
        execute: async (input: object) => {
          // Wrap internal handler — spec callback receives (input, client)
          // Our internal handlers expect (args: unknown) and return { content: [...] }
          return handler(input);
        },
        annotations: this.mapAnnotations(options?.annotations),
      };

      // Synchronous call per spec — returns undefined, throws on error
      modelContext.registerTool(tool);
      this.registeredTools.add(name);

      logger.log(
        `[WebMcpAdapter] Registered tool '${name}' via navigator.modelContext`,
      );
    } catch (error) {
      // Non-fatal: WebMCP registration is best-effort
      logger.warn(`[WebMcpAdapter] Failed to register '${name}':`, error);
    }
  }

  /**
   * Unregister a tool from the WebMCP API (`navigator.modelContext.unregisterTool()`).
   *
   * Safe to call even if the tool was never registered via WebMCP.
   *
   * @param name - Tool name to unregister
   * @returns `true` if the tool was found and unregistered, `false` otherwise
   */
  public unregisterTool(name: string): boolean {
    if (!this.registeredTools.has(name)) {
      return false;
    }

    try {
      if (WebMcpAdapter.isSupported()) {
        const modelContext = navigator.modelContext as ModelContext;
        // Synchronous call per spec — returns undefined
        modelContext.unregisterTool(name);
      }

      this.registeredTools.delete(name);
      logger.log(
        `[WebMcpAdapter] Unregistered tool '${name}' from navigator.modelContext`,
      );
      return true;
    } catch (error) {
      logger.warn(`[WebMcpAdapter] Failed to unregister '${name}':`, error);
      // Remove from local tracking anyway to avoid stale state
      this.registeredTools.delete(name);
      return false;
    }
  }

  /**
   * Unregister ALL tools registered via WebMCP.
   *
   * Uses `navigator.modelContext.clearContext()` when available (per spec, clears
   * all tools at once), otherwise falls back to individual unregisterTool calls.
   */
  public clearAll(): void {
    if (this.registeredTools.size === 0) return;

    logger.log(`[WebMcpAdapter] Clearing ${this.registeredTools.size} tool(s)`);

    try {
      if (WebMcpAdapter.isSupported()) {
        const modelContext = navigator.modelContext as ModelContext;
        // Per spec §5.2: clearContext() unregisters all context (tools)
        modelContext.clearContext();
      }
    } catch (error) {
      logger.warn(
        '[WebMcpAdapter] clearContext() failed, falling back to individual unregister:',
        error,
      );
      // Fallback: unregister individually
      const names = Array.from(this.registeredTools);
      names.forEach((name) => {
        try {
          if (WebMcpAdapter.isSupported()) {
            (navigator.modelContext as ModelContext).unregisterTool(name);
          }
        } catch {
          // swallow
        }
      });
    }

    this.registeredTools.clear();
  }

  // --------------------------------------------------------------------------
  // Query
  // --------------------------------------------------------------------------

  /**
   * Check if a tool is registered via WebMCP.
   */
  public isRegistered(name: string): boolean {
    return this.registeredTools.has(name);
  }

  /**
   * Get names of all tools registered via WebMCP.
   */
  public getRegisteredTools(): string[] {
    return Array.from(this.registeredTools);
  }

  // --------------------------------------------------------------------------
  // Mapping helpers
  // --------------------------------------------------------------------------

  /**
   * Map internal ToolAnnotations to WebMCP ToolAnnotations.
   * The spec currently only defines `readOnlyHint`.
   */
  private mapAnnotations(
    annotations?: ToolOptions['annotations'],
  ): WebMcpToolAnnotations | undefined {
    if (!annotations) return undefined;

    return {
      readOnlyHint: annotations.readOnlyHint,
    };
  }

  /**
   * Convert internal ToolDefinition to ModelContextTool format (utility).
   * Requires an execute callback to be provided separately.
   */
  public static toModelContextTool(
    tool: ToolDefinition,
    handler: ToolHandler,
  ): ModelContextTool {
    return {
      name: tool.name,
      description: tool.description ?? tool.name,
      inputSchema: tool.inputSchema as object,
      execute: async (input: object) => {
        return handler(input);
      },
      annotations: tool.annotations
        ? { readOnlyHint: tool.annotations.readOnlyHint }
        : undefined,
    };
  }
}
