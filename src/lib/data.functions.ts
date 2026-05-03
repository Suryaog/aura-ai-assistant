import { createServerFn } from "@tanstack/react-start";
import { FILES, readJson, writeJson } from "@/server/storage.server";
import type { Chat, Settings } from "@/lib/types";
import { defaultSettings } from "@/lib/types";

export const getChats = createServerFn({ method: "GET" }).handler(async () => {
  return await readJson<Chat[]>(FILES.CHATS_FILE, []);
});

export const saveChatsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { chats: Chat[] }) => data)
  .handler(async ({ data }) => {
    await writeJson(FILES.CHATS_FILE, data.chats);
    return { ok: true };
  });

export const getSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const raw = await readJson<Partial<Settings>>(FILES.SETTINGS_FILE, {});
  const models = raw.models && raw.models.length ? raw.models : defaultSettings.models;
  const merged: Settings = {
    ...defaultSettings,
    ...raw,
    models,
    activeModelId: models.some((model) => model.id === raw.activeModelId) ? raw.activeModelId! : models[0]?.id ?? defaultSettings.activeModelId,
  };
  return merged;
});

export const saveSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { settings: Settings }) => data)
  .handler(async ({ data }) => {
    await writeJson(FILES.SETTINGS_FILE, data.settings);
    return { ok: true };
  });
