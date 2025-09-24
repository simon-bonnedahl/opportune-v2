"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "@/lib/convex";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface ProgressToastProps {
  taskId: Id<"tasks">;
  title: string;
  toastId?: string;
}

export function ProgressToast({ taskId, title, toastId }: ProgressToastProps) {
  const task = useQuery(api.tasks.get, { taskId });

  // Auto-dismiss when task completes or fails
  useEffect(() => {
    if (task?.status === "succeeded" || task?.status === "failed") {
      const timer = setTimeout(() => {
        if (toastId) {
          toast.dismiss(toastId);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [task?.status, toastId]);

  if (!task) return null;

  return (
    <div className="w-full max-w-sm">
      {/* Progress bar */}
      {task.status === "running" && typeof task.progress === "number" && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-1" />
        </div>
      )}
    </div>
  );
}
