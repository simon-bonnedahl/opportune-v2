export interface TeamTailorCandidate {
  id: string;
  name: string;
  email: string;
  updatedAtTT: number;
  createdAtTT: number;
  link: string;
}

export interface TeamTailorJob {
  id: string;
  title: string;
  internalName: string;
  status: string;
  department: string;
  location: string;
  bodyLength: number;
  updatedAtTT: number;
  createdAtTT: number;
  link: string;
}

export interface TeamTailorPagination {
  currentPage: number;
  perPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}
