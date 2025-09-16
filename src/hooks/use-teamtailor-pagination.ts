"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";

interface PaginationState {
  currentPage: number;
  perPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function useTeamTailorPagination<T>(
  fetchFunction: any,
  initialPage = 1,
  initialPerPage = 25
) {
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(initialPerPage);
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    perPage: initialPerPage,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useAction(fetchFunction);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchData({ page, perPage });
      setData((result.data || []) as T[]);
      setPagination(result.pagination || pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchData, page, perPage, pagination]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  }, [pagination.totalPages]);

  const changePageSize = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1); // Reset to first page when changing page size
  }, []);

  const nextPage = useCallback(() => {
    if (pagination.hasNext) {
      setPage(page + 1);
    }
  }, [page, pagination.hasNext]);

  const prevPage = useCallback(() => {
    if (pagination.hasPrev) {
      setPage(page - 1);
    }
  }, [page, pagination.hasPrev]);

  return {
    data,
    pagination,
    isLoading,
    error,
    page,
    perPage,
    goToPage,
    changePageSize,
    nextPage,
    prevPage,
    refetch: loadData,
  };
}
