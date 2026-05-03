import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const sb = createClient(url, key, { auth: { persistSession: false } });

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await sb.from("kv_store").select("value").eq("key", key).maybeSingle();
  if (error || !data) return fallback;
  return data.value as T;
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  const { error } = await sb
    .from("kv_store")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export const FILES = { CHATS_FILE: "chats", SETTINGS_FILE: "settings" };
