CREATE TABLE public.kv_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kv_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.kv_store FOR SELECT USING (true);
CREATE POLICY "public insert" ON public.kv_store FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON public.kv_store FOR UPDATE USING (true) WITH CHECK (true);