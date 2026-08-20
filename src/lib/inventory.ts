import { supabase } from "@/integrations/supabase/client";

export type OrderStatus = "pending" | "confirmed" | "rejected";

export interface Item {
  id: string;
  sku: string;
  name: string;
  category: string;
  wholesale_price_kes: number;
  unit_description: string;
  is_discontinued: boolean;
  created_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  region: string;
  created_at: string;
}

export interface StockRow {
  id: string;
  warehouse_id: string;
  item_id: string;
  quantity_available: number;
  last_synced_at: string;
  items: Pick<Item, "id" | "sku" | "name" | "unit_description" | "is_discontinued"> | null;
  warehouses: Pick<Warehouse, "id" | "name" | "region"> | null;
}

export interface Order {
  id: string;
  duka_name: string;
  item_id: string;
  warehouse_id: string;
  quantity_requested: number;
  status: OrderStatus;
  status_note: string | null;
  created_at: string;
  items: Pick<Item, "id" | "sku" | "name" | "wholesale_price_kes"> | null;
  warehouses: Pick<Warehouse, "id" | "name" | "region"> | null;
}

export interface SyncLog {
  id: string;
  run_at: string;
  status: string;
  items_updated: number;
  duration_ms: number;
  notes: string | null;
  error: string | null;
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export const kes = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);

export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

/* ---------- items ---------- */

export const itemsQuery = {
  queryKey: ["items"],
  queryFn: async (): Promise<Item[]> =>
    unwrap(await supabase.from("items").select("*").order("name")),
};

export async function createItem(input: Omit<Item, "id" | "created_at" | "is_discontinued">) {
  unwrap(await supabase.from("items").insert(input).select());
}

export async function updateItem(id: string, input: Partial<Item>) {
  unwrap(await supabase.from("items").update(input).eq("id", id).select());
}

/** Soft-delete when order history exists, hard delete otherwise. */
export async function removeItem(id: string): Promise<"discontinued" | "deleted"> {
  const orders = unwrap(await supabase.from("orders").select("id").eq("item_id", id).limit(1));
  if (orders.length > 0) {
    await updateItem(id, { is_discontinued: true });
    return "discontinued";
  }
  unwrap(await supabase.from("items").delete().eq("id", id).select());
  return "deleted";
}

/* ---------- warehouses ---------- */

export const warehousesQuery = {
  queryKey: ["warehouses"],
  queryFn: async (): Promise<Warehouse[]> =>
    unwrap(await supabase.from("warehouses").select("*").order("name")),
};

export async function createWarehouse(input: { name: string; region: string }) {
  unwrap(await supabase.from("warehouses").insert(input).select());
}

export async function updateWarehouse(id: string, input: { name: string; region: string }) {
  unwrap(await supabase.from("warehouses").update(input).eq("id", id).select());
}

export async function removeWarehouse(id: string): Promise<"blocked" | "deleted"> {
  const orders = unwrap(await supabase.from("orders").select("id").eq("warehouse_id", id).limit(1));
  if (orders.length > 0) return "blocked";
  unwrap(await supabase.from("warehouses").delete().eq("id", id).select());
  return "deleted";
}

/* ---------- stock ---------- */

export const stockQuery = {
  queryKey: ["stock"],
  queryFn: async (): Promise<StockRow[]> =>
    unwrap(
      await supabase
        .from("stock")
        .select(
          "id, warehouse_id, item_id, quantity_available, last_synced_at, items(id, sku, name, unit_description, is_discontinued), warehouses(id, name, region)",
        )
        .order("last_synced_at", { ascending: false }),
    ) as unknown as StockRow[],
};

export async function adjustStock(id: string, quantity: number) {
  unwrap(
    await supabase
      .from("stock")
      .update({ quantity_available: Math.max(0, quantity), last_synced_at: new Date().toISOString() })
      .eq("id", id)
      .select(),
  );
}

