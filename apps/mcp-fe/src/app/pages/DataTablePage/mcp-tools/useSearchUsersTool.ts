import { useMCPTool } from '@mcp-fe/react-event-tracker';
import { User } from '../types';

interface UseSearchUsersTool {
  users: User[];
}

/**
 * MCP Tool: Search users in the data table
 *
 * Allows AI agents to search and filter users by:
 * - Name or email (query string)
 * - Role (Admin, User, Editor)
 * - Status (active, inactive, pending)
 */
export const useSearchUsersTool = ({ users }: UseSearchUsersTool) => {
  useMCPTool({
    name: 'search_users_table',
    description: 'Search users in the data table by name or email',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to filter users by name or email',
        },
        role: {
          type: 'string',
          description: 'Filter by role (Admin, User, Editor)',
          enum: ['Admin', 'User', 'Editor'],
        },
        status: {
          type: 'string',
          description: 'Filter by status',
          enum: ['active', 'inactive', 'pending'],
        },
      },
      required: ['query'],
    },
    handler: async (args: unknown) => {
      const typedArgs = args as {
        query: string;
        role?: string;
        status?: string;
      };
      const query = typedArgs.query.toLowerCase();
      const roleFilter = typedArgs.role;
      const statusFilter = typedArgs.status;

      const results = users.filter((user) => {
        const matchesSearch =
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query);
        const matchesRole = !roleFilter || user.role === roleFilter;
        const matchesStatus = !statusFilter || user.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                query: typedArgs.query,
                filters: {
                  role: roleFilter || 'all',
                  status: statusFilter || 'all',
                },
                resultsCount: results.length,
                results,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  });
};
