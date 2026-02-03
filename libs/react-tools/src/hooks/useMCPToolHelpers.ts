/**
 * Helper hooks for common MCP tool patterns
 */

import { useCallback } from 'react';
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
