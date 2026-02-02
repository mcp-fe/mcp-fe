import { useMCPTool } from '@mcp-fe/react';
import { User } from '../types';

interface UseTableStatsTool {
  users: User[];
  filteredAndSortedUsers: User[];
  selectedUsers: number[];
  searchTerm: string;
  filterRole: string;
  filterStatus: string;
  sortField: string;
  sortDirection: string;
}

/**
 * MCP Tool: Get statistics about users in the data table
 *
 * Provides AI agents with aggregate statistics:
 * - Total user counts
 * - Counts by role (Admin, User, Editor)
 * - Counts by status (active, inactive, pending)
 * - Current filter information
 */
export const useTableStatsTool = (props: UseTableStatsTool) => {
  const {
    users,
    filteredAndSortedUsers,
    selectedUsers,
    searchTerm,
    filterRole,
    filterStatus,
    sortField,
    sortDirection,
  } = props;

  useMCPTool({
    name: 'get_users_table_stats',
    description:
      'Get statistics about users in the data table (counts by role, status, etc.)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const stats = {
        total: users.length,
        filtered: filteredAndSortedUsers.length,
        selected: selectedUsers.length,
        byRole: {
          admin: users.filter((u) => u.role === 'Admin').length,
          user: users.filter((u) => u.role === 'User').length,
          editor: users.filter((u) => u.role === 'Editor').length,
        },
        byStatus: {
          active: users.filter((u) => u.status === 'active').length,
          inactive: users.filter((u) => u.status === 'inactive').length,
          pending: users.filter((u) => u.status === 'pending').length,
        },
        currentFilters: {
          search: searchTerm || 'none',
          role: filterRole || 'all',
          status: filterStatus || 'all',
          sortBy: `${sortField} (${sortDirection})`,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    },
  });
};
