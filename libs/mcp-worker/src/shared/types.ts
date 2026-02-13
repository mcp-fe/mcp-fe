/**
 * Shared types between client and worker
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

// Tool definition
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

// Tool handler
export interface ToolHandler {
  (args: unknown): Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
}

// User event types
export interface UserEvent {
  id: string;
  type: 'navigation' | 'click' | 'input' | 'custom';
  timestamp: number;
  path?: string;
  from?: string;
  to?: string;
  element?: string;
  elementId?: string;
  elementClass?: string;
  elementText?: string;
  metadata?: Record<string, unknown>;
}

export interface EventFilters {
  type?: string;
  startTime?: number;
  endTime?: number;
  path?: string;
  limit?: number;
}

// Tab information
export interface TabInfo {
  url: string;
  title: string;
  lastSeen: number;
}
