import { useTableDataTool } from './useTableDataTool';
import { useTableStatsTool } from './useTableStatsTool';
import { useSearchUsersTool } from './useSearchUsersTool';
import { useSelectedUsersTool } from './useSelectedUsersTool';
import { User } from '../types';

interface UseDataTableMCPToolsProps {
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
 * Composite hook that registers all MCP tools for the data table
 *
 * This hook combines all individual tool hooks into one convenient hook
 * that can be used in the DataTablePage component.
 */
export const useDataTableMCPTools = (props: UseDataTableMCPToolsProps) => {
  useTableDataTool(props);
  useTableStatsTool(props);
  useSearchUsersTool({ users: props.users });
  useSelectedUsersTool({
    users: props.users,
    selectedUsers: props.selectedUsers,
  });
};
