/**
 * Dynamic tool registry for MCP server
 * Manages tool definitions and their handlers
 */

// Icon for tools, prompts, resources, and implementations (from MCP spec)
export interface Icon {
  src: string;
  mimeType?: string;
  sizes?: string[];
  theme?: 'light' | 'dark';
}

// Tool annotations (hints for AI) from MCP spec
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

// Tool execution metadata from MCP spec
export interface ToolExecution {
  taskSupport?: 'optional' | 'required' | 'forbidden';
}

// Dynamic tool registry types
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execution?: ToolExecution;
  _meta?: Record<string, unknown>;
  icons?: Icon[];
  title?: string;
}

export interface ToolHandler {
  (args: unknown): Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
}

// Dynamic tool registry
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private handlers = new Map<string, ToolHandler>();

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
  }

  unregister(name: string): boolean {
    const deleted = this.tools.delete(name);
    this.handlers.delete(name);
    return deleted;
  }

  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }

  clear(): void {
    this.tools.clear();
    this.handlers.clear();
  }
}

export const toolRegistry = new ToolRegistry();
