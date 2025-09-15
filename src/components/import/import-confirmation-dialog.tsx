"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface ImportConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCandidateIds: string[];
  selectedJobIds: string[];
  onImportComplete: () => void;
}

export function ImportConfirmationDialog({
  open,
  onOpenChange,
  selectedCandidateIds,
  selectedJobIds,
  onImportComplete,
}: ImportConfirmationDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  
  const importCandidates = useAction(api.candidates.addMany);
  const importJobs = useAction(api.jobs.addMany);

  const handleImport = async () => {
    setIsImporting(true);
    
    try {
      const promises = [];
      
      if (selectedCandidateIds.length > 0) {
        promises.push(
          importCandidates({ teamtailorIds: selectedCandidateIds })
            .then(() => toast.success(`Imported ${selectedCandidateIds.length} candidates`))
        );
      }
      
      if (selectedJobIds.length > 0) {
        promises.push(
          importJobs({ teamtailorIds: selectedJobIds })
            .then(() => toast.success(`Imported ${selectedJobIds.length} jobs`))
        );
      }

      await Promise.all(promises);
      
      toast.success("Import completed successfully!");
      onImportComplete();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import items");
    } finally {
      setIsImporting(false);
    }
  };

  const totalItems = selectedCandidateIds.length + selectedJobIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirm Import</DialogTitle>
          <DialogDescription>
            You are about to import {totalItems} item{totalItems !== 1 ? 's' : ''} from TeamTailor.
            This will create import tasks in the background.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {selectedCandidateIds.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Candidates</p>
                <p className="text-sm text-muted-foreground">
                  Will be processed and added to your database
                </p>
              </div>
              <Badge variant="secondary">
                {selectedCandidateIds.length}
              </Badge>
            </div>
          )}
          
          {selectedJobIds.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Jobs</p>
                <p className="text-sm text-muted-foreground">
                  Will be processed and added to your database
                </p>
              </div>
              <Badge variant="secondary">
                {selectedJobIds.length}
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || totalItems === 0}
          >
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isImporting ? "Importing..." : "Start Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
