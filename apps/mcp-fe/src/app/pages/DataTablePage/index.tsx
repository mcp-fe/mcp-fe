import { useState } from 'react';
import { User, SortField, SortDirection } from './types';
import { mockUsers } from './mockData';
import { useTableLogic } from './hooks/useTableLogic';
import { useDataTableMCPTools } from './mcp-tools/useDataTableMCPTools';
import { MCPToolsInfo } from './components/MCPToolsInfo';
import { TableControls } from './components/TableControls';
import { DataTable } from './components/DataTable';
import { TablePagination } from './components/TablePagination';

export const DataTablePage = () => {
  // State management
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Table logic (filtering, sorting, pagination)
  const { filteredAndSortedUsers, paginatedUsers, totalPages } = useTableLogic({
    users,
    searchTerm,
    filterRole,
    filterStatus,
    sortField,
    sortDirection,
    currentPage,
    itemsPerPage,
  });

  // Register MCP tools for AI agents
  useDataTableMCPTools({
    users,
    filteredAndSortedUsers,
    currentPage,
    itemsPerPage,
    selectedUsers,
    searchTerm,
    filterRole,
    filterStatus,
    sortField,
    sortDirection,
  });

  // Event handlers
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectUser = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === paginatedUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(paginatedUsers.map((user) => user.id));
    }
  };

  const handleUserAction = (action: string, userId: number) => {
    const user = users.find((u) => u.id === userId);
    alert(`${action} action triggered for ${user?.name}`);

    // Simulate status change for demo
    if (action === 'Activate' || action === 'Deactivate') {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, status: action === 'Activate' ? 'active' : 'inactive' }
            : u,
        ),
      );
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedUsers.length === 0) {
      alert('Please select users first');
      return;
    }
    alert(`${action} action applied to ${selectedUsers.length} users`);
    setSelectedUsers([]);
  };

  return (
    <div className="data-table-page">
      <h2>Data Table Demo - Interactive Grid</h2>
      <p>
        This data table demonstrates comprehensive interaction tracking
        including sorting, filtering, pagination, row selection, and bulk
        actions. All interactions are captured for analysis.
      </p>

      <MCPToolsInfo />

      <TableControls
        searchTerm={searchTerm}
        filterRole={filterRole}
        filterStatus={filterStatus}
        itemsPerPage={itemsPerPage}
        selectedUsersCount={selectedUsers.length}
        onSearchChange={setSearchTerm}
        onRoleChange={setFilterRole}
        onStatusChange={setFilterStatus}
        onItemsPerPageChange={setItemsPerPage}
        onBulkAction={handleBulkAction}
      />

      <DataTable
        users={paginatedUsers}
        selectedUsers={selectedUsers}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onSelectUser={handleSelectUser}
        onSelectAll={handleSelectAll}
        onUserAction={handleUserAction}
      />

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={filteredAndSortedUsers.length}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};
