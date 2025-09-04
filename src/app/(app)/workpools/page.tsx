"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/format";

const POOLS = ["import", "build", "embed", "match"] as const;

export default function WorkpoolsPage() {
  const [pool, setPool] = useState<(typeof POOLS)[number]>("import");
  const pending = useQuery(api.tasks.listQueue as any, { workpoolName: pool, limit: 100 } as any) as any[] | undefined;
  const running = useQuery(api.tasks.listRunning as any, { workpoolName: pool, limit: 100 } as any) as any[] | undefined;
  const completed = useQuery(api.tasks.listCompleted as any, { workpoolName: pool, limit: 100 } as any) as any[] | undefined;
  const pendingByType = useQuery(api.tasks.listQueueByType as any, { workpoolName: pool, taskType: pool, limit: 100 } as any) as any[] | undefined;
  const runningByType = useQuery(api.tasks.listRunningByType as any, { workpoolName: pool, taskType: pool, limit: 100 } as any) as any[] | undefined;
  const overview = useQuery(api.tasks.getWorkpoolOverview as any, {} as any) as any | undefined;
  const pendingItems = (pendingByType && pendingByType.length > 0 ? pendingByType : (pending ?? []));
  const runningItems = (runningByType && runningByType.length > 0 ? runningByType : (running ?? []));
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-4">Workpools</h1>
      <Tabs value={pool} onValueChange={(v) => setPool(v as any)} className="w-full">
        <TabsList className="mb-4">
          {POOLS.map((p) => (
            <TabsTrigger key={p} value={p} className="capitalize">{p}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={pool} className="m-0">
          <div className="flex items-center gap-3 mb-4 text-xs">
            <Badge variant="secondary">Pending: {overview ? (overview as any)[pool]?.pending ?? 0 : "-"}</Badge>
            <Badge variant="secondary">Running: {overview ? (overview as any)[pool]?.running ?? 0 : "-"}</Badge>
            <Badge variant="secondary">Finished: {overview ? (overview as any)[pool]?.finished ?? 0 : "-"}</Badge>
            <Badge variant="secondary">Failed: {overview ? (overview as any)[pool]?.failed ?? 0 : "-"}</Badge>
            <Badge variant="secondary">Canceled: {overview ? (overview as any)[pool]?.canceled ?? 0 : "-"}</Badge>
            <Badge variant="secondary">Paused: {overview ? (overview as any)[pool]?.paused ?? 0 : "-"}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Panel title="Pending" items={pendingItems} />
            <Panel title="Running" items={runningItems} />
            <Panel title="Completed" items={completed ?? []} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Panel({ title, items }: { title: string; items: any[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">None</div>
        ) : (
          <ScrollArea className="h-[70vh] pr-4 md:pr-6">
            <div className="space-y-2">
              {items.map((it) => <Row key={it._id} it={it} />)}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ it }: { it: any }) {
  const created = it.createdAt ? formatDate(it.createdAt, { month: "short" }) : "";
  const finished = it.finishedAt ? formatDate(it.finishedAt, { month: "short" }) : "";
  const args = it.argsSummary ?? it.args ?? {};
  return (
    <div className="w-full overflow-hidden border rounded p-3 bg-card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="px-1 py-0 text-[10px] capitalize">{it.workpoolName}</Badge>
          <span>·</span>
          <span>{it.taskType ?? it.fnType}</span>
        </div>
        <div className="text-[10px] text-muted-foreground">{finished || created}</div>
      </div>
      <div className="min-w-0 font-medium truncate mt-1">{it.fnName || it.fnType}</div>
      <div className="text-xs text-muted-foreground break-words">{JSON.stringify(args)}</div>
      {typeof it.progress === "number" && (
        <div className="mt-2">
          <Progress value={Math.max(0, Math.min(100, it.progress))} />
          {it.progressMessage ? (
            <div className="text-[10px] text-muted-foreground mt-1">{it.progressMessage}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}


