import { useMCPTool } from '@mcp-fe/react-tools';
import { User } from '../types';

interface UseSelectedUsersToolProps {
  users: User[];
  selectedUsers: number[];
}

/**
 * MCP Tool: Get currently selected users
 *
 * Provides AI agents access to the list of users
 * that are currently selected in the data table.
 */
export const useSelectedUsersTool = (props: UseSelectedUsersToolProps | null) => {
  useMCPTool({
    name: 'get_selected_users',
    description: 'Get the list of currently selected users in the data table',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      if (!props) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Navigate to /data-table to use this tool.' }],
        };
      }

      const { users, selectedUsers } = props;
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
