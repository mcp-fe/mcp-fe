export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  lastLogin: string;
  actions?: string;
}

export type SortField = keyof User;
export type SortDirection = 'asc' | 'desc';

export interface TableFilters {
  searchTerm: string;
  role: string;
  status: string;
}

export interface TableState {
  sortField: SortField;
  sortDirection: SortDirection;
  currentPage: number;
  itemsPerPage: number;
  selectedUsers: number[];
}
