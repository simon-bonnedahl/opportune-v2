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

type CandidateTTCache = {
  _id: Id<"candidateTTCache">;
  teamtailorId: string;
  candidateId?: Id<"candidates">;
  name: string;
  email: string;
  hasAssessment: boolean;
  hasHubert: boolean;
  hasResumeSummary: boolean;
  hasLinkedinSummary: boolean;
  updatedAt: number;
  createdAt: number;
};

interface CandidatesCacheTableProps {
  data: CandidateTTCache[];
  isLoading?: boolean;
  pagination: {
    isDone: boolean;
    continueCursor?: string;
  };
  onSelectionChange: (selectedIds: string[]) => void;
  selectedIds: string[];
  onLoadMore: () => void;
}

export function CandidatesCacheTable({ 
  data, 
  isLoading = false, 
  pagination,
  onSelectionChange, 
  selectedIds,
  onLoadMore
}: CandidatesCacheTableProps) {
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < data.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = data.map((candidate) => candidate.teamtailorId);
      onSelectionChange(allIds);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectCandidate = (candidateId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, candidateId]);
    } else {
      onSelectionChange(selectedIds.filter((id) => id !== candidateId));
    }
  };

  function SkeletonRow() {
    return (
      <TableRow className="h-12">
        <TableCell className="w-6 py-3">
          <Skeleton className="h-4 w-4" />
        </TableCell>
        <TableCell className="w-64 py-3">
          <Skeleton className="h-4 w-48" />
        </TableCell>
        <TableCell className="w-64 py-3">
          <Skeleton className="h-4 w-56" />
        </TableCell>
        <TableCell className="w-32 py-3">
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell className="w-32 py-3">
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell className="w-32 py-3">
          <div className="flex gap-1">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-12" />
          </div>
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
                  aria-label="Select all candidates"
                />
              </TableHead>
              <TableHead className="w-64">Name</TableHead>
              <TableHead className="w-64">Email</TableHead>
              <TableHead className="w-32">Last Updated</TableHead>
              <TableHead className="w-32">Created</TableHead>
              <TableHead className="w-32">Data Available</TableHead>
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
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No cached candidates found
              </TableCell>
            </TableRow>
          ) : (
            data.map((candidate) => (
              <TableRow key={candidate._id} className="hover:bg-muted/50">
                <TableCell className="w-6">
                  <Checkbox
                    checked={selectedIds.includes(candidate.teamtailorId)}
                    onCheckedChange={(checked) => handleSelectCandidate(candidate.teamtailorId, !!checked)}
                    aria-label={`Select ${candidate.name}`}
                  />
                </TableCell>
                <TableCell className="w-64 font-medium">{candidate.name}</TableCell>
                <TableCell className="w-64 text-muted-foreground">{candidate.email}</TableCell>
                <TableCell className="w-32 text-sm">
                  {format(new Date(candidate.updatedAt), "MMM dd, yyyy")}
                </TableCell>
                <TableCell className="w-32 text-sm text-muted-foreground">
                  {format(new Date(candidate.createdAt), "MMM dd, yyyy")}
                </TableCell>
                <TableCell className="w-32">
                  <div className="flex gap-1 flex-wrap">
                    {candidate.hasAssessment && (
                      <Badge variant="secondary" className="text-xs">Assessment</Badge>
                    )}
                    {candidate.hasHubert && (
                      <Badge variant="secondary" className="text-xs">Hubert</Badge>
                    )}
                    {candidate.hasResumeSummary && (
                      <Badge variant="secondary" className="text-xs">Resume</Badge>
                    )}
                    {candidate.hasLinkedinSummary && (
                      <Badge variant="secondary" className="text-xs">LinkedIn</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="w-16 text-right">
                  <Button
                    className="hover:cursor-pointer hover:scale-105 transition-all duration-300"
                    variant="link"
                    size="icon"
                    onClick={() => window.open(`https://app.teamtailor.com/companies/Epgs55TVBkQ/candidates/${candidate.teamtailorId}`, "_blank")}
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
                All {data.length} cached candidates loaded
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
