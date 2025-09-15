/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { formatDate, formatDuration, formatShortDate, timeAgo } from "@/lib/format";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskDetailsDialog } from "@/features/tasks/components/task-details-dialog";
import { TaskTableRow } from "@/components/tasks/task-table-row";
import { Badge } from "@/components/ui/badge";
import { Doc, Id } from "@/types";

const POOLS = ["import", "build", "embed", "match"] as const;

export default function TasksPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [range, setRange] = useState<DateRange | undefined>(() => {
		const now = new Date();
		const from = new Date(now);
		from.setDate(from.getDate() - 7);
		return { from, to: now };
	});
	const [poolFilter, setPoolFilter] = useState<string | "all">("all");

	// Display statuses (align with Vercel-style wording)
	const FILTER_STATUSES = ["queued", "running", "succeeded", "failed", "canceled"] as const;
	const STATUS_LABELS: Record<string, string> = {
		queued: "Queued",
		running: "Running",
		succeeded: "Succeeded",
		failed: "Failed",
		canceled: "Canceled",
	};

	const [statusFilter, setStatusFilter] = useState<Set<string>>(() => new Set(FILTER_STATUSES));

	// Get selected task ID from URL params
	const selectedTaskId = searchParams.get('taskId') as Id<"tasks"> | null;

	// Fetch the selected task with real-time updates
	const selectedTask = useQuery(
		api.tasks.get,
		selectedTaskId ? { taskId: selectedTaskId } : "skip"
	);



	const { results, status, loadMore } = usePaginatedQuery(
		api.tasks.listPaginated,
		{
			workpool: poolFilter,
			status: Array.from(statusFilter),
		},
		{ initialNumItems: 50 }
	)

	const totalCount = useQuery(api.tasks.getFilteredTasksCount, {
		workpool: poolFilter,
		status: Array.from(statusFilter),
	});

	// Functions to handle task selection with URL updates
	const openTaskDialog = (taskId: Id<"tasks">) => {
		const params = new URLSearchParams(searchParams);
		params.set('taskId', taskId);
		router.push(`/tasks?${params.toString()}`);
	};

	const closeTaskDialog = () => {
		const params = new URLSearchParams(searchParams);
		params.delete('taskId');
		const newUrl = params.toString() ? `/tasks?${params.toString()}` : '/tasks';
		router.push(newUrl);
	};



	function SkeletonRow() {
		return (
			<TableRow>
				<TableCell className="whitespace-nowrap">
					<Skeleton className="h-4 w-16" />
				</TableCell>
				<TableCell className="whitespace-nowrap">
					<Skeleton className="h-4 w-24" />
				</TableCell>
				<TableCell className="whitespace-nowrap">
					<Skeleton className="h-4 w-20" />
				</TableCell>
				<TableCell className="whitespace-nowrap">
					<Skeleton className="h-4 w-32" />
				</TableCell>
				<TableCell className="whitespace-nowrap">
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-2">
							<Skeleton className="h-2.5 w-2.5 rounded-full" />
							<Skeleton className="h-4 w-16" />
						</div>
						<Skeleton className="h-3 w-20" />
					</div>
				</TableCell>
				<TableCell className="text-right">
					<Skeleton className="h-8 w-8 rounded" />
				</TableCell>
			</TableRow>
		);
	}


	return (
		<div className="w-full px-4 py-4">
			<Card className="max-w-7xl mx-auto">
				<div className="flex flex-wrap items-center justify-between p-4 border-b">
					<div className="flex items-center gap-4">
						<h1 className="text-lg font-semibold">Tasks</h1>
						<div className="text-md text-muted-foreground">
							<span>
								{status === "LoadingFirstPage" ? (
									<Skeleton className="h-4 w-16" />
								) : (
									<>
										{results.length} of {totalCount}
									</>
								)}
							</span>
						</div>
					</div>
					<div className="flex items-center gap-2">

						<Select value={poolFilter} onValueChange={setPoolFilter}>
							<SelectTrigger className="w-[120px]" size="sm">
								<SelectValue placeholder="Pool" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								{POOLS.map((p) => (
									<SelectItem key={p} value={p}>{p}</SelectItem>
								))}
							</SelectContent>
						</Select>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm" className="flex items-center gap-2">
									<span>Status</span>
									<div className="flex -space-x-1">
										{Array.from(statusFilter).map((status, index) => (
											<span
												key={`${status}-${index}`}
												className={`inline-block size-2.5 rounded-full ${
													{
														queued: "bg-yellow-500",
														running: "bg-blue-500", 
														succeeded: "bg-emerald-400",
														failed: "bg-red-500",
														canceled: "bg-neutral-400"
													}[status]
												}`}
												style={{ zIndex: statusFilter.size - index }}
											/>
										))}
									</div>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-44">
								<DropdownMenuLabel>Filter by status</DropdownMenuLabel>
								<DropdownMenuSeparator />
								{(FILTER_STATUSES as readonly string[]).map((s) => (
									<DropdownMenuCheckboxItem
										key={s}
										checked={statusFilter.has(s)}
										onCheckedChange={(checked) => {
											setStatusFilter((prev) => {
												const next = new Set(prev);
												if (checked) next.add(s); else next.delete(s);
												return next;
											});
										}}
									>
										<span className={`inline-block size-2 rounded-full mr-2 ${{ queued: "bg-yellow-500", running: "bg-blue-500", succeeded: "bg-green-500", failed: "bg-red-500", canceled: "bg-neutral-400" }[s]
											}`}></span>
										{STATUS_LABELS[s]}
									</DropdownMenuCheckboxItem>
								))}
								<DropdownMenuSeparator />
								<div className="px-2 py-1.5 flex gap-2">
									<Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setStatusFilter(new Set(FILTER_STATUSES as readonly string[]))}>All</Button>
									<Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setStatusFilter(new Set())}>Clear</Button>
								</div>
							</DropdownMenuContent>
						</DropdownMenu>
						<DateRangePicker date={range} onDateChange={setRange} />
					</div>
				</div>
				<div className="max-h-[75vh] overflow-y-auto">
					<Table >
						<TableBody >
							{status === "LoadingFirstPage" ? (
								<>
									{Array.from({ length: 5 }).map((_, i) => (
										<SkeletonRow key={i} />
									))}
								</>
							) : (
								results.map((task) => (
									<TaskTableRow
										key={String(task._id)}
										task={task}
										onTaskClick={openTaskDialog}
										openTaskDialog={openTaskDialog}
									/>
								))
							)}
							{status === "LoadingMore" && (
								<TableRow>
									<TableCell colSpan={6} className="p-4 text-center">
										<div className="flex items-center justify-center gap-2">
											<div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent" />
											<span className="text-sm text-neutral-500">Loading more tasks...</span>
										</div>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</Card>

			{selectedTask && (
				<TaskDetailsDialog
					task={selectedTask}
					onClose={closeTaskDialog}
					onTaskClick={openTaskDialog}
				/>
			)}
		</div>
	);
}


