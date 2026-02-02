import { useMCPTool } from '@mcp-fe/react';
import { User } from '../types';

interface UseSelectedUsersTool {
  users: User[];
  selectedUsers: number[];
}

/**
 * MCP Tool: Get currently selected users
 *
 * Provides AI agents access to the list of users
 * that are currently selected in the data table.
 */
export const useSelectedUsersTool = ({
  users,
  selectedUsers,
}: UseSelectedUsersTool) => {
  useMCPTool({
    name: 'get_selected_users',
    description: 'Get the list of currently selected users in the data table',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const selected = users.filter((u) => selectedUsers.includes(u.id));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                count: selected.length,
                users: selected,
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
