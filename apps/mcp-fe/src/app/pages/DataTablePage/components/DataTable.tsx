import { User, SortField } from '../types';

interface DataTableProps {
  users: User[];
  selectedUsers: number[];
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  onSelectUser: (userId: number) => void;
  onSelectAll: () => void;
  onUserAction: (action: string, userId: number) => void;
}

export const DataTable = ({
  users,
  selectedUsers,
  sortField,
  sortDirection,
  onSort,
  onSelectUser,
  onSelectAll,
  onUserAction,
}: DataTableProps) => {
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const getStatusBadge = (status: User['status']) => {
    const statusClasses = {
      active: 'status-badge status-active',
      inactive: 'status-badge status-inactive',
      pending: 'status-badge status-pending',
    };
    return <span className={statusClasses[status]}>{status}</span>;
  };

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={
                  selectedUsers.length === users.length && users.length > 0
                }
                onChange={onSelectAll}
              />
            </th>
            <th onClick={() => onSort('name')} className="sortable">
              Name {getSortIcon('name')}
            </th>
            <th onClick={() => onSort('email')} className="sortable">
              Email {getSortIcon('email')}
            </th>
            <th onClick={() => onSort('role')} className="sortable">
              Role {getSortIcon('role')}
            </th>
            <th onClick={() => onSort('status')} className="sortable">
              Status {getSortIcon('status')}
            </th>
            <th onClick={() => onSort('lastLogin')} className="sortable">
              Last Login {getSortIcon('lastLogin')}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className={selectedUsers.includes(user.id) ? 'selected' : ''}
            >
              <td>
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(user.id)}
                  onChange={() => onSelectUser(user.id)}
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
                    onClick={() => onUserAction('Edit', user.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() =>
                      onUserAction(
                        user.status === 'active' ? 'Deactivate' : 'Activate',
                        user.id,
                      )
                    }
                  >
                    {user.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onUserAction('Delete', user.id)}
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
  );
};
