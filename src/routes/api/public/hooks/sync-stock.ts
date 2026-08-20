import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Simulated warehouse-system poll. Called every 5 minutes by a scheduled job
 * (and manually from the Sync Log screen). There is no real warehouse API yet,
 * so each run applies small random fluctuations to quantity_available.
 */
async function runSync(trigger: string) {
  const started = Date.now();
  const supabase = createClient(
    process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const { data: rows, error } = await supabase
      .from("stock")
      .select("id, warehouse_id, item_id, quantity_available");
    if (error) throw new Error(error.message);

    const now = new Date().toISOString();
    const updates = (rows ?? [])
      .map((row) => {
        const delta = Math.floor(Math.random() * 11) - 5; // -5 .. +5
        return { row, delta };
      })
      .filter(({ delta }) => delta !== 0)
      .map(({ row, delta }) => ({
        id: row.id,
        warehouse_id: row.warehouse_id,
        item_id: row.item_id,
        quantity_available: Math.max(0, row.quantity_available + delta),
        last_synced_at: now,
      }));

    if (updates.length > 0) {
      const { error: upsertError } = await supabase.from("stock").upsert(updates);
      if (upsertError) throw new Error(upsertError.message);
    }

    const duration = Date.now() - started;
    await supabase.from("sync_log").insert({
      status: "success",
      items_updated: updates.length,
      duration_ms: duration,
      notes: `${trigger} poll of mock warehouse system: ${updates.length} of ${rows?.length ?? 0} stock rows changed`,
    });

    return { ok: true, items_updated: updates.length, duration_ms: duration };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await supabase.from("sync_log").insert({
      status: "error",
      items_updated: 0,
      duration_ms: Date.now() - started,
      notes: `${trigger} poll of mock warehouse system failed`,
      error: message,
    });
    return { ok: false, error: message };
  }
}

export const Route = createFileRoute("/api/public/hooks/sync-stock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let trigger = "Scheduled";
        try {
          const body = (await request.json()) as { trigger?: string } | null;
          if (body?.trigger === "manual") trigger = "Manual";
        } catch {
          /* empty body is fine */
        }
        const result = await runSync(trigger);
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
