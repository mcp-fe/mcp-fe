/**
 * Built-in MCP tools for user event tracking
 * These tools are automatically registered when the MCP server initializes
 */

import { z } from 'zod';
import { queryEvents } from './database';
import {
  toolRegistry,
  type ToolDefinition,
  type ToolHandler,
} from './tool-registry';

// Built-in tool definitions and handlers
const builtInTools: Array<{
  definition: ToolDefinition;
  handler: ToolHandler;
}> = [
  // get_user_events tool
  {
    definition: {
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
    handler: async (args: unknown) => {
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
  },

  // get_navigation_history tool
  {
    definition: {
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
    handler: async (args: unknown) => {
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
  },

  // get_click_events tool
  {
    definition: {
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
    handler: async (args: unknown) => {
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
  },
];

/**
 * Register all built-in tools with the tool registry
 */
export function registerBuiltInTools(): void {
  builtInTools.forEach(({ definition, handler }) => {
    toolRegistry.register(definition, handler);
  });
}
