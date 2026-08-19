import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  confirmOrder,
  dateTime,
  itemsQuery,
  kes,
  ordersQuery,
  rejectOrder,
  stockQuery,
  submitOrder,
  timeAgo,
  warehousesQuery,
  type Order,
} from "@/lib/inventory";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Duka Sync wholesale inventory" },
      {
        name: "description",
        content:
          "Dukas request stock from a warehouse and staff confirm or reject orders against live availability.",
      },
      { property: "og:title", content: "Orders — Duka Sync wholesale inventory" },
      {
        property: "og:description",
        content: "Submit duka order requests and manage confirmations against real stock levels.",
      },
    ],
  }),
  component: OrdersPage,
});

const statusVariant = {
  pending: "outline",
  confirmed: "secondary",
  rejected: "destructive",
} as const;

function OrdersPage() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({ ...ordersQuery, refetchInterval: 30000 });
  const { data: items = [] } = useQuery(itemsQuery);
  const { data: warehouses = [] } = useQuery(warehousesQuery);
  const { data: stock = [] } = useQuery({ ...stockQuery, refetchInterval: 15000 });

  const [form, setForm] = useState({ duka_name: "", item_id: "", warehouse_id: "", quantity: 1 });
  const [statusFilter, setStatusFilter] = useState("all");

  const available = useMemo(() => {
    if (!form.item_id || !form.warehouse_id) return null;
    const row = stock.find(
      (s) => s.item_id === form.item_id && s.warehouse_id === form.warehouse_id,
    );
    return row ? row.quantity_available : null;
  }, [stock, form.item_id, form.warehouse_id]);

  const lastSynced = useMemo(() => {
    if (!form.item_id || !form.warehouse_id) return null;
    const row = stock.find(
      (s) => s.item_id === form.item_id && s.warehouse_id === form.warehouse_id,
    );
    return row?.last_synced_at ?? null;
  }, [stock, form.item_id, form.warehouse_id]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["stock"] });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.duka_name.trim()) throw new Error("Enter the duka name");
      if (!form.item_id || !form.warehouse_id) throw new Error("Pick an item and a warehouse");
      if (form.quantity < 1) throw new Error("Quantity must be at least 1");
      return submitOrder({
        duka_name: form.duka_name.trim(),
        item_id: form.item_id,
        warehouse_id: form.warehouse_id,
        quantity_requested: Math.round(form.quantity),
      });
    },
    onSuccess: (result) => {
      if (result.status === "rejected") toast.error(result.note);
      else toast.success(result.note);
      setForm({ ...form, quantity: 1 });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: (order: Order) => confirmOrder(order),
    onSuccess: (result) => {
      if (result.status === "rejected") toast.error(result.note);
      else toast.success(result.note);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (id: string) => rejectOrder(id),
    onSuccess: () => {
      toast.success("Order rejected");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = orders.filter((o) => statusFilter === "all" || o.status === statusFilter);

  return (
    <AppShell title="Orders" description="Duka order requests and staff decisions">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">New order request</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="duka">Duka name</Label>
              <Input
                id="duka"
                placeholder="Mama Njeri Duka, Kawangware"
                value={form.duka_name}
                onChange={(e) => setForm({ ...form, duka_name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Item</Label>
              <Select
                value={form.item_id}
                onValueChange={(v) => setForm({ ...form, item_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items
                    .filter((i) => !i.discontinued)
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} — {kes(i.wholesale_price_kes)} / {i.unit_description}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Warehouse</Label>
              <Select
                value={form.warehouse_id}
                onValueChange={(v) => setForm({ ...form, warehouse_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} · {w.region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qty">Quantity requested</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              />
            </div>

            <div className="bg-muted/60 rounded-md border p-3 text-sm">
              {available === null ? (
                <span className="text-muted-foreground">
                  Pick an item and warehouse to see live availability.
                </span>
              ) : (
                <>
                  <p className="font-semibold">
                    Available: <span className="tabular">{available}</span> units
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {lastSynced ? `Synced ${timeAgo(lastSynced)}` : ""}
                    {available < form.quantity
                      ? " · not enough stock for this request"
                      : " · enough stock for this request"}
                  </p>
                </>
              )}
            </div>

            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit order request"}
            </Button>
          </CardContent>
        </Card>

        <div>
          <div className="mb-3 max-w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Duka</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No orders yet.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{o.duka_name}</div>
                      <div className="text-muted-foreground text-xs">{dateTime(o.created_at)}</div>
                    </TableCell>
                    <TableCell className="text-sm">{o.items?.name}</TableCell>
                    <TableCell className="text-sm">{o.warehouses?.name}</TableCell>
                    <TableCell className="tabular text-right">{o.quantity_requested}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[o.status]}>{o.status}</Badge>
                      {o.status_note && (
                        <p className="text-muted-foreground mt-1 max-w-64 text-xs">
                          {o.status_note}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {o.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => confirm.mutate(o)}
                            disabled={confirm.isPending}
                          >
                            <Check className="size-4" /> Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => reject.mutate(o.id)}
                            disabled={reject.isPending}
                          >
                            <X className="size-4" /> Reject
                          </Button>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
