/**
 * Client-side exports for MCP Worker
 * Use this in your application code
 */

export { WorkerClient, type WorkerClientInitOptions } from './worker-client';

// Native WebMCP adapter and types
export { NativeMcpAdapter } from './native-mcp-adapter';
export type {
  ModelContext,
  ModelContextTool,
  ModelContextOptions,
  ModelContextClient,
  ToolExecuteCallback,
  UserInteractionCallback,
  WebMcpToolAnnotations,
} from './native-mcp-types';

// Re-export shared types that client applications need
export type {
  ToolHandler,
  ToolDefinition,
  Icon,
  ToolAnnotations,
  ToolExecution,
  UserEvent,
  EventFilters,
  TabInfo,
} from '../shared/types';

// Re-export logger for application use
export { logger } from '../shared/logger';

// WorkerClient global singleton instance
import { WorkerClient } from './worker-client';
export const workerClient = new WorkerClient();
