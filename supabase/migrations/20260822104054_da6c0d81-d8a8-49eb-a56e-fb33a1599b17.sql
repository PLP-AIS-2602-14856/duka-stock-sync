ALTER TABLE public.sync_log ADD COLUMN IF NOT EXISTS duration_ms integer NOT NULL DEFAULT 0;
ALTER TABLE public.sync_log ADD COLUMN IF NOT EXISTS error text;

REVOKE ALL ON FUNCTION public.approve_order(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_order(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.approve_order(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;