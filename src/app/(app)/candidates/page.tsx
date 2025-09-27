"use client";

import { useState } from "react";
import { useAction, useQuery, usePaginatedQuery } from "convex/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { CandidateDialog } from "@/components/candidates/candidate-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, Id } from "@/lib/convex";

export default function CandidatesPage() {
  const [selectedId, setSelectedId] = useState<Id<"candidates"> | null>(null);
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 500);

  const addCandidate = useAction(api.candidates.add);


  const totalCount = useQuery(api.candidates.getCandidatesCount, { search: debouncedSearch })
  const { results, status } = usePaginatedQuery(
    api.candidates.listPaginated,
    { search: debouncedSearch },
    { initialNumItems: 50 }
  )



  const handleAddCandidate = async () => {
    const teamtailorId = window.prompt("Enter TeamTailor Candidate ID:");
    if (!teamtailorId?.trim()) return;

    try {
      await addCandidate({ teamtailorId: teamtailorId.trim() });
      toast.success("Candidate import started successfully!");
    } catch (error) {
      console.error("Failed to add candidate:", error);
      toast.error("Failed to start candidate import. Please try again.");
    }
  };

  return (
    <div className="w-full px-4 py-4">
      <Card className="max-w-[1600px] mx-auto">
        <div className="flex flex-wrap items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Candidates</h1>
            <div className="text-md text-muted-foreground">
              {typeof totalCount === "number" ? (
                <span>Showing {results.length} of {totalCount} candidates</span>
              ) : (
                <Skeleton className="h-4 w-32" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Search candidates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />


            <Button onClick={handleAddCandidate} size="sm">
              <Plus className="h-4 w-4" />

              Add Candidate
            </Button>
          </div>
        </div>

        <CandidatesTable
          data={results}
          isLoading={status === "LoadingFirstPage"}
          onRowClick={setSelectedId}
        />
      </Card>

      {selectedId && (
        <CandidateDialog id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}