CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  wholesale_price_kes numeric(12,2) NOT NULL DEFAULT 0,
  unit_description text NOT NULL DEFAULT 'unit',
  is_discontinued boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated, anon;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_all" ON public.items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated, anon;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouses_all" ON public.warehouses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  quantity_available integer NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock TO authenticated, anon;
GRANT ALL ON public.stock TO service_role;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_all" ON public.stock FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'rejected');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duka_name text NOT NULL,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  quantity_requested integer NOT NULL CHECK (quantity_requested > 0),
  status public.order_status NOT NULL DEFAULT 'pending',
  status_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated, anon;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_all" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success',
  items_updated integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  notes text,
  error text
);
GRANT SELECT, INSERT ON public.sync_log TO authenticated, anon;
GRANT ALL ON public.sync_log TO service_role;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_log_read" ON public.sync_log FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sync_log_insert" ON public.sync_log FOR INSERT TO anon, authenticated WITH CHECK (true);

INSERT INTO public.warehouses (name, region) VALUES
  ('Industrial Area DC', 'Nairobi Industrial Area'),
  ('Mombasa Port Depot', 'Mombasa'),
  ('Kisumu Lakeside Depot', 'Kisumu');

INSERT INTO public.items (sku, name, category, wholesale_price_kes, unit_description) VALUES
  ('SKU-OIL-001', 'Fresh Fri Cooking Oil 1L', 'Cooking Oil', 4320.00, 'carton of 12'),
  ('SKU-OIL-002', 'Elianto Cooking Oil 3L', 'Cooking Oil', 5980.00, 'carton of 6'),
  ('SKU-FLR-001', 'Jogoo Maize Flour 2kg', 'Flour', 2760.00, 'bale of 12'),
  ('SKU-FLR-002', 'Pembe Maize Flour 1kg', 'Flour', 1440.00, 'bale of 12'),
  ('SKU-FLR-003', 'Exe Wheat Flour 2kg', 'Flour', 3120.00, 'bale of 12'),
  ('SKU-SUG-001', 'Kabras Sugar 1kg', 'Sugar', 3600.00, 'bale of 24'),
  ('SKU-SUG-002', 'Mumias Sugar 2kg', 'Sugar', 3480.00, 'bale of 12'),
  ('SKU-SOP-001', 'Menengai Bar Soap 800g', 'Soap & Detergents', 2400.00, 'carton of 12'),
  ('SKU-SOP-002', 'Omo Washing Powder 500g', 'Soap & Detergents', 2160.00, 'carton of 24'),
  ('SKU-SOP-003', 'Geisha Beauty Soap 125g', 'Soap & Detergents', 1680.00, 'carton of 48'),
  ('SKU-BEV-001', 'Ketepa Pride Tea Leaves 250g', 'Beverages', 2880.00, 'carton of 24'),
  ('SKU-BEV-002', 'Kenylon Drinking Chocolate 400g', 'Beverages', 4200.00, 'carton of 12'),
  ('SKU-DRY-001', 'Ndovu Rice 2kg', 'Dry Goods', 4560.00, 'bale of 12'),
  ('SKU-DRY-002', 'Kamili Beans 1kg', 'Dry Goods', 2280.00, 'bale of 12'),
  ('SKU-DRY-003', 'Royco Cubes 8g', 'Dry Goods', 1200.00, 'carton of 100');

INSERT INTO public.stock (warehouse_id, item_id, quantity_available, last_synced_at)
SELECT w.id, i.id, 40 + floor(random() * 260)::int, now()
FROM public.warehouses w CROSS JOIN public.items i;