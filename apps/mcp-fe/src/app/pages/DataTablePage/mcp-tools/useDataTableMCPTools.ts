import { useEffect } from 'react';
import { useDataTableToolsContext } from '../DataTableToolsContext';
import { User } from '../types';

export const DATA_TABLE_TOOL_NAMES = [
  'get_users_table_data',
  'get_users_table_stats',
  'search_users_table',
  'get_selected_users',
] as const;

export interface DataTableMCPToolsProps {
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
 * Composite hook that syncs the data table state to the always-registered MCP tools.
 * Call this from DataTablePage with the current state — tools become active while
 * the page is mounted and return a friendly error when the page is not active.
 */
export const useDataTableMCPTools = (props: DataTableMCPToolsProps) => {
  const { setToolState } = useDataTableToolsContext();

  useEffect(() => {
    setToolState(props);
    return () => setToolState(null);
  }, [
    props.users,
    props.filteredAndSortedUsers,
    props.currentPage,
    props.itemsPerPage,
    props.selectedUsers,
    props.searchTerm,
    props.filterRole,
    props.filterStatus,
    props.sortField,
    props.sortDirection,
    setToolState,
  ]);
};
