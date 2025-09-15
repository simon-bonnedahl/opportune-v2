"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { JobDoc } from "@/types";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ProcessingStatus {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "none" | "unknown";
  progress: number;
  progressMessage: string;
  errorMessage: string;
}

interface JobsTableProps {
  data: JobDoc[];
  isLoading?: boolean;
  pagination: {
    currentPage: number;
    perPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  onPageChange: (page: number, perPage: number, sort?: string) => void;
  onRowClick?: (jobId: string) => void;
  processingStatuses?: ProcessingStatus[];
}

export function JobsTable({ 
  data, 
  isLoading = false, 
  pagination,
  onPageChange,
  onRowClick,
  processingStatuses = []
}: JobsTableProps) {
  
  function getInitials(text?: string) {
    if (!text) return "?";
    const parts = text.split(" ").filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function getJobTags(row: JobDoc): string[] {
    const tags: string[] = [];
    const attrs = row?.rawData?.attributes ?? {};
    if (Array.isArray(attrs?.tags)) {
      for (const t of attrs.tags) if (typeof t === "string") tags.push(t);
    }
    if (typeof attrs?.status === "string") tags.push(attrs.status);
    if (typeof attrs?.location === "string") tags.push(attrs.location);
    if (typeof attrs?.["location-name"] === "string") tags.push(attrs["location-name"]);
    if (typeof attrs?.department === "string") tags.push(attrs.department);
    return tags;
  }

  function ProcessingStatusPill({ jobId }: { jobId: string }) {
    const status = processingStatuses.find(p => p.jobId === jobId);
    if (!status) return <div className="text-xs text-muted-foreground">-</div>;
    
    const getStatusColor = (status: string) => {
      switch (status) {
        case "running": return "bg-blue-500 animate-pulse";
        case "queued": return "bg-yellow-500";
        case "succeeded": return "bg-emerald-500";
        case "failed": return "bg-red-500";
        case "canceled": return "bg-gray-500";
        case "none": return "bg-gray-300";
        default: return "bg-gray-400";
      }
    };

    const getStatusLabel = (status: string) => {
      switch (status) {
        case "running": return "Running";
        case "queued": return "Queued";
        case "succeeded": return "Completed";
        case "failed": return "Failed";
        case "canceled": return "Canceled";
        case "none": return "None";
        default: return "Unknown";
      }
    };

    return (
      <div className="inline-flex items-center gap-2 text-xs">
        <span className={`inline-block h-2 w-2 rounded-full ${getStatusColor(status.status)}`} />
        <span>{getStatusLabel(status.status)}</span>
        {status.status === "running" && status.progress > 0 && (
          <span className="text-muted-foreground">({status.progress}%)</span>
        )}
      </div>
    );
  }

  function SkeletonRow() {
    return (
      <TableRow className="h-12">
        <TableCell className="w-64 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </TableCell>
        <TableCell className="w-64 py-3">
          <div className="flex flex-wrap gap-1">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8" />
          </div>
        </TableCell>
        <TableCell className="w-32 py-3">
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell className="w-32 py-3">
          <Skeleton className="h-4 w-16" />
        </TableCell>
        <TableCell className="w-32 py-3">
          <Skeleton className="h-4 w-16" />
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
              <TableHead className="w-64">Title</TableHead>
              <TableHead className="w-64">Tags</TableHead>
              <TableHead className="w-32">Best Match</TableHead>
              <TableHead className="w-32">Processing</TableHead>
              <TableHead className="w-32">Imported</TableHead>
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
                <TableRow key={job._id} className="hover:bg-muted/50 cursor-pointer" onClick={() => onRowClick?.(job._id)}>
                  <TableCell className="w-64">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[11px]">
                          {getInitials(job?.rawData?.attributes?.title ?? String(job._id))}
                        </AvatarFallback>
                      </Avatar>
                      <div className="font-medium truncate">{job?.rawData?.attributes?.title ?? job._id}</div>
                    </div>
                  </TableCell>
                  <TableCell className="w-64">
                    <div className="flex flex-wrap gap-1">
                      {getJobTags(job).slice(0, 4).map((t) => (
                        <Badge key={t} variant="outline" className="px-1 py-0 text-[11px]">
                          {t}
                        </Badge>
                      ))}
                      {getJobTags(job).length > 4 && (
                        <Badge variant="secondary" className="px-1 py-0 text-[11px]">
                          +{getJobTags(job).length - 4}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="w-32">
                    {/* Best match column intentionally left blank for now */}
                  </TableCell>
                  <TableCell className="w-32">
                    <ProcessingStatusPill jobId={job._id} />
                  </TableCell>
                  <TableCell className="w-32 text-sm text-muted-foreground">
                    {format(new Date(job.updatedAt ?? job._creationTime), "MMM dd, yyyy")}
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
