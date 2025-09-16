"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TeamTailorJob } from "@/types/teamtailor";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";


interface JobsTableProps {
  data: TeamTailorJob[];
  isLoading?: boolean;
  pagination: {
    currentPage: number;
    perPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  onSelectionChange: (selectedIds: string[]) => void;
  selectedIds: string[];
  onPageChange: (page: number, perPage: number, sort?: string) => void;
}

export function JobsTable({ 
  data, 
  isLoading = false, 
  pagination,
  onSelectionChange, 
  selectedIds,
  onPageChange
}: JobsTableProps) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < data.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = data.map((job) => job.id);
      onSelectionChange(allIds);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, jobId]);
    } else {
      onSelectionChange(selectedIds.filter((id) => id !== jobId));
    }
  };

  function SkeletonRow() {
    return (
      <TableRow className="h-12">
        <TableCell className="w-6 py-3">
          <Skeleton className="h-4 w-4" />
        </TableCell>
        <TableCell className="w-80 py-3">
          <Skeleton className="h-4 w-72" />
        </TableCell>
        <TableCell className="w-20 py-3">
          <Skeleton className="h-4 w-16" />
        </TableCell>
        <TableCell className="w-20 py-3">
          <Skeleton className="h-4 w-16" />
        </TableCell>
        <TableCell className="w-16 py-3 text-right">
          <Skeleton className="h-8 w-8" />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="flex flex-col h-[75vh]">
      <div className="flex-shrink-0">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-6">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all jobs"
                />
              </TableHead>
              <TableHead className="w-72">Title</TableHead>
              <TableHead className="w-20">Body Length</TableHead>
              <TableHead className="w-20">Last Updated</TableHead>
              <TableHead className="w-20">Created</TableHead>
              <TableHead className="w-16"></TableHead>

            </TableRow>
          </TableHeader>
        </Table>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <Table className="w-full table-fixed">
          <TableBody>
          {isLoading ? (
            <>
              {Array.from({ length: 20 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                No jobs found
              </TableCell>
            </TableRow>
          ) : (
            data.map((job) => (
              <TableRow key={job.id} className="hover:bg-muted/50">
                <TableCell className="w-6">
                  <Checkbox
                    checked={selectedIds.includes(job.id)}
                    onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                    aria-label={`Select ${job.title}`}
                  />
                </TableCell>
                <TableCell className="w-80 font-medium truncate max-w-80">{job.title}</TableCell>
                <TableCell className="w-20 text-sm font-medium">
                  {job.bodyLength}
                </TableCell>
                <TableCell className="w-20 text-sm text-muted-foreground">
                  {format(new Date(job.updatedAtTT), "MMM dd, yyyy")}
                </TableCell>
                <TableCell className="w-20 text-sm text-muted-foreground">
                  {format(new Date(job.createdAtTT), "MMM dd, yyyy")}
                </TableCell>
           
                <TableCell className="w-16 text-right">
                  <Button
                    className="hover:cursor-pointer hover:scale-105 transition-all duration-300"
                    variant="link"
                    size="icon"
                    onClick={() => window.open(job.link, "_blank")}
                  >
                    <Image
                      src="/images/teamtailor_logo.png"
                      alt="Teamtailor"
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-full"
                    />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex-shrink-0 border-t">
        <div className="flex items-center justify-center p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.currentPage - 1, pagination.perPage)}
              disabled={!pagination.hasPrev || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-sm text-muted-foreground px-4">
              Page {pagination.currentPage} of {pagination.totalPages}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.currentPage + 1, pagination.perPage)}
              disabled={!pagination.hasNext || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

