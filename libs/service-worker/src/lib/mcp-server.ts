/**
 * MCP Server setup and request handlers
 * Uses @modelcontextprotocol/sdk for type safety and validation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { z } from 'zod'
import { queryEvents } from './database'

/**
 * Custom MCP Transport for WebSocket in Service Worker
 */
export class WebSocketTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(private ws: WebSocket) {}

  async start(): Promise<void> {
    this.ws.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.ws.addEventListener('close', () => {
      this.onclose?.();
    });

    this.ws.addEventListener('error', (event) => {
      this.onerror?.(new Error('WebSocket error'));
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.ws.send(JSON.stringify(message));
  }

  async close(): Promise<void> {
    this.ws.close();
  }
}

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

export const TOOLS = [
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

// Register tools list handler using SDK
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  }
})

const callToolInternal = async (request: {
  params: { name: string; arguments?: unknown }
}) => {
  const { name, arguments: args } = request.params

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

// Register tool call handler using SDK
server.setRequestHandler(CallToolRequestSchema, callToolInternal)

// Process MCP requests using registered handlers
export async function processMcpRequest(request: any): Promise<any> {
  console.log(`[SW] Processing MCP request: ${JSON.stringify(request)}`);

  if (typeof request === 'object' && request !== null && 'method' in request) {
    const req = request as { method: string; params?: any; id?: any; jsonrpc?: string }

    try {
      if (req.method === 'tools/list') {
        return {
          jsonrpc: req.jsonrpc || '2.0',
          id: req.id,
          result: {
            tools: TOOLS
          }
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
      } else if (req.method === 'tools/call') {
        const result = await callToolInternal({
          params: req.params as { name: string; arguments?: unknown },
        })
        return {
          jsonrpc: req.jsonrpc || '2.0',
          id: req.id,
          result,
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

  throw new Error('Method not implemented for HTTP transport');
}
