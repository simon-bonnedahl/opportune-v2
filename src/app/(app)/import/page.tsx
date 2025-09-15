"use client";
import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

import { CandidatesTable } from "@/components/import/candidates-table";
import { JobsTable } from "@/components/import/jobs-table";
import { ImportConfirmationDialog } from "@/components/import/import-confirmation-dialog";
import { api } from "../../../../convex/_generated/api";

export default function ImportPage() {
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [sortMode, setSortMode] = useState<"updated-at" | "created-at">("updated-at");
  const [activeTab, setActiveTab] = useState<"candidates" | "jobs">("candidates");
  
  // Candidates state
  const [candidatesData, setCandidatesData] = useState<any[]>([]);
  const [candidatesPagination, setCandidatesPagination] = useState({
    currentPage: 1,
    perPage: 25,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  // Jobs state
  const [jobsData, setJobsData] = useState<any[]>([]);
  const [jobsPagination, setJobsPagination] = useState({
    currentPage: 1,
    perPage: 25,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [jobsLoading, setJobsLoading] = useState(false);

  const listCandidates = useAction(api.teamtailor.listCandidatesFromTeamtailor);
  const listJobs = useAction(api.teamtailor.listJobsFromTeamtailor);

  const totalSelected = selectedCandidateIds.length + selectedJobIds.length;

  const loadCandidates = async (page: number = 1, perPage: number = 25, sort?: string) => {
    setCandidatesLoading(true);
    try {
      const result = await listCandidates({ page, perPage, sort: sort || `-${sortMode}` });
      setCandidatesData(result.candidates || []);
      setCandidatesPagination(result.pagination);
    } catch (error) {
      toast.error("Failed to load candidates from TeamTailor");
    } finally {
      setCandidatesLoading(false);
    }
  };

  const loadJobs = async (page: number = 1, perPage: number = 25, sort?: string) => {
    setJobsLoading(true);
    try {
      const result = await listJobs({ page, perPage, sort: sort || `-${sortMode}` });
      setJobsData(result.jobs || []);
      setJobsPagination(result.pagination);
    } catch (error) {
      toast.error("Failed to load jobs from TeamTailor");
    } finally {
      setJobsLoading(false);
    }
  };

  // Load data on component mount and when sort mode changes
  useEffect(() => {
    loadCandidates();
    loadJobs();
  }, [sortMode]);

  const handleImport = () => {
    if (totalSelected === 0) {
      toast.error("Please select at least one item to import");
      return;
    }
    setShowImportDialog(true);
  };

  const handleImportComplete = () => {
    setSelectedCandidateIds([]);
    setSelectedJobIds([]);
    // Refresh data
    loadCandidates(candidatesPagination.currentPage, candidatesPagination.perPage);
    loadJobs(jobsPagination.currentPage, jobsPagination.perPage);
  };

  const handleSortModeChange = (newSortMode: "updated-at" | "created-at") => {
    setSortMode(newSortMode);
    // Reset to page 1 when changing sort mode
    setCandidatesPagination(prev => ({ ...prev, currentPage: 1 }));
    setJobsPagination(prev => ({ ...prev, currentPage: 1 }));
  };


  return (
    <div className="w-full px-4 py-4">
      <Card className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Import</h1>
            <div className="text-md text-muted-foreground">
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={sortMode} onValueChange={handleSortModeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated-at">Last Updated</SelectItem>
                <SelectItem value="created-at">Date Created</SelectItem>
              </SelectContent>
            </Select>
            
          
            <Button 
              onClick={handleImport}
              disabled={totalSelected === 0 || candidatesLoading || jobsLoading}
            >
              Import Selected ({totalSelected})
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "candidates" | "jobs")} className="w-full">
          <div className="border-b">
            <div className="flex items-center justify-between">
              <TabsList className="h-auto p-0 bg-transparent">
                <TabsTrigger 
                  value="candidates" 
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  Candidates
                  {selectedCandidateIds.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedCandidateIds.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="jobs" 
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3"
                >
                  Jobs
                  {selectedJobIds.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedJobIds.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <div className="text-sm text-muted-foreground px-6">
                {activeTab === "candidates" ? (
                  `Showing ${candidatesData.length} of ${candidatesPagination.totalCount} candidates`
                ) : (
                  `Showing ${jobsData.length} of ${jobsPagination.totalCount} jobs`
                )}
              </div>
            </div>
          </div>

          <TabsContent value="candidates" className="m-0">
            <CandidatesTable
              data={candidatesData}
              isLoading={candidatesLoading}
              pagination={candidatesPagination}
              selectedIds={selectedCandidateIds}
              onSelectionChange={setSelectedCandidateIds}
              onPageChange={(page, perPage) => loadCandidates(page, perPage)}
            />
          </TabsContent>

          <TabsContent value="jobs" className="m-0">
            <JobsTable
              data={jobsData}
              isLoading={jobsLoading}
              pagination={jobsPagination}
              selectedIds={selectedJobIds}
              onSelectionChange={setSelectedJobIds}
              onPageChange={(page, perPage) => loadJobs(page, perPage)}
            />
          </TabsContent>
        </Tabs>
      </Card>

      <ImportConfirmationDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        selectedCandidateIds={selectedCandidateIds}
        selectedJobIds={selectedJobIds}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
