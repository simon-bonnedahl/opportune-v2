"use client";

import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Play, ExternalLink } from "lucide-react";
import { formatDuration, timeAgo, formatShortDate } from "@/lib/format";

const TASK_TO_DISPLAY = {
	"queued": "queued",
	"running": "running", 
	"succeeded": "succeeded",
	"failed": "failed",
	"canceled": "canceled"
} as const;

interface TaskTableRowProps {
	task: any;
	onSelect: (task: any) => void;
	onRerun: (args: { taskId: string }) => Promise<void>;
}

export function TaskTableRow({ task, onSelect, onRerun }: TaskTableRowProps) {
	const disp = TASK_TO_DISPLAY[String(task.status) as keyof typeof TASK_TO_DISPLAY] ?? "";
	const color = disp === "succeeded" ? "bg-emerald-400" : disp === "failed" ? "bg-red-500" : disp === "running" ? "bg-blue-500" : disp === "queued" ? "bg-yellow-500" : "bg-neutral-400";
	const label = disp === "queued" ? "Queued" : disp === "running" ? "Running" : disp === "succeeded" ? "Succeeded" : disp === "failed" ? "Failed" : "Canceled";
	
	// For running tasks, use current time for live duration calculation
	const isRunning = disp === "running";
	const primaryEnd = disp === "succeeded" || disp === "failed" || disp === "canceled" ? task.finishedAt : 
		isRunning ? Date.now() : task.startedAt;
	const primaryStart = isRunning ? task.startedAt : task.createdAt;
	// Only show time ago for completed tasks, not running or queued
	const secondaryAgo = (disp === "succeeded" || disp === "failed" || disp === "canceled") ? task.finishedAt : null;

	function renderStatusCell() {
		const isCompleted = disp === "succeeded" || disp === "failed" || disp === "canceled";
		
		return (
			<div className="flex flex-col">
				<div className="flex items-center gap-2">
					<span className={`inline-block size-2.5 rounded-full ${color}`} />
					<span className="text-sm">{label}</span>
				</div>
				<div className="text-xs text-neutral-400">
					{formatDuration(primaryStart, primaryEnd)} 
					{isCompleted && secondaryAgo ? ` (${timeAgo(secondaryAgo)})` : ""}
					{isRunning && !task.finishedAt ? " (running...)" : ""}
				</div>
			</div>
		);
	}

	return (
		<TableRow 
			className="cursor-pointer hover:bg-muted/50"
			onClick={() => onSelect(task)}
		>
			<TableCell className="capitalize whitespace-nowrap">{task.workpoolName}</TableCell>
			<TableCell className="font-mono text-xs truncate max-w-[280px]">{task.taskId}</TableCell>
			<TableCell className="whitespace-nowrap">{task.taskType ?? "-"}</TableCell>
			<TableCell className="whitespace-nowrap">{task.requestedBy ?? "-"}</TableCell>
			<TableCell className="whitespace-nowrap text-sm text-muted-foreground">
				{task.createdAt ? formatShortDate(task.createdAt) : "-"}
			</TableCell>
			<TableCell className="whitespace-nowrap">{renderStatusCell()}</TableCell>
			<TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => onSelect(task)}>
							<ExternalLink className="h-4 w-4 mr-2" />
							View Details
						</DropdownMenuItem>
						<DropdownMenuItem onClick={async () => {
							try {
								await onRerun({ taskId: task.taskId });
							} catch (e) {
								console.warn(e);
							}
						}}>
							<Play className="h-4 w-4 mr-2" />
							Rerun
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</TableCell>
		</TableRow>
	);
}
