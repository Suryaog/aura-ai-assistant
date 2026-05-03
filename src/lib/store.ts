export type Role = "user" | "assistant" | "system";
export interface Message { id: string; role: Role; content: string; }
export interface Chat { id: string; title: string; messages: Message[]; createdAt: number; modelId: string; }
export interface ModelDef { id: string; label: string; model: string; }
export interface Settings {
  apiKey: string;
  baseUrl: string;
  models: ModelDef[];
  activeModelId: string;
  systemPrompt: string;
}

const SETTINGS_KEY = "nim_settings_v1";
const CHATS_KEY = "nim_chats_v1";

export const defaultSettings: Settings = {
  apiKey: "",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  models: [
    { id: "m1", label: "Llama 3.3 70B", model: "meta/llama-3.3-70b-instruct" },
    { id: "m2", label: "Llama 3.1 405B", model: "meta/llama-3.1-405b-instruct" },
    { id: "m3", label: "DeepSeek R1", model: "deepseek-ai/deepseek-r1" },
    { id: "m4", label: "Qwen 2.5 72B", model: "qwen/qwen2.5-72b-instruct" },
  ],
  activeModelId: "m1",
  systemPrompt: "You are a helpful assistant. Be concise and clear.",
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch { return defaultSettings; }
}
export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadChats(): Chat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
export function saveChats(c: Chat[]) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(c));
}

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
