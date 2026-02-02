import { useMCPTool } from '@mcp-fe/react';
import { User } from '../types';

interface UseTableDataToolProps {
  users: User[];
  filteredAndSortedUsers: User[];
  currentPage: number;
  itemsPerPage: number;
  selectedUsers: number[];
  searchTerm: string;
  filterRole: string;
  filterStatus: string;
  sortField: string;
  sortDirection: string;
}

/**
 * MCP Tool: Get all users from the data table
 *
 * Provides AI agents access to the current table data including:
 * - All users (with filters and sorting applied)
 * - Pagination info
 * - Selected users count
 * - Optional: current filter settings
 */
export const useTableDataTool = (props: UseTableDataToolProps) => {
  const {
    filteredAndSortedUsers,
    currentPage,
    itemsPerPage,
    selectedUsers,
    searchTerm,
    filterRole,
    filterStatus,
    sortField,
    sortDirection,
  } = props;

  useMCPTool({
    name: 'get_users_table_data',
    description:
      'Get all users from the data table with their current filters and sorting applied',
    inputSchema: {
      type: 'object',
      properties: {
        includeFilters: {
          type: 'boolean',
          description: 'Include current filter information',
          default: false,
        },
      },
    },
    handler: async (args: unknown) => {
      const typedArgs = args as { includeFilters?: boolean };
      const tableData = {
        users: filteredAndSortedUsers,
        totalCount: filteredAndSortedUsers.length,
        currentPage,
        itemsPerPage,
        totalPages: Math.ceil(filteredAndSortedUsers.length / itemsPerPage),
        selectedUsers: selectedUsers.length,
        ...(typedArgs.includeFilters && {
          filters: {
            searchTerm,
            role: filterRole || 'all',
            status: filterStatus || 'all',
            sortField,
            sortDirection,
          },
        }),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tableData, null, 2),
          },
        ],
      };
    },
  });
};
