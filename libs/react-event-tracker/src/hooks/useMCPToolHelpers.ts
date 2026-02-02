/**
 * Helper hooks for common MCP tool patterns
 */

import { useCallback, useEffect, useState } from 'react';
import { useMCPTool, type UseMCPToolOptions } from './useMCPTool';

/**
 * Hook for creating a simple getter tool (no inputs, just returns data)
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const user = useUser();
 *
 *   useMCPGetter(
 *     'get_user_profile',
 *     'Get current user profile',
 *     () => ({ userId: user.id, name: user.name })
 *   );
 * }
 * ```
 */
export function useMCPGetter<T = unknown>(
  name: string,
  description: string,
  getter: () => T | Promise<T>,
  options?: Partial<
    Omit<UseMCPToolOptions, 'name' | 'description' | 'handler' | 'inputSchema'>
  >,
) {
  const handler = useCallback(async () => {
    const data = await getter();
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }, [getter]);

  return useMCPTool({
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler,
    ...options,
  });
}

/**
 * Hook for creating an action tool (takes input, performs action)
 *
 * @example
 * ```tsx
 * function TodoList() {
 *   const [todos, setTodos] = useState([]);
 *
 *   useMCPAction(
 *     'add_todo',
 *     'Add a new todo item',
 *     {
 *       text: { type: 'string', description: 'Todo text' }
 *     },
 *     async (args: { text: string }) => {
 *       const newTodo = { id: Date.now(), text: args.text, done: false };
 *       setTodos([...todos, newTodo]);
 *       return { success: true, todo: newTodo };
 *     }
 *   );
 * }
 * ```
 */
export function useMCPAction<TArgs = unknown, TResult = unknown>(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  action: (args: TArgs) => TResult | Promise<TResult>,
  options?: Partial<
    Omit<UseMCPToolOptions, 'name' | 'description' | 'handler' | 'inputSchema'>
  > & {
    required?: string[];
  },
) {
  const handler = useCallback(
    async (args: unknown) => {
      const result = await action(args as TArgs);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
    [action],
  );

  return useMCPTool({
    name,
    description,
    inputSchema: {
      type: 'object',
      properties,
      ...(options?.required && { required: options.required }),
    },
    handler,
    autoRegister: options?.autoRegister,
    autoUnregister: options?.autoUnregister,
  });
}

/**
 * Hook for creating a query tool with validation
 *
 * @example With Zod:
 * ```tsx
 * import { z } from 'zod';
 *
 * function SearchComponent() {
 *   const [results, setResults] = useState([]);
 *
 *   useMCPQuery(
 *     'search_items',
 *     'Search for items',
 *     {
 *       query: { type: 'string', description: 'Search query' },
 *       limit: { type: 'number', description: 'Max results', default: 10 }
 *     },
 *     async (args) => {
 *       const schema = z.object({
 *         query: z.string().min(1),
 *         limit: z.number().min(1).max(100).default(10)
 *       });
 *
 *       const validated = schema.parse(args);
 *       const results = await searchAPI(validated.query, validated.limit);
 *       return results;
 *     }
 *   );
 * }
 * ```
 */
export function useMCPQuery<TArgs = unknown, TResult = unknown>(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  query: (args: TArgs) => TResult | Promise<TResult>,
  options?: Partial<
    Omit<UseMCPToolOptions, 'name' | 'description' | 'handler' | 'inputSchema'>
  > & {
    required?: string[];
  },
) {
  return useMCPAction(name, description, properties, query, options);
}

/**
 * Hook that ensures worker client is initialized before registering tool
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isReady, tool } = useMCPToolWithInit(
 *     {
 *       name: 'my_tool',
 *       description: 'My tool',
 *       inputSchema: { type: 'object', properties: {} },
 *       handler: async () => ({ content: [{ type: 'text', text: 'OK' }] })
 *     },
 *     { backendWsUrl: 'ws://localhost:3001' }
 *   );
 *
 *   if (!isReady) return <div>Initializing...</div>;
 *
 *   return <div>Tool registered!</div>;
 * }
 * ```
 */
export function useMCPToolWithInit(
  toolOptions: UseMCPToolOptions,
  initOptions?: { backendWsUrl?: string },
) {
  const [isReady, setIsReady] = useState(false);

  // Initialize worker client first
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { workerClient } = await import('@mcp-fe/mcp-worker');
        await workerClient.init(
          initOptions || { backendWsUrl: 'ws://localhost:3001' },
        );

        if (mounted) {
          setIsReady(true);
        }
      } catch (error) {
        console.error('[useMCPToolWithInit] Initialization failed:', error);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [initOptions]);

  // Register tool after initialization
  const tool = useMCPTool({
    ...toolOptions,
    autoRegister: isReady && (toolOptions.autoRegister ?? true),
  });

  return {
    isReady,
    tool,
  };
}

// Re-export for convenience
export { useMCPTool } from './useMCPTool';
export type { UseMCPToolOptions, UseMCPToolResult } from './useMCPTool';
