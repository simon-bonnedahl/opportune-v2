"use client";

import { useState } from "react";
import { useQuery, useAction, usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobsTable } from "@/components/jobs/jobs-table";
import { JobDialog } from "@/components/jobs/job-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Id } from "@/lib/convex";

export default function JobsPage() {
  const [selectedId, setSelectedId] = useState<Id<"jobs"> | null>(null);
  const [searchText, setSearchText] = useState<string>("");
  const debouncedSearchText = useDebounce(searchText, 500);

  const addJob = useAction(api.jobs.add);

  const totalCount = useQuery(api.jobs.getJobsCount, { search: debouncedSearchText }) as number | undefined;
  const { results, status } = usePaginatedQuery(
    api.jobs.listPaginated,
    { search: debouncedSearchText },
    { initialNumItems: 50 }
  );

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handleAddJob = async () => {
    const teamtailorId = window.prompt("Enter TeamTailor Job ID:");
    if (!teamtailorId?.trim()) return;
    
    try {
      await addJob({ teamtailorId: teamtailorId.trim() });
      toast.success("Job import started successfully!");
    } catch (error) {
      console.error("Failed to add job:", error);
      toast.error("Failed to start job import. Please try again.");
    }
  };

  return (
    <div className="w-full px-4 py-4">
      <Card className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Jobs</h1>
            <div className="text-md text-muted-foreground">
              {typeof totalCount === "number" ? (
                <span>Showing {results.length} of {totalCount} jobs</span>
              ) : (
                <Skeleton className="h-4 w-32" />
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search jobs..."
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-64"
            />
            
            <Button onClick={handleAddJob} size="sm">
              <Plus className="h-4 w-4" />
              Add Job
            </Button>
          </div>
        </div>

        <JobsTable
          data={results}
          isLoading={status === "LoadingFirstPage"}
          onRowClick={setSelectedId}
        />
      </Card>

      {selectedId && <JobDialog id={selectedId} onClose={() => setSelectedId(null)}  />}
    </div>
  );
}