export async function ensureStockRow(warehouseId: string, itemId: string) {
  unwrap(
    await supabase
      .from("stock")
      .upsert(
        { warehouse_id: warehouseId, item_id: itemId, quantity_available: 0 },
        { onConflict: "warehouse_id,item_id" },
      )
      .select(),
  );
}

export async function getAvailability(warehouseId: string, itemId: string): Promise<number | null> {
  const rows = unwrap(
    await supabase
      .from("stock")
      .select("quantity_available")
      .eq("warehouse_id", warehouseId)
      .eq("item_id", itemId)
      .limit(1),
  ) as { quantity_available: number }[];
  return rows[0] ? rows[0].quantity_available : null;
}

/* ---------- orders ---------- */

export const ordersQuery = {
  queryKey: ["orders"],
  queryFn: async (): Promise<Order[]> =>
    unwrap(
      await supabase
        .from("orders")
        .select(
          "id, duka_name, item_id, warehouse_id, quantity_requested, status, status_note, created_at, items(id, sku, name, wholesale_price_kes), warehouses(id, name, region)",
        )
        .order("created_at", { ascending: false }),
    ) as unknown as Order[],
};

export async function submitOrder(input: {
  duka_name: string;
  item_id: string;
  warehouse_id: string;
  quantity_requested: number;
}) {
  const available = await getAvailability(input.warehouse_id, input.item_id);
  if (available === null) {
    unwrap(
      await supabase
        .from("orders")
        .insert({
          ...input,
          status: "rejected",
          status_note: "This item is not stocked at the selected warehouse.",
        })
        .select(),
    );
    return { status: "rejected" as const, note: "This item is not stocked at the selected warehouse." };
  }
  if (input.quantity_requested > available) {
    const note = `Rejected: requested ${input.quantity_requested} units but only ${available} available at this warehouse.`;
    unwrap(await supabase.from("orders").insert({ ...input, status: "rejected", status_note: note }).select());
    return { status: "rejected" as const, note };
  }
  unwrap(await supabase.from("orders").insert({ ...input, status: "pending" }).select());
  return { status: "pending" as const, note: `Submitted. ${available} units available at the time of request.` };
}

/** Staff confirm: re-checks availability, auto-rejects when short, deducts stock on success. */
export async function confirmOrder(order: Order) {
  const available = await getAvailability(order.warehouse_id, order.item_id);
  if (available === null || order.quantity_requested > available) {
    const note = `Auto-rejected on confirmation: requested ${order.quantity_requested} units, only ${available ?? 0} available.`;
    unwrap(await supabase.from("orders").update({ status: "rejected", status_note: note }).eq("id", order.id).select());
    return { status: "rejected" as const, note };
  }
  const rows = unwrap(
    await supabase
      .from("stock")
      .select("id")
      .eq("warehouse_id", order.warehouse_id)
      .eq("item_id", order.item_id)
      .limit(1),
  ) as { id: string }[];
  if (!rows[0]) throw new Error("Stock row not found for this item/warehouse.");
  await adjustStock(rows[0].id, available - order.quantity_requested);
  const note = `Confirmed. ${order.quantity_requested} units allocated from ${available} available.`;
  unwrap(await supabase.from("orders").update({ status: "confirmed", status_note: note }).eq("id", order.id).select());
  return { status: "confirmed" as const, note };
}

export async function rejectOrder(id: string, note = "Rejected by warehouse staff.") {
  unwrap(await supabase.from("orders").update({ status: "rejected", status_note: note }).eq("id", id).select());
}

/* ---------- sync ---------- */

export const syncLogsQuery = {
  queryKey: ["sync_log"],
  queryFn: async (): Promise<SyncLog[]> =>
    unwrap(await supabase.from("sync_log").select("*").order("run_at", { ascending: false }).limit(100)),
};

export async function runSyncNow() {
  const res = await fetch("/api/public/hooks/sync-stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trigger: "manual" }),
  });
  const json = (await res.json()) as { items_updated?: number; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Sync failed");
  return json;
}
