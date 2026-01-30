import { useState, useMemo } from 'react';

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

  // Filter and sort logic
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter((user) => {
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
