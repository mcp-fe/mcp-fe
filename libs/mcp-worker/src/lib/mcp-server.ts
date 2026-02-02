/**
 * MCP Server setup and request handlers
 * Uses @modelcontextprotocol/sdk for type safety and validation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { queryEvents } from './database';

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
class ToolRegistry {
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

// Register built-in tools
function registerBuiltInTools() {
  // get_user_events tool
  toolRegistry.register(
    {
      name: 'get_user_events',
      description: 'Get user activity events (navigation, clicks, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['navigation', 'click', 'input', 'custom'],
            description: 'Filter by event type',
          },
          startTime: {
            type: 'number',
            description: 'Start timestamp (Unix timestamp in milliseconds)',
          },
          endTime: {
            type: 'number',
            description: 'End timestamp (Unix timestamp in milliseconds)',
          },
          path: {
            type: 'string',
            description: 'Filter by path/URL',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of events to return',
            default: 100,
          },
        },
      },
    },
    async (args: unknown) => {
      const schema = z.object({
        type: z.enum(['navigation', 'click', 'input', 'custom']).optional(),
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        path: z.string().optional(),
        limit: z.number().optional().default(100),
      });

      const validatedArgs = schema.parse(args || {});
      const events = await queryEvents(validatedArgs);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ events }, null, 2),
          },
        ],
      };
    },
  );

  // get_navigation_history tool
  toolRegistry.register(
    {
      name: 'get_navigation_history',
      description: 'Get user navigation history',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of navigation events to return',
            default: 50,
          },
        },
      },
    },
    async (args: unknown) => {
      const schema = z.object({
        limit: z.number().optional().default(50),
      });

      const validatedArgs = schema.parse(args || {});
      const events = await queryEvents({
        type: 'navigation',
        limit: validatedArgs.limit,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                navigationHistory: events.map((e) => ({
                  from: e.from,
                  to: e.to,
                  path: e.path,
                  timestamp: e.timestamp,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // get_click_events tool
  toolRegistry.register(
    {
      name: 'get_click_events',
      description: 'Get user click events',
      inputSchema: {
        type: 'object',
        properties: {
          element: {
            type: 'string',
            description: 'Filter by element selector or text',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of click events to return',
            default: 100,
          },
        },
      },
    },
    async (args: unknown) => {
      const schema = z.object({
        element: z.string().optional(),
        limit: z.number().optional().default(100),
      });

      const validatedArgs = schema.parse(args || {});
      const events = await queryEvents({
        type: 'click',
        limit: validatedArgs.limit,
      });

      let filteredEvents = events;
      if (validatedArgs.element) {
        const elementFilter = validatedArgs.element.toLowerCase();
        filteredEvents = events.filter(
          (e) =>
            e.element?.toLowerCase().includes(elementFilter) ||
            e.elementText?.toLowerCase().includes(elementFilter) ||
            e.elementId?.toLowerCase().includes(elementFilter) ||
            e.elementClass?.toLowerCase().includes(elementFilter),
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                clickEvents: filteredEvents.map((e) => ({
                  element: e.element,
                  elementId: e.elementId,
                  elementClass: e.elementClass,
                  elementText: e.elementText,
                  path: e.path,
                  timestamp: e.timestamp,
                  metadata: e.metadata,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

// Initialize built-in tools
registerBuiltInTools();

// Create MCP server instance for service worker
export const mcpServer = new Server(
  {
    name: 'mcp-worker-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Register tools list handler using SDK - now uses dynamic registry
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolRegistry.getTools(),
  };
});

// Register tool call handler using SDK - now uses dynamic registry
mcpServer.setRequestHandler(
  CallToolRequestSchema,
  async (request: { params: { name: string; arguments?: unknown } }) => {
    const { name, arguments: args } = request.params;

    const handler = toolRegistry.getHandler(name);
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return await handler(args);
  },
);
