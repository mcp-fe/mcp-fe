import { useMemo } from 'react';
import { User, SortField, SortDirection } from '../types';

interface UseTableLogicProps {
  users: User[];
  searchTerm: string;
  filterRole: string;
  filterStatus: string;
  sortField: SortField;
  sortDirection: SortDirection;
  currentPage: number;
  itemsPerPage: number;
}

/**
 * Custom hook that handles all table filtering, sorting, and pagination logic
 */
export const useTableLogic = ({
  users,
  searchTerm,
  filterRole,
  filterStatus,
  sortField,
  sortDirection,
  currentPage,
  itemsPerPage,
}: UseTableLogicProps) => {
  // Filter and sort users
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

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);
  const paginatedUsers = filteredAndSortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return {
    filteredAndSortedUsers,
    paginatedUsers,
    totalPages,
  };
};
