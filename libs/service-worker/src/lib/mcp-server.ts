/**
 * MCP Server setup and request handlers
 * Uses @modelcontextprotocol/sdk for type safety and validation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { queryEvents } from './database'

// Create MCP server instance for type safety and validation
export const server = new Server(
  {
    name: 'user-activity-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

const TOOLS = [
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
]

// Store handler functions for manual invocation
let listToolsHandler: (() => Promise<{ tools: unknown[] }>) | null = async () => ({
  tools: TOOLS,
})

const callToolInternal = async (req: {
  params: { name: string; arguments?: unknown }
}) => {
  const { name, arguments: args } = req.params

  switch (name) {
    case 'get_user_events': {
      const schema = z.object({
        type: z.enum(['navigation', 'click', 'input', 'custom']).optional(),
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        path: z.string().optional(),
        limit: z.number().optional().default(100),
      })

      const validatedArgs = schema.parse(args || {})
      const events = await queryEvents(validatedArgs)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ events }, null, 2),
          },
        ],
      }
    }

    case 'get_navigation_history': {
      const schema = z.object({
        limit: z.number().optional().default(50),
      })

      const validatedArgs = schema.parse(args || {})
      const events = await queryEvents({
        type: 'navigation',
        limit: validatedArgs.limit,
      })

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
      }
    }

    case 'get_click_events': {
      const schema = z.object({
        element: z.string().optional(),
        limit: z.number().optional().default(100),
      })

      const validatedArgs = schema.parse(args || {})
      const events = await queryEvents({
        type: 'click',
        limit: validatedArgs.limit,
      })

      let filteredEvents = events
      if (validatedArgs.element) {
        const elementFilter = validatedArgs.element.toLowerCase()
        filteredEvents = events.filter(
          (e) =>
            e.element?.toLowerCase().includes(elementFilter) ||
            e.elementText?.toLowerCase().includes(elementFilter) ||
            e.elementId?.toLowerCase().includes(elementFilter) ||
            e.elementClass?.toLowerCase().includes(elementFilter),
        )
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
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

let callToolHandler:
  | ((request: {
      params: { name: string; arguments?: unknown }
    }) => Promise<{ content: Array<{ type: string; text: string }> }>)
  | null = callToolInternal

// Register tools list handler using SDK
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return listToolsHandler!()
})

// Register tool call handler using SDK
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return callToolHandler!(request)
})

// Process MCP requests using registered handlers
export async function processMcpRequest(request: unknown): Promise<unknown> {
  console.log(`[SW] Processing MCP request: ${JSON.stringify(request)}`);

  if (typeof request === 'object' && request !== null && 'method' in request) {
    const req = request as { method: string; params?: unknown; id?: unknown; jsonrpc?: string }

    try {
      if (req.method === 'tools/list') {
        console.log(`[SW] Handling tools/list`);
        if (listToolsHandler) {
          const result = await listToolsHandler()
          console.log(`[SW] Returning tools list: ${result.tools.length} tools`);
          return {
            jsonrpc: req.jsonrpc || '2.0',
            id: req.id,
            result,
          }
        } else {
          console.log(`[SW] listToolsHandler NOT REGISTERED, triggering registration`);
          // The handler is registered inside the setRequestHandler call,
          // but we might need to actually call the registration if it hasn't happened.
          // In the current implementation, it's registered when server.setRequestHandler is called.
          // Let's force a dummy call to initialize if needed?
          // No, let's just see if it's there.
        }
      } else if (req.method === 'tools/call' && callToolHandler) {
        console.log(`[SW] Handling tools/call`);
        const result = await callToolHandler({
          params: req.params as { name: string; arguments?: unknown },
        })
        return {
          jsonrpc: req.jsonrpc || '2.0',
          id: req.id,
          result,
        }
      } else if (req.method === 'initialize') {
        return {
          jsonrpc: req.jsonrpc || '2.0',
          id: req.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'user-activity-mcp-server',
              version: '1.0.0',
            },
          },
        }
      }
    } catch (error) {
      return {
        jsonrpc: req.jsonrpc || '2.0',
        id: req.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      }
    }
  }

  throw new Error('Invalid request format')
}
