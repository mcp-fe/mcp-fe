import styles from '../DataTablePage.module.scss';

interface TableControlsProps {
  searchTerm: string;
  filterRole: string;
  filterStatus: string;
  itemsPerPage: number;
  selectedUsersCount: number;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onItemsPerPageChange: (value: number) => void;
  onBulkAction: (action: string) => void;
}

export const TableControls = ({
  searchTerm,
  filterRole,
  filterStatus,
  itemsPerPage,
  selectedUsersCount,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onItemsPerPageChange,
  onBulkAction,
}: TableControlsProps) => {
  return (
    <div className={styles.tableControls}>
      <div className={styles.controlsRow}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          <select
            value={filterRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="User">User</option>
            <option value="Editor">Editor</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className={styles.itemsPerPage}>
          <label>
            Show:
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
            per page
          </label>
        </div>
      </div>

      <div className={styles.bulkActions}>
        <button
          className="btn btn-secondary"
          onClick={() => onBulkAction('Export')}
          disabled={selectedUsersCount === 0}
        >
          Export Selected ({selectedUsersCount})
        </button>
        <button
          className="btn btn-danger"
          onClick={() => onBulkAction('Delete')}
          disabled={selectedUsersCount === 0}
        >
          Delete Selected
        </button>
      </div>
    </div>
  );
};
