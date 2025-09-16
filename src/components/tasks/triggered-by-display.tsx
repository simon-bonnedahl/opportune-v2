import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatShortDate } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Doc, Id } from "@/lib/convex";

interface TriggeredByDisplayProps {
  task: Doc<"tasks">;
  onTaskClick?: (taskId: Id<"tasks">) => void;
  className?: string;
  showDate?: boolean;
}

export function TriggeredByDisplay({ task, onTaskClick, className = "", showDate = false }: TriggeredByDisplayProps) {
  // Fetch user information if triggeredBy is "user"
  const user = useQuery(
    api.users.getById,
    task.triggeredBy === "user" && task.triggeredById ? { userId: task.triggeredById as Id<"users"> } : "skip"
  );

  // Fetch task information if triggeredBy is "task"
  const triggeredTask = useQuery(
    api.tasks.get,
    task.triggeredBy === "task" && task.triggeredById ? { taskId: task.triggeredById as Id<"tasks"> } : "skip"
  );

  function renderContent() {
    const dateStr = showDate && task._creationTime ? formatShortDate(task._creationTime) : "";
    const byPrefix = dateStr ? ` by ` : "";
    
    if (!task.triggeredBy) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {dateStr}
            {byPrefix}
            <span className="text-muted-foreground">System</span>
          </span>
        </div>
      );
    }

    if (task.triggeredBy === "user") {
      if (user) {
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground  ">
              {dateStr}
              {byPrefix}
              <span>{user.name}</span>
             
            </span>
            <Avatar className="size-6">
                <AvatarImage src={user.imageUrl} />
                <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
          </div>
        );
      } else {
        // Loading state
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {dateStr}
              {byPrefix}
              <span className="text-muted-foreground">Loading...</span>
            </span>
          </div>
        );
      }
    }

    if (task.triggeredBy === "task" && task.triggeredById) {
      const taskType = triggeredTask?.type || "task";
      const buttonContent = (
        <span className="text-sm text-muted-foreground">
          {dateStr}
          {byPrefix}
          <span className="underline hover:text-primary hover:cursor-pointer">
            {taskType} task
          </span>
        </span>
      );

      if (onTaskClick) {
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTaskClick(task.triggeredById as Id<"tasks">);
            }}
          >
            {buttonContent}
          </button>
        );
      } else {
        return buttonContent;
      }
    }

    // For "cron", "system", or other trigger types
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {dateStr}
          {byPrefix}
          <span className="capitalize">{task.triggeredBy}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      {renderContent()}
    </div>
  );
}
