import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createWarehouse,
  dateTime,
  removeWarehouse,
  updateWarehouse,
  warehousesQuery,
  type Warehouse,
} from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/admin/warehouses")({
  head: () => ({
    meta: [
      { title: "Warehouses — Duka Sync wholesale inventory" },
      {
        name: "description",
        content: "Manage regional distribution warehouses serving retail kiosks across Kenya.",
      },
      { property: "og:title", content: "Warehouses — Duka Sync wholesale inventory" },
      {
        property: "og:description",
        content: "Create, edit and remove regional warehouses in the distributor network.",
      },
    ],
  }),
  component: WarehousesPage,
});

function WarehousesPage() {
  const qc = useQueryClient();
  const { data: warehouses = [], isLoading } = useQuery(warehousesQuery);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", region: "" });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.region.trim()) throw new Error("Name and region are required");
      const payload = { name: form.name.trim(), region: form.region.trim() };
      if (editing) await updateWarehouse(editing.id, payload);
      else await createWarehouse(payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Warehouse updated" : "Warehouse created");
      setEditing(null);
      setCreating(false);
      setForm({ name: "", region: "" });
      qc.invalidateQueries({ queryKey: ["warehouses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeWarehouse(id),
    onSuccess: (result) => {
      if (result === "blocked") {
        toast.error("This warehouse has order history and cannot be deleted.");
        return;
      }
      toast.success("Warehouse deleted");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Warehouses"
      description="Regional distribution centres"
      actions={
        <Button
          onClick={() => {
            setForm({ name: "", region: "" });
            setCreating(true);
          }}
        >
          <Plus className="size-4" /> New warehouse
        </Button>
      }
    >
      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Loading warehouses…
                </TableCell>
              </TableRow>
            )}
            {warehouses.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.name}</TableCell>
                <TableCell>{w.region}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {dateTime(w.created_at)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit warehouse"
                    onClick={() => {
                      setEditing(w);
                      setForm({ name: w.name, region: w.region });
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete warehouse"
                    onClick={() => del.mutate(w.id)}
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
        open={creating || editing !== null}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit warehouse" : "New warehouse"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="wname">Name</Label>
              <Input
                id="wname"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wregion">Region</Label>
              <Input
                id="wregion"
                placeholder="Nairobi Industrial Area"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save warehouse"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
