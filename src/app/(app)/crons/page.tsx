"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { FunctionReturnType } from "convex/server";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CronsTable } from "@/components/crons/crons-table";
import { CreateCronDialog } from "@/components/crons/create-cron-dialog";

// Extract the return type from the query


export default function CronsPage() {
  const crons = useQuery(api._crons.listWithTasks);

  return (
    <div className="w-full px-4 py-4">
      <Card className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Crons</h1>
            <div className="text-md text-muted-foreground">
              {crons ? (
                <span>{crons.length} cron{crons.length !== 1 ? 's' : ''}</span>
              ) : (
                <Skeleton className="h-4 w-16" />
              )}
            </div>
          </div>
          <CreateCronDialog />
        </div>
        <div className="max-h-[75vh] overflow-y-auto">
          {crons ? (
            <CronsTable crons={crons} />
          ) : (
            <div className="p-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
