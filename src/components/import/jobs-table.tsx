"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TeamTailorJob } from "@/types/teamtailor";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { timeAgo } from "@/lib/format";


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
        <TableCell className="w-12 py-3">
          <Skeleton className="h-4 w-4" />
        </TableCell>
        <TableCell className="py-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-48" />
          </div>
        </TableCell>
        <TableCell className="w-24 py-3 text-right">
          <Skeleton className="h-4 w-12 ml-auto" />
        </TableCell>
        <TableCell className="w-32 py-3 text-right">
          <Skeleton className="h-4 w-20 ml-auto" />
        </TableCell>
        <TableCell className="w-32 py-3 text-right">
          <Skeleton className="h-4 w-20 ml-auto" />
        </TableCell>
        <TableCell className="w-16 py-3 text-right">
          <Skeleton className="h-8 w-8 ml-auto" />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="flex flex-col h-[75vh]">
      {/* Job count display */}
 

      <div className="flex-1 overflow-y-auto">
        <Table className="w-full">
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all jobs"
                />
              </TableHead>
              <TableHead className="text-left">Title</TableHead>
              <TableHead className="text-right w-24">Body Length</TableHead>
              <TableHead className="text-right w-32">Last Updated</TableHead>
              <TableHead className="text-right w-32">Created</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                {Array.from({ length: 20 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              data.map((job) => (
                <TableRow key={job.id} className="hover:bg-muted/50">
                  <TableCell className="w-12">
                    <Checkbox
                      checked={selectedIds.includes(job.id)}
                      onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                      aria-label={`Select ${job.title}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-0">
                    <div className="space-y-1">
                      <div className="text-sm font-medium truncate" title={job.title}>
                        {job.title}
                      </div>
                      {job.internalName && (
                        <div className="text-sm text-muted-foreground truncate" title={job.internalName}>
                          {job.internalName}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right w-24 text-sm font-medium">
                    {job.bodyLength}
                  </TableCell>
                  <TableCell className="text-right w-32 text-sm ">
                    {timeAgo(job.updatedAtTT)}
                  </TableCell>
                  <TableCell className="text-right w-32 text-sm text-muted-foreground">
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

