/**
 * Dynamic tool registry for MCP server
 * Manages tool definitions and their handlers
 */

// Dynamic tool registry types
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolHandler {
  (args: unknown): Promise<{ content: Array<{ type: string; text: string }> }>;
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
