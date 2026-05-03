import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await supabaseAdmin.from("kv_store").select("value").eq("key", key).maybeSingle();
  if (error || !data) return fallback;
  return data.value as T;
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  const { error } = await supabaseAdmin
    .from("kv_store")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export const FILES = { CHATS_FILE: "chats", SETTINGS_FILE: "settings" };
