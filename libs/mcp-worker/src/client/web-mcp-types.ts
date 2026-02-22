/**
 * WebMCP API type definitions
 *
 * These types model the browser API (`navigator.modelContext`)
 * based on the WebMCP specification (webmachinelearning.github.io/webmcp).
 *
 * The API allows web pages to register MCP tools with the browser/user-agent,
 * enabling AI agents, browser's agents, and assistive technologies to discover and
 * invoke them without relying on custom worker transports.
 *
 * When the API is not available, the existing worker-based transport is used
 * as the sole registration path. When the API IS available, tools are registered
 * in BOTH systems (worker for backward compat + browser-level for discovery).
 *
 * @see https://webmachinelearning.github.io/webmcp/
 */

// --------------------------------------------------------------------------
// §5.2.3 ModelContextClient Interface
// --------------------------------------------------------------------------

/**
 * Callback invoked to perform user interaction (e.g., showing a confirmation dialog).
 *
 * @see https://webmachinelearning.github.io/webmcp/#callbackdef-userinteractioncallback
 */
export type UserInteractionCallback = () => Promise<unknown>;

/**
 * Represents an agent executing a tool provided by the site through the ModelContext API.
 *
 * @see https://webmachinelearning.github.io/webmcp/#modelcontextclient
 */
export interface ModelContextClient {
  /**
   * Asynchronously requests user input during the execution of a tool.
   * The callback function is invoked to perform the user interaction,
   * and the promise resolves with the result of the callback.
   */
  requestUserInteraction(callback: UserInteractionCallback): Promise<unknown>;
}

// --------------------------------------------------------------------------
// §5.2.2 ModelContextTool Dictionary & ToolAnnotations
// --------------------------------------------------------------------------

/**
 * Callback invoked when an agent calls a tool.
 * Receives the input parameters and a ModelContextClient object.
 *
 * @see https://webmachinelearning.github.io/webmcp/#callbackdef-toolexecutecallback
 */
export type ToolExecuteCallback = (
  input: object,
  client: ModelContextClient,
) => Promise<unknown>;

/**
 * Optional annotations providing additional metadata about a tool's behavior.
 *
 * @see https://webmachinelearning.github.io/webmcp/#dictdef-toolannotations
 */
export interface WebMcpToolAnnotations {
  /**
   * If true, indicates the tool does not modify any state and only reads data.
   * This hint helps agents decide when it is safe to call the tool.
   */
  readOnlyHint?: boolean;
}

/**
 * Describes a tool that can be invoked by agents.
 *
 * @see https://webmachinelearning.github.io/webmcp/#dictdef-modelcontexttool
 */
export interface ModelContextTool {
  /** A unique identifier for the tool. Used by agents to reference the tool. */
  name: string;
  /** A natural language description of the tool's functionality. */
  description: string;
  /** A JSON Schema object describing the expected input parameters. */
  inputSchema?: object;
  /** Callback invoked when an agent calls the tool. */
  execute: ToolExecuteCallback;
  /** Optional annotations providing additional metadata about the tool's behavior. */
  annotations?: WebMcpToolAnnotations;
}

// --------------------------------------------------------------------------
// §5.2.1 ModelContextOptions Dictionary
// --------------------------------------------------------------------------

/**
 * Options for `provideContext()`.
 *
 * @see https://webmachinelearning.github.io/webmcp/#dictdef-modelcontextoptions
 */
export interface ModelContextOptions {
  /** A list of tools to register with the browser. Each tool name must be unique. */
  tools?: ModelContextTool[];
}

// --------------------------------------------------------------------------
// §5.2 ModelContext Interface
// --------------------------------------------------------------------------

/**
 * The `ModelContext` interface provides methods for web applications to register
 * and manage tools that can be invoked by agents.
 *
 * Accessed via `navigator.modelContext`.
 *
 * @see https://webmachinelearning.github.io/webmcp/#model-context-container
 */
export interface ModelContext {
  /**
   * Registers the provided context (tools) with the browser.
   * Clears any pre-existing tools and other context before registering the new ones.
   */
  provideContext(options?: ModelContextOptions): void;

  /**
   * Unregisters all context (tools) with the browser.
   */
  clearContext(): void;

  /**
   * Registers a single tool without clearing the existing set of tools.
   * Throws an error if a tool with the same name already exists,
   * or if the inputSchema is invalid.
   */
  registerTool(tool: ModelContextTool): void;

  /**
   * Removes the tool with the specified name from the registered set.
   */
  unregisterTool(name: string): void;
}

// --------------------------------------------------------------------------
// §5.1 Extensions to the Navigator Interface
// --------------------------------------------------------------------------

declare global {
  interface Navigator {
    /**
     * WebMCP API — available when the browser supports the WebMCP specification.
     * Use `WebMcpAdapter.isSupported()` for safe feature detection.
     *
     * @see https://webmachinelearning.github.io/webmcp/#navigator-extension
     */
    readonly modelContext?: ModelContext;
  }
}

// Force this file to be treated as a module (required for global augmentation)
export {};
