"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CandidateDoc, Id } from "@/types";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/convex";
import { useQuery } from "convex/react";

interface ProcessingStatus {
  candidateId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "none" | "unknown";
  progress: number;
  progressMessage: string;
  errorMessage: string;
}

interface CandidatesTableProps {
  data: CandidateDoc[];
  isLoading?: boolean;
  onRowClick?: (candidateId: string) => void;
}

export function CandidatesTable({ 
  data, 
  isLoading = false, 
  onRowClick,
}: CandidatesTableProps) {
  
  function getInitials(name?: string) {
    if (!name) return "?";
    const parts = name.split(" ").filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function getCandidateTags(row: CandidateDoc): string[] {
    const tags: string[] = [];
    const attrs = row?.rawData?.attributes ?? {};
    if (Array.isArray(attrs?.tags)) {
      for (const t of attrs.tags) if (typeof t === "string") tags.push(t);
    }
    const city: string | undefined = attrs?.city || attrs?.location || attrs?.["location-name"];
    if (city) tags.push(city);
    return tags;
  }

  function ProcessingStatusPill({ candidateId }: { candidateId: Id<"candidates"> }) { 
    const processingStatus = useQuery(api.candidates.getProcessingStatus, { candidateId });
    
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
          <span className="text-muted-foreprocessingStatusground">({processingStatus?.progress}%)</span>
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
            <Skeleton className="h-4 w-40" />
          </div>
        </TableCell>
        <TableCell className="w-64 py-3">
          <div className="flex flex-wrap gap-1">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-14" />
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
              <TableHead className="w-64">Name</TableHead>
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
                  No candidates found
                </TableCell>
              </TableRow>
            ) : (
              data.map((candidate) => (
                <TableRow key={candidate._id} className="hover:bg-muted/50 cursor-pointer " onClick={() => onRowClick?.(candidate._id)}>
                  <TableCell className="w-64">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10">
                        {candidate?.imageUrl ? (
                          <img src={candidate.imageUrl} alt={candidate.name} className="h-full w-full object-cover rounded-full" />
                        ) : (
                          <AvatarFallback className="text-sm font-medium">
                            {getInitials(candidate.name)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="font-medium truncate">{candidate.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="w-64">
                    <div className="flex flex-wrap gap-1">
                      {getCandidateTags(candidate).slice(0, 4).map((t) => (
                        <Badge key={t} variant="outline" className="px-1 py-0 text-[11px]">
                          {t}
                        </Badge>
                      ))}
                      {getCandidateTags(candidate).length > 4 && (
                        <Badge variant="secondary" className="px-1 py-0 text-[11px]">
                          +{getCandidateTags(candidate).length - 4}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="w-32">
                    {/* Best match column intentionally left blank for now */}
                  </TableCell>
                  <TableCell className="w-32">
                    <ProcessingStatusPill candidateId={candidate._id} />
                  </TableCell>
                  <TableCell className="w-32 text-sm text-muted-foreground">
                    {format(new Date(candidate.updatedAt ?? candidate._creationTime), "MMM dd, yyyy")}
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
