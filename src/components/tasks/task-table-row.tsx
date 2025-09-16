import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ExternalLink } from "lucide-react";
import { formatDuration, timeAgo } from "@/lib/format";
import { Doc, Id } from "@/lib/convex";
import { Context, ContextContentFooter, ContextCacheUsage, ContextInputUsage, ContextContent, ContextContentBody, ContextContentHeader, ContextTrigger, ContextOutputUsage, ContextReasoningUsage } from "@/components/ai-elements/context";
import { TriggeredByDisplay } from "./triggered-by-display";
import Image from "next/image";

interface TaskTableRowProps {
  task: Doc<"tasks">;
  onTaskClick: (taskId: Id<"tasks">) => void;
  openTaskDialog: (taskId: Id<"tasks">) => void;
}

// Map task.status -> display status
const TASK_TO_DISPLAY: Record<string, "queued" | "running" | "succeeded" | "failed" | "canceled"> = {
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  canceled: "canceled",
};

export function TaskTableRow({ task, onTaskClick, openTaskDialog }: TaskTableRowProps) {

  function renderStatusCell(task: Doc<"tasks">) {
    const disp = TASK_TO_DISPLAY[String(task.status)] ?? "";
    const color = disp === "succeeded" ? "bg-emerald-400" : disp === "failed" ? "bg-red-500" : disp === "running" ? "bg-blue-500 animate-pulse" : disp === "queued" ? "bg-yellow-500" : "bg-neutral-400";
    const label = disp === "queued" ? "Queued" : disp === "running" ? "Running" : disp === "succeeded" ? "Succeeded" : disp === "failed" ? "Failed" : "Canceled";
    const isCompleted = disp === "succeeded" || disp === "failed" || disp === "canceled";
    const primaryEnd = isCompleted ? task.stoppedAt : task.runAt;
    const primaryStart = task.runAt;
    const secondaryAgo = isCompleted ? task.stoppedAt : task.runAt;
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`inline-block size-2.5 rounded-full ${color}`} />
          <span className="text-sm">{label}</span>
        </div>
        {isCompleted && (
          <div className="text-xs text-neutral-400">
            {formatDuration(primaryStart, primaryEnd)} {secondaryAgo ? `(${timeAgo(secondaryAgo)})` : ""}
          </div>
        )}
      </div>
    );
  }


  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onTaskClick(task._id)}
    >
      <TableCell className="capitalize whitespace-nowrap">{task.workpool}</TableCell>
      <TableCell className="font-mono text-xs truncate max-w-[280px]">{task._id}</TableCell>
      <TableCell className="whitespace-nowrap">{task.type ?? "-"}</TableCell>
      <TableCell className="whitespace-nowrap">{renderStatusCell(task)}</TableCell>
      <TableCell className="whitespace-nowrap">
        <TriggeredByDisplay task={task} onTaskClick={openTaskDialog} showDate={true} />
      </TableCell>
      

      <TableCell className="w-16 text-right">
        {task.metadata?.totalUsage && (
          <div className="space-y-4">
            <Context
              usedTokens={task.metadata.totalUsage.totalTokens}
              maxTokens={task.metadata.model === 'gpt-5' ? 200000 : 128000}
              usage={task.metadata.totalUsage}
              modelId={task.metadata.modelId}
            >
              <ContextTrigger>
                <Image
                  src="/images/openai_logo.webp"
                  alt="OpenAI"
                  width={24}
                  height={24}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                />
              </ContextTrigger>
              <ContextContent>
                <ContextContentHeader />
                <ContextContentBody>
                  <div className="space-y-2">
                    <ContextInputUsage />
                    <ContextOutputUsage />
                    <ContextReasoningUsage />
                    <ContextCacheUsage />
                  </div>
                </ContextContentBody>
                <ContextContentFooter />
              </ContextContent>
            </Context>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openTaskDialog(task._id)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
