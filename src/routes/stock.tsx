import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  adjustStock,
  dateTime,
  ensureStockRow,
  itemsQuery,
  stockQuery,
  timeAgo,
  warehousesQuery,
} from "@/lib/inventory";

export const Route = createFileRoute("/stock")({
  head: () => ({
    meta: [
      { title: "Stock levels — Duka Sync wholesale inventory" },
      {
        name: "description",
        content:
          "View stock by warehouse, adjust quantities for damaged-goods write-offs and see the last sync time per row.",
      },
      { property: "og:title", content: "Stock levels — Duka Sync wholesale inventory" },
      {
        property: "og:description",
        content: "Per-warehouse stock availability with manual adjustments and sync timestamps.",
      },
    ],
  }),
  component: StockPage,
});

function StockPage() {
  const qc = useQueryClient();
  const { data: stock = [], isLoading } = useQuery({ ...stockQuery, refetchInterval: 30000 });
  const { data: warehouses = [] } = useQuery(warehousesQuery);
  const { data: items = [] } = useQuery(itemsQuery);

  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [adjusting, setAdjusting] = useState<{ id: string; label: string; qty: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newRow, setNewRow] = useState({ warehouse_id: "", item_id: "" });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stock
      .filter((r) => warehouseFilter === "all" || r.warehouse_id === warehouseFilter)
      .filter(
        (r) =>
          !q ||
          r.items?.name.toLowerCase().includes(q) ||
          r.items?.sku.toLowerCase().includes(q),
      )
      .sort((a, b) => (a.items?.name ?? "").localeCompare(b.items?.name ?? ""));
  }, [stock, warehouseFilter, search]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["stock"] });

  const save = useMutation({
    mutationFn: async () => {
      if (!adjusting) return;
      await adjustStock(adjusting.id, Math.max(0, Math.round(adjusting.qty)));
    },
    onSuccess: () => {
      toast.success("Stock quantity adjusted");
      setAdjusting(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addRow = useMutation({
    mutationFn: async () => {
      if (!newRow.warehouse_id || !newRow.item_id) throw new Error("Pick a warehouse and an item");
      await ensureStockRow(newRow.warehouse_id, newRow.item_id);
    },
    onSuccess: () => {
      toast.success("Stock row created at 0 units");
      setAddOpen(false);
      setNewRow({ warehouse_id: "", item_id: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Stock"
      description="Availability per warehouse, refreshed by the 5-minute sync"
      actions={
        <Button variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Stock row
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="sm:w-64">
            <SelectValue placeholder="All warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name} · {w.region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="sm:max-w-sm"
          placeholder="Search item or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead>Last synced</TableHead>
              <TableHead className="text-right">Adjust</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Loading stock…
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.items?.name}</div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {r.items?.sku} · {r.items?.unit_description}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{r.warehouses?.name}</TableCell>
                <TableCell className="tabular text-right">
                  <Badge
                    variant={
                      r.quantity_available === 0
                        ? "destructive"
                        : r.quantity_available < 20
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {r.quantity_available} units
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  <span title={dateTime(r.last_synced_at)}>{timeAgo(r.last_synced_at)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setAdjusting({
                        id: r.id,
                        label: `${r.items?.name} @ ${r.warehouses?.name}`,
                        qty: r.quantity_available,
                      })
                    }
                  >
                    Adjust
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={adjusting !== null} onOpenChange={(v) => !v && setAdjusting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
          </DialogHeader>
          {adjusting && (
            <div className="grid gap-3">
              <p className="text-muted-foreground text-sm">{adjusting.label}</p>
              <div className="grid gap-1.5">
                <Label htmlFor="qty">Quantity available</Label>
                <Input
                  id="qty"
                  type="number"
                  min={0}
                  value={adjusting.qty}
                  onChange={(e) => setAdjusting({ ...adjusting, qty: Number(e.target.value) })}
                />
                <p className="text-muted-foreground text-xs">
                  Use this for manual corrections such as damaged-goods write-offs. The adjustment
                  updates last synced at.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Check className="size-4" /> Save adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add stock row</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Warehouse</Label>
              <Select
                value={newRow.warehouse_id}
                onValueChange={(v) => setNewRow({ ...newRow, warehouse_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Item</Label>
              <Select
                value={newRow.item_id}
                onValueChange={(v) => setNewRow({ ...newRow, item_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items
                    .filter((i) => !i.discontinued)
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addRow.mutate()} disabled={addRow.isPending}>
              Create row
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
