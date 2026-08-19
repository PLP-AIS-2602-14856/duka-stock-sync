import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Building2, ClipboardList, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  itemsQuery,
  ordersQuery,
  stockQuery,
  syncLogsQuery,
  timeAgo,
  warehousesQuery,
} from "@/lib/inventory";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Duka Sync — wholesale inventory for Kenyan dukas" },
      {
        name: "description",
        content:
          "Real-time stock availability across regional warehouses so retail kiosks can order with confidence. Items, stock, orders and sync history in one dashboard.",
      },
      { property: "og:title", content: "Duka Sync — wholesale inventory for Kenyan dukas" },
      {
        property: "og:description",
        content:
          "Warehouse stock, duka order requests and 5-minute sync history for a Kenyan wholesale distributor.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { data: items = [] } = useQuery(itemsQuery);
  const { data: warehouses = [] } = useQuery(warehousesQuery);
  const { data: stock = [] } = useQuery({ ...stockQuery, refetchInterval: 30000 });
  const { data: orders = [] } = useQuery(ordersQuery);
  const { data: logs = [] } = useQuery(syncLogsQuery);

  const pending = orders.filter((o) => o.status === "pending").length;
  const lowStock = stock.filter((s) => s.quantity_available < 20);
  const lastSync = logs[0];

  const tiles = [
    { label: "Active items", value: items.filter((i) => !i.discontinued).length, to: "/items", icon: Boxes },
    { label: "Warehouses", value: warehouses.length, to: "/warehouses", icon: Building2 },
    { label: "Pending orders", value: pending, to: "/orders", icon: ClipboardList },
    { label: "Low stock rows", value: lowStock.length, to: "/stock", icon: AlertTriangle },
  ] as const;

  return (
    <AppShell title="Overview" description="Wholesale inventory at a glance">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ label, value, to, icon: Icon }) => (
          <Link key={label} to={to}>
            <Card className="hover:border-primary/50 h-full transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
                <Icon className="text-primary size-4" />
              </CardHeader>
              <CardContent>
                <p className="tabular text-3xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Warehouse sync</CardTitle>
            <RefreshCw className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent className="text-sm">
            {lastSync ? (
              <>
                <p>
                  Last poll <span className="font-medium">{timeAgo(lastSync.ran_at)}</span> ·{" "}
                  {lastSync.items_updated} stock rows updated
                </p>
                <Badge className="mt-2" variant={lastSync.status === "success" ? "secondary" : "destructive"}>
                  {lastSync.status}
                </Badge>
              </>
            ) : (
              <p className="text-muted-foreground">
                No poll recorded yet. The job runs every 5 minutes — see the Sync Log.
              </p>
            )}
            <Link to="/sync-log" className="text-primary mt-3 block text-sm underline">
              View full poll history
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lowest stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[...stock]
              .sort((a, b) => a.quantity_available - b.quantity_available)
              .slice(0, 6)
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {s.items?.name}{" "}
                    <span className="text-muted-foreground text-xs">· {s.warehouses?.name}</span>
                  </span>
                  <span className="tabular font-medium">{s.quantity_available}</span>
                </div>
              ))}
            {stock.length === 0 && <p className="text-muted-foreground">No stock rows yet.</p>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
