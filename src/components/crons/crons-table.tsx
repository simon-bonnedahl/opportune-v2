"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

// Define the cron type based on typical Convex crons structure
interface Cron {
  _id: string;
  name?: string;
  schedule?: {
    kind: string;
    ms?: number;
    cron?: string;
  };
  state?: string;
  nextRun?: number;
  lastRun?: number;
  createdAt?: number;
}

interface CronsTableProps {
  crons: Cron[];
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <Skeleton className="h-4 w-32" />
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
        <Skeleton className="h-4 w-32" />
      </TableCell>
    </TableRow>
  );
}

export function CronsTable({ crons }: CronsTableProps) {
  const formatSchedule = (schedule?: Cron['schedule']) => {
    if (!schedule) return "-";
    
    if (schedule.kind === "interval" && schedule.ms) {
      const seconds = Math.floor(schedule.ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      if (days > 0) return `Every ${days} day${days > 1 ? 's' : ''}`;
      if (hours > 0) return `Every ${hours} hour${hours > 1 ? 's' : ''}`;
      if (minutes > 0) return `Every ${minutes} minute${minutes > 1 ? 's' : ''}`;
      return `Every ${seconds} second${seconds > 1 ? 's' : ''}`;
    }
    
    if (schedule.kind === "cron" && schedule.cron) {
      return schedule.cron;
    }
    
    return schedule.kind;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-";
    return format(new Date(timestamp), "MMM dd, yyyy HH:mm");
  };

  const getStateColor = (state?: string) => {
    switch (state) {
      case "active":
        return "bg-green-500";
      case "paused":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="flex flex-col h-[75vh]">
      <div className="flex-shrink-0">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-64">Name</TableHead>
              <TableHead className="w-64">Schedule</TableHead>
              <TableHead className="w-32">State</TableHead>
              <TableHead className="w-32">Next Run</TableHead>
              <TableHead className="w-32">Last Run</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <Table className="w-full table-fixed">
          <TableBody>
            {crons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No crons found
                </TableCell>
              </TableRow>
            ) : (
              crons.map((cron) => (
                <TableRow key={cron._id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-xs truncate max-w-[280px]">
                    {cron.name || cron._id}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatSchedule(cron.schedule)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block size-2.5 rounded-full ${getStateColor(cron.state)}`} />
                      <span className="capitalize">{cron.state || "unknown"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(cron.nextRun)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(cron.lastRun)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
