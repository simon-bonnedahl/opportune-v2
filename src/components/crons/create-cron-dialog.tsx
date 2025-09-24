"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Clock } from "lucide-react";
import { toast } from "sonner";
import { TaskType } from "../../../convex/types";

interface CreateCronDialogProps {
  onCronCreated?: () => void;
}

const TASK_TYPES = [
  {
    value: "teamtailor_sync",
    label: "Teamtailor Sync",
    description: "Sync candidates from Teamtailor based on update period"
  }
];

const SCHEDULE_PRESETS = [
  { label: "Every 5 minutes", value: 5 * 60 * 1000 },
  { label: "Every 15 minutes", value: 15 * 60 * 1000 },
  { label: "Every 30 minutes", value: 30 * 60 * 1000 },
  { label: "Every hour", value: 60 * 60 * 1000 },
  { label: "Every 6 hours", value: 6 * 60 * 60 * 1000 },
  { label: "Every 12 hours", value: 12 * 60 * 60 * 1000 },
  { label: "Every day", value: 24 * 60 * 60 * 1000 },
];

const RELATIVE_PERIODS = [
  { label: "Last 1 hour", value: 1 * 60 * 60 * 1000 },
  { label: "Last 6 hours", value: 6 * 60 * 60 * 1000 },
  { label: "Last 12 hours", value: 12 * 60 * 60 * 1000 },
  { label: "Last 24 hours", value: 24 * 60 * 60 * 1000 },
  { label: "Last 3 days", value: 3 * 24 * 60 * 60 * 1000 },
  { label: "Last 7 days", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "Last 30 days", value: 30 * 24 * 60 * 60 * 1000 },
];

export function CreateCronDialog({ onCronCreated }: CreateCronDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("sync");
  const [scheduleMs, setScheduleMs] = useState<number>(0);
  const [relativePeriod, setRelativePeriod] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);

  const createTaskCron = useMutation(api._crons.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !taskType || !scheduleMs || !relativePeriod) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsCreating(true);
    
    try {
      const updatedAtTT = Date.now() - relativePeriod;
      
      await createTaskCron({
        name: name.trim(),
        taskType,
        args: {
          timeAgo: relativePeriod,
        },
        scheduleMs,
      });

      toast.success("Cron created successfully!");
      setOpen(false);
      setName("");
      setTaskType("sync");
      setScheduleMs(0);
      setRelativePeriod(0);
      onCronCreated?.();
    } catch (error) {
      toast.error("Failed to create cron: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Cron
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Cron</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Cron Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Teamtailor Sync"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taskType">Task Type</Label>
            <Select value={taskType} onValueChange={(value) => setTaskType(value as TaskType)} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a task type" />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {taskType === "sync" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Teamtailor Sync Configuration</CardTitle>
                <CardDescription>
                  Configure what data to sync from Teamtailor
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="relativePeriod">Sync Period</Label>
                  <Select value={relativePeriod.toString()} onValueChange={(value) => setRelativePeriod(Number(value))} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sync period" />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIVE_PERIODS.map((period) => (
                        <SelectItem key={period.value} value={period.value.toString()}>
                          {period.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Candidates updated within this period will be synced
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule</Label>
            <Select value={scheduleMs.toString()} onValueChange={(value) => setScheduleMs(Number(value))} required>
              <SelectTrigger>
                <SelectValue placeholder="Select schedule frequency" />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value.toString()}>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {preset.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Cron"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
