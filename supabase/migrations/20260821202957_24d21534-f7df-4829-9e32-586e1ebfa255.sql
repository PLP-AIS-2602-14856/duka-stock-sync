-- 1. profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','customer')),
  full_name text,
  duka_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

CREATE POLICY "profiles select own or admin" ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "profiles insert self as customer" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND role = 'customer');

CREATE POLICY "profiles update own non-role" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "profiles admin manage" ON public.profiles
FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 2. orders columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_note text;
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);

-- 3. replace permissive policies
DROP POLICY IF EXISTS "public read items" ON public.items;
DROP POLICY IF EXISTS "public write items" ON public.items;
DROP POLICY IF EXISTS "public read warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "public write warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "public read stock" ON public.stock;
DROP POLICY IF EXISTS "public write stock" ON public.stock;
DROP POLICY IF EXISTS "public read orders" ON public.orders;
DROP POLICY IF EXISTS "public write orders" ON public.orders;
DROP POLICY IF EXISTS "public read sync_log" ON public.sync_log;
DROP POLICY IF EXISTS "public write sync_log" ON public.sync_log;

REVOKE ALL ON public.items FROM anon;
REVOKE ALL ON public.warehouses FROM anon;
REVOKE ALL ON public.stock FROM anon;
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.sync_log FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT ON public.sync_log TO authenticated;
GRANT ALL ON public.items, public.warehouses, public.stock, public.orders, public.sync_log TO service_role;

CREATE POLICY "items read authenticated" ON public.items
FOR SELECT TO authenticated USING (true);
CREATE POLICY "items admin write" ON public.items
FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "warehouses read authenticated" ON public.warehouses
FOR SELECT TO authenticated USING (true);
CREATE POLICY "warehouses admin write" ON public.warehouses
FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "stock read authenticated" ON public.stock
FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock admin write" ON public.stock
FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "orders read own or admin" ON public.orders
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "orders insert own pending" ON public.orders
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "orders admin update" ON public.orders
FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "orders admin delete" ON public.orders
FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "sync_log admin read" ON public.sync_log
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 4. approval gate functions
CREATE OR REPLACE FUNCTION public.approve_order(p_order_id uuid, p_quantity integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders;
  v_stock public.stock;
  v_qty integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can approve orders';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Order is already %', v_order.status;
  END IF;

  v_qty := COALESCE(p_quantity, v_order.quantity_requested);
  IF v_qty < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  SELECT * INTO v_stock FROM public.stock
  WHERE warehouse_id = v_order.warehouse_id AND item_id = v_order.item_id
  FOR UPDATE;

  IF v_stock.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'available', 0,
      'message', 'This item is not stocked at the selected warehouse.');
  END IF;

  IF v_qty > v_stock.quantity_available THEN
    RETURN jsonb_build_object('ok', false, 'available', v_stock.quantity_available,
      'message', format('Insufficient stock: %s units requested, only %s available.', v_qty, v_stock.quantity_available));
  END IF;

  UPDATE public.stock
  SET quantity_available = quantity_available - v_qty, last_synced_at = now()
  WHERE id = v_stock.id;

  UPDATE public.orders
  SET status = 'confirmed', quantity_requested = v_qty,
      status_note = format('Approved by admin. %s units allocated.', v_qty)
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'available', v_stock.quantity_available - v_qty,
    'message', format('Approved. %s units allocated.', v_qty));
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_order(p_order_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can reject orders';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Order is already %', v_order.status;
  END IF;

  UPDATE public.orders
  SET status = 'rejected',
      status_note = COALESCE(NULLIF(p_note, ''), 'Rejected by admin.')
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Order rejected.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_order(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_order(uuid, text) TO authenticated;