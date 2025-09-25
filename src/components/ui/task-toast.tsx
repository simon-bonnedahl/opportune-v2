"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "@/lib/convex";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

interface TaskToastProps {
  taskId: Id<"tasks">;
  title: string;
  toastId?: string;
}

export function TaskToast({ taskId, title, toastId }: TaskToastProps) {
  const task = useQuery(api.tasks.get, { taskId });

  // Auto-dismiss when task completes or fails
  useEffect(() => {
    if (task?.status === "succeeded" || task?.status === "failed") {
      const timer = setTimeout(() => {
        if (toastId) {
          toast.dismiss(toastId);
        }
      }, 5000); // Increased to 5 seconds for better UX
      return () => clearTimeout(timer);
    }
  }, [task?.status, toastId]);

  if (!task) return null;

  const getStatusIcon = () => {
    switch (task.status) {
      case "queued":
        return <Icons.clock className="h-4 w-4 text-muted-foreground" />;
      case "running":
        return <Icons.spinner className="h-4 w-4 animate-spin text-blue-500" />;
      case "succeeded":
        return <Icons.check className="h-4 w-4 text-green-500" />;
      case "failed":
        return <Icons.warning className="h-4 w-4 text-red-500" />;
      case "canceled":
        return <Icons.close className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Icons.clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (task.status) {
      case "queued":
        return "Queued";
      case "running":
        return "Running";
      case "succeeded":
        return "Completed";
      case "failed":
        return "Failed";
      case "canceled":
        return "Canceled";
      default:
        return "Unknown";
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case "queued":
        return "text-muted-foreground";
      case "running":
        return "text-blue-600";
      case "succeeded":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      case "canceled":
        return "text-muted-foreground";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="w-full max-w-sm min-h-[3rem]">
      {/* Header with title and status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-sm">{title}</span>
        </div>
        <span className={cn("text-xs font-medium", getStatusColor())}>
          {getStatusText()}
        </span>
      </div>

      {/* Progress bar for running tasks */}
      {task.status === "running" && typeof task.progress === "number" && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-1.5" />
        </div>
      )}

      {/* Status messages - compact inline format */}
      {task.status === "succeeded" && (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <Icons.check className="h-3 w-3" />
          <span>Completed successfully</span>
        </div>
      )}

      {task.status === "failed" && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <Icons.warning className="h-3 w-3" />
          <span>Failed to complete</span>
        </div>
      )}

      {task.status === "canceled" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icons.close className="h-3 w-3" />
          <span>Canceled</span>
        </div>
      )}

      {task.status === "queued" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icons.clock className="h-3 w-3" />
          <span>Queued</span>
        </div>
      )}
    </div>
  );
}
