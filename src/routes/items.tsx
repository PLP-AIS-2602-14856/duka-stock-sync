import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createItem,
  itemsQuery,
  kes,
  removeItem,
  updateItem,
  type Item,
} from "@/lib/inventory";

export const Route = createFileRoute("/items")({
  head: () => ({
    meta: [
      { title: "Items — Duka Sync wholesale inventory" },
      {
        name: "description",
        content:
          "Manage the wholesale product catalogue: SKUs, categories, KES wholesale prices and pack units.",
      },
      { property: "og:title", content: "Items — Duka Sync wholesale inventory" },
      {
        property: "og:description",
        content: "Create, search, edit and discontinue wholesale items with KES pricing.",
      },
    ],
  }),
  component: ItemsPage,
});

const empty = {
  sku: "",
  name: "",
  category: "",
  wholesale_price_kes: 0,
  unit_description: "",
};

function ItemsPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery(itemsQuery);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(empty);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
    );
  }, [items, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["stock"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.sku.trim() || !form.name.trim()) throw new Error("SKU and name are required");
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category.trim() || "General",
        wholesale_price_kes: Number(form.wholesale_price_kes) || 0,
        unit_description: form.unit_description.trim() || "unit",
      };
      if (editing) await updateItem(editing.id, payload);
      else await createItem(payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Item updated" : "Item created");
      setEditing(null);
      setCreating(false);
      setForm(empty);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeItem(id),
    onSuccess: (result) => {
      toast.success(
        result === "discontinued"
          ? "Item has order history — marked as discontinued instead of deleted"
          : "Item deleted",
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDiscontinued = useMutation({
    mutationFn: (item: Item) => updateItem(item.id, { discontinued: !item.discontinued }),
    onSuccess: () => {
      toast.success("Item status updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = creating || editing !== null;

  return (
    <AppShell
      title="Items"
      description="Wholesale product catalogue"
      actions={
        <Button
          onClick={() => {
            setForm(empty);
            setCreating(true);
          }}
        >
          <Plus className="size-4" /> New item
        </Button>
      }
    >
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search by SKU or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Wholesale</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Loading items…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No items match your search.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell className="text-muted-foreground">{item.unit_description}</TableCell>
                <TableCell className="tabular text-right">{kes(item.wholesale_price_kes)}</TableCell>
                <TableCell>
                  <button onClick={() => toggleDiscontinued.mutate(item)}>
                    <Badge variant={item.discontinued ? "outline" : "secondary"}>
                      {item.discontinued ? "Discontinued" : "Active"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit item"
                    onClick={() => {
                      setEditing(item);
                      setForm({
                        sku: item.sku,
                        name: item.name,
                        category: item.category,
                        wholesale_price_kes: item.wholesale_price_kes,
                        unit_description: item.unit_description,
                      });
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete item"
                    onClick={() => del.mutate(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit item" : "New item"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="unit">Unit description</Label>
              <Input
                id="unit"
                placeholder="carton of 24"
                value={form.unit_description}
                onChange={(e) => setForm({ ...form, unit_description: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="price">Wholesale price (KES)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={form.wholesale_price_kes}
                onChange={(e) =>
                  setForm({ ...form, wholesale_price_kes: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
