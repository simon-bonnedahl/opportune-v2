"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadialProgress } from "@/components/ui/radial-progress";
import { 
	Clock, 
	User, 
	Activity, 
	AlertCircle, 
	Copy, 
	Play, 
	Square, 
	RefreshCcw,
	Calendar
} from "lucide-react";
import { formatDate, formatDuration, formatShortDate } from "@/lib/format";
import { Doc } from "@/types";
import { useAction } from "convex/react";
import { api } from "@/lib/convex";
import { 
	Context, 
	ContextTrigger, 
	ContextContent, 
	ContextContentHeader,
	ContextContentBody,
	ContextContentFooter,
	ContextInputUsage,
	ContextOutputUsage,
	ContextReasoningUsage,
	ContextCacheUsage
} from "@/components/ai-elements/context";
import { TriggeredByDisplay } from "@/components/tasks/triggered-by-display";
import Image from "next/image";

const STATUS_LABELS = {
	queued: "Queued",
	running: "Running", 
	succeeded: "Succeeded",
	failed: "Failed",
	canceled: "Canceled"
} as const;

const STATUS_COLORS = {
	queued: "bg-yellow-500",
	running: "bg-blue-500",
	succeeded: "bg-green-500", 
	failed: "bg-red-500",
	canceled: "bg-gray-500"
} as const;

interface TaskDetailsDialogProps {
	task: Doc<"tasks">;
	onClose: () => void;
	onTaskClick?: (taskId: import("@/types").Id<"tasks">) => void;
}

export function TaskDetailsDialog({ task, onClose, onTaskClick }: TaskDetailsDialogProps) {
	if (!task) return null;

	const [currentTime, setCurrentTime] = useState(Date.now());

	const disp = task.status === "succeeded" ? "succeeded" : 
		task.status === "failed" ? "failed" : 
		task.status === "running" ? "running" : 
		task.status === "canceled" ? "canceled" : "queued";

	const statusColor = STATUS_COLORS[disp];

	// Update time every second for running tasks to show live duration
	useEffect(() => {
		if (task.status === "running") {
			// Update immediately when task becomes running
			setCurrentTime(Date.now());
			
			const interval = setInterval(() => {
				setCurrentTime(Date.now());
			}, 1000);

			return () => clearInterval(interval);
		}
	}, [task.status, task._id]);

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
	};

	const rerunTask = useAction(api.tasks.rerunTask);

	return (
		<Dialog open={!!task} onOpenChange={() => onClose()}>
			<DialogContent className="!max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0">
				<DialogHeader className="px-6 py-4 border-b bg-muted/30">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<span className={`inline-block size-3 rounded-full ${statusColor}`} />
							<div>
								<DialogTitle className="text-lg font-semibold">
									{task._id}
								</DialogTitle>
								<p className="text-sm text-muted-foreground">
									{task.type} • {task.workpool} pool
								</p>
							</div>
						</div>
						<div className="flex items-center gap-4">
							{/* Radial Progress */}
							<RadialProgress
								value={task.progress || 0}
								size={70}
								strokeWidth={5}
								showLabel={true}
								renderLabel={(value: number) => `${value}%`}
								progressClassName={disp === "succeeded" ? "stroke-green-500" : disp === "failed" ? "stroke-red-500" : "stroke-blue-500"}
								className="stroke-muted"
							/>
						</div>
					</div>
				</DialogHeader>
				
					<div className="p-6 space-y-8 pr-8">
						{/* Attempts and Duration Row */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="bg-muted/50 rounded-lg p-4">
								<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
									<Clock className="h-4 w-4" />
									Duration
								</div>
								<div className="text-lg font-semibold">
									{!task.runAt ? "Not started" : 
									 task.stoppedAt ? formatDuration(task.runAt, task.stoppedAt) : 
									 formatDuration(task.runAt, currentTime)}
								</div>
							</div> 
							<div className="bg-muted/50 rounded-lg p-4">
								<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
									<Calendar className="h-4 w-4" />
									Created
								</div>
								<div className="text-lg font-semibold">
									<TriggeredByDisplay task={task} onTaskClick={onTaskClick} showDate={true} />
								</div>
							</div>
							
						</div>

						{/* AI Usage */}
						{task.metadata?.totalUsage && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold flex items-center gap-2">
									<Activity className="h-5 w-5" />
									AI Usage
								</h3>
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
											width={32} 
											height={32} 
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

						{/* Arguments */}
						{task.args && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold flex items-center gap-2">
									<Copy className="h-5 w-5" />
									Arguments
								</h3>
								<div className="bg-muted/30 rounded-lg p-4">
									<pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono break-all">
										{JSON.stringify(task.args, null, 2)}
									</pre>
								</div>
							</div>
						)}

						
						{/* Error Details */}
						{task.errorMessage && (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold flex items-center gap-2">
									<AlertCircle className="h-5 w-5 text-red-500" />
									Error Details
								</h3>
								<div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-h-64 overflow-y-auto">
									<pre className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap font-mono">
										{task.errorMessage}
									</pre>
								</div>
							</div>
						)}
					</div>

				{/* Actions */}
				<div className="px-6 py-4 border-t bg-muted/30">
					<div className="flex items-center justify-end">
						<div className="flex items-center gap-1">
							{disp !== "running" && (
								<Button
									variant="default"
									className="bg-blue-500 hover:bg-blue-600 hover:cursor-pointer"
									onClick={async () => {
										try {
											await rerunTask({ taskId: task._id });
										} catch (e) {
											console.warn(e);
										}
									}}
								>
									<RefreshCcw className="h-4 w-4 " />
									Rerun
								</Button>
							)}
							{disp === "running" && (
								<Button
									variant="destructive"
									size="sm"
									onClick={() => {
										// TODO: Implement cancel functionality
										console.log("Cancel task:", task._id);
									}}
								>
									<Square className="h-4 w-4 mr-2" />
									Cancel Task
								</Button>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
