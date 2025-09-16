"use client";

import { format } from "date-fns";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/convex";
import { useQuery } from "convex/react";
import { Doc, Id } from "../../../convex/_generated/dataModel";


interface JobsTableProps {
  data: Doc<"jobs">[];
  isLoading?: boolean;
  onRowClick?: (jobId: Id<"jobs">) => void;
}

export function JobsTable({ 
  data, 
  isLoading = false, 
  onRowClick,
}: JobsTableProps) {
  
  function getInitials(text?: string) {
    if (!text) return "?";
    const parts = text.split(" ").filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function getJobTags(row: Doc<"jobs">): string[] {
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

  function ProcessingStatusPill({ jobId }: { jobId: Id<"jobs"> }) {
    const processingStatus = useQuery(api.jobs.getProcessingStatus, { jobId });
    
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
        <span className={`inline-block h-2 w-2 rounded-full ${getStatusColor(processingStatus?.status ?? "unknown")}`} />
        <span>{getStatusLabel(processingStatus?.status ?? "unknown")}</span>
        {processingStatus?.status === "running" && processingStatus?.progress > 0 && (
          <span className="text-muted-foreground">({processingStatus?.progress}%)</span>
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
                      <Avatar className="size-10">
                        <AvatarFallback className="text-sm">
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
          
          </div>
        </div>
      </div>
    </div>
  );
}
