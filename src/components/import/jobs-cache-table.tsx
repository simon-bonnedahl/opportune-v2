"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

type JobTTCache = {
  _id: Id<"jobTTCache">;
  teamtailorId: string;
  jobId?: Id<"jobs">;
  title: string;
  internalName: string;
  body: string;
  updatedAt: number;
  createdAt: number;
};

interface JobsCacheTableProps {
  data: JobTTCache[];
  isLoading?: boolean;
  pagination: {
    isDone: boolean;
    continueCursor?: string;
  };
  onSelectionChange: (selectedIds: string[]) => void;
  selectedIds: string[];
  onLoadMore: () => void;
}

export function JobsCacheTable({ 
  data, 
  isLoading = false, 
  pagination,
  onSelectionChange, 
  selectedIds,
  onLoadMore
}: JobsCacheTableProps) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < data.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = data.map((job) => job.teamtailorId);
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
                  No cached jobs found
                </TableCell>
              </TableRow>
            ) : (
              data.map((job) => (
                <TableRow key={job._id} className="hover:bg-muted/50">
                  <TableCell className="w-12">
                    <Checkbox
                      checked={selectedIds.includes(job.teamtailorId)}
                      onCheckedChange={(checked) => handleSelectJob(job.teamtailorId, !!checked)}
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
                    {job.body.length}
                  </TableCell>
                  <TableCell className="text-right w-32 text-sm text-muted-foreground">
                    {format(new Date(job.updatedAt), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="text-right w-32 text-sm text-muted-foreground">
                    {format(new Date(job.createdAt), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="w-16 text-right">
                    <Button
                      className="hover:cursor-pointer hover:scale-105 transition-all duration-300"
                      variant="link"
                      size="icon"
                      onClick={() => window.open(`https://app.teamtailor.com/companies/Epgs55TVBkQ/jobs/${job.teamtailorId}`, "_blank")}
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
            {!pagination.isDone && (
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Load More"}
              </Button>
            )}
            {pagination.isDone && data.length > 0 && (
              <div className="text-sm text-muted-foreground">
                All {data.length} cached jobs loaded
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
