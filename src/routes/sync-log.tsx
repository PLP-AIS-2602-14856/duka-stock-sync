import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTime, runSyncNow, syncLogsQuery, timeAgo } from "@/lib/inventory";

export const Route = createFileRoute("/sync-log")({
  head: () => ({
    meta: [
      { title: "Sync Log — Duka Sync wholesale inventory" },
      {
        name: "description",
        content:
          "Full history of the 5-minute warehouse stock polling runs: timestamps, rows updated, duration and errors.",
      },
      { property: "og:title", content: "Sync Log — Duka Sync wholesale inventory" },
      {
        property: "og:description",
        content: "Audit every warehouse polling cycle with timestamps, rows updated and errors.",
      },
    ],
  }),
  component: SyncLogPage,
});

function SyncLogPage() {
  const qc = useQueryClient();
  const { data: logs = [], isLoading } = useQuery({ ...syncLogsQuery, refetchInterval: 30000 });

  const run = useMutation({
    mutationFn: runSyncNow,
    onSuccess: (result) => {
      toast.success(`Sync complete — ${result.items_updated ?? 0} stock rows updated`);
      qc.invalidateQueries({ queryKey: ["sync_log"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Sync Log"
      description="Poll history of the simulated warehouse system (every 5 minutes)"
      actions={
        <Button onClick={() => run.mutate()} disabled={run.isPending} variant="outline">
          <RefreshCw className={`size-4 ${run.isPending ? "animate-spin" : ""}`} />
          Run sync now
        </Button>
      }
    >
      <p className="text-muted-foreground mb-4 max-w-2xl text-sm">
        A scheduled job polls the mock warehouse system every 5 minutes, applies small stock
        fluctuations (±5 units per row) to mimic real warehouse activity, and records the run below.
        Each row is one poll cycle — kept for documentation and troubleshooting.
      </p>

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ran at</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Rows updated</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Loading sync history…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No sync runs recorded yet — the scheduled job runs every 5 minutes, or trigger one
                  now.
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="text-sm">{dateTime(log.run_at)}</div>
                  <div className="text-muted-foreground text-xs">{timeAgo(log.run_at)}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={log.status === "success" ? "secondary" : "destructive"}>
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="tabular text-right">{log.items_updated}</TableCell>
                <TableCell className="tabular text-right">{log.duration_ms} ms</TableCell>
                <TableCell className="text-muted-foreground max-w-96 text-xs">
                  {log.notes}
                  {log.error && <span className="text-destructive block">Error: {log.error}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
