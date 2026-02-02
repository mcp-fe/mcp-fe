import { useState, useMemo } from 'react';
import { useMCPTool } from '@mcp-fe/react-event-tracker';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  lastLogin: string;
  actions?: string;
}

const mockUsers: User[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Admin',
    status: 'active',
    lastLogin: '2024-01-15',
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'User',
    status: 'active',
    lastLogin: '2024-01-14',
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'Editor',
    status: 'inactive',
    lastLogin: '2024-01-10',
  },
  {
    id: 4,
    name: 'Alice Brown',
    email: 'alice@example.com',
    role: 'User',
    status: 'pending',
    lastLogin: '2024-01-12',
  },
  {
    id: 5,
    name: 'Charlie Wilson',
    email: 'charlie@example.com',
    role: 'Admin',
    status: 'active',
    lastLogin: '2024-01-16',
  },
  {
    id: 6,
    name: 'Diana Davis',
    email: 'diana@example.com',
    role: 'Editor',
    status: 'active',
    lastLogin: '2024-01-13',
  },
  {
    id: 7,
    name: 'Edward Miller',
    email: 'edward@example.com',
    role: 'User',
    status: 'inactive',
    lastLogin: '2024-01-08',
  },
  {
    id: 8,
    name: 'Fiona Garcia',
    email: 'fiona@example.com',
    role: 'User',
    status: 'active',
    lastLogin: '2024-01-15',
  },
];

type SortField = keyof User;
type SortDirection = 'asc' | 'desc';

export const DataTablePage = () => {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Register MCP tools for AI agents to query table data
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

  // Filter and sort logic
  const filteredAndSortedUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = !filterRole || user.role === filterRole;
      const matchesStatus = !filterStatus || user.status === filterStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });

    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        const comparison = aVal - bVal;
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      return 0;
    });

    return filtered;
  }, [users, searchTerm, filterRole, filterStatus, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const paginatedUsers = filteredAndSortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

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

  const getStatusBadge = (status: User['status']) => {
    const statusClasses = {
      active: 'status-badge status-active',
      inactive: 'status-badge status-inactive',
      pending: 'status-badge status-pending',
    };
    return <span className={statusClasses[status]}>{status}</span>;
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="data-table-page">
      <h2>Data Table Demo - Interactive Grid</h2>
      <p>
        This data table demonstrates comprehensive interaction tracking
        including sorting, filtering, pagination, row selection, and bulk
        actions. All interactions are captured for analysis.
      </p>

      <div
        className="mcp-tools-info"
        style={{
          background: '#e3f2fd',
          border: '1px solid #2196f3',
          borderRadius: '4px',
          padding: '12px 16px',
          marginBottom: '20px',
        }}
      >
        <strong>
          <span role="img" aria-label="robot">
            🤖
          </span>{' '}
          MCP Tools Available:
        </strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>
            <code>get_users_table_data</code> - Get all users with filters
          </li>
          <li>
            <code>get_users_table_stats</code> - Get statistics (counts by
            role/status)
          </li>
          <li>
            <code>search_users_table</code> - Search users by name/email
          </li>
          <li>
            <code>get_selected_users</code> - Get currently selected users
          </li>
        </ul>
      </div>

      <div className="table-controls">
        <div className="controls-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filters">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="filter-select"
            >
              <option value="">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="User">User</option>
              <option value="Editor">Editor</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="items-per-page">
            <label>
              Show:
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
              per page
            </label>
          </div>
        </div>

        <div className="bulk-actions">
          <button
            className="btn btn-secondary"
            onClick={() => handleBulkAction('Export')}
            disabled={selectedUsers.length === 0}
          >
            Export Selected ({selectedUsers.length})
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleBulkAction('Delete')}
            disabled={selectedUsers.length === 0}
          >
            Delete Selected
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={
                    selectedUsers.length === paginatedUsers.length &&
                    paginatedUsers.length > 0
                  }
                  onChange={handleSelectAll}
                />
              </th>
              <th onClick={() => handleSort('name')} className="sortable">
                Name {getSortIcon('name')}
              </th>
              <th onClick={() => handleSort('email')} className="sortable">
                Email {getSortIcon('email')}
              </th>
              <th onClick={() => handleSort('role')} className="sortable">
                Role {getSortIcon('role')}
              </th>
              <th onClick={() => handleSort('status')} className="sortable">
                Status {getSortIcon('status')}
              </th>
              <th onClick={() => handleSort('lastLogin')} className="sortable">
                Last Login {getSortIcon('lastLogin')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user) => (
              <tr
                key={user.id}
                className={selectedUsers.includes(user.id) ? 'selected' : ''}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => handleSelectUser(user.id)}
                  />
                </td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{getStatusBadge(user.status)}</td>
                <td>{user.lastLogin}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleUserAction('Edit', user.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        handleUserAction(
                          user.status === 'active' ? 'Deactivate' : 'Activate',
                          user.id,
                        )
                      }
                    >
                      {user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleUserAction('Delete', user.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <div className="pagination-info">
          Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
          {Math.min(currentPage * itemsPerPage, filteredAndSortedUsers.length)}{' '}
          of {filteredAndSortedUsers.length} entries
        </div>

        <div className="pagination">
          <button
            className="btn btn-sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={`btn btn-sm ${currentPage === page ? 'active' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          ))}

          <button
            className="btn btn-sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
