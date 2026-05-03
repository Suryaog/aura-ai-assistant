export type Role = "user" | "assistant" | "system";
export interface Message { id: string; role: Role; content: string; }
export interface Chat { id: string; title: string; messages: Message[]; createdAt: number; modelId: string; }
export interface ModelConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  contextWindow: number; // max messages to send (0 = all)
  thinking: boolean;
}
export interface ModelDef {
  id: string;
  label: string;
  model: string;
  config: ModelConfig;
}
export interface Settings {
  apiKey: string;
  baseUrl: string;
  models: ModelDef[];
  activeModelId: string;
  systemPrompt: string;
}

const SETTINGS_KEY = "nim_settings_v2";
const CHATS_KEY = "nim_chats_v1";

export const defaultConfig: ModelConfig = {
  temperature: 0.7,
  topP: 0.95,
  maxTokens: 4096,
  frequencyPenalty: 0,
  presencePenalty: 0,
  contextWindow: 0,
  thinking: false,
};

export const defaultSettings: Settings = {
  apiKey: "",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  models: [
    { id: "m1", label: "Llama 3.3 70B", model: "meta/llama-3.3-70b-instruct", config: { ...defaultConfig } },
    { id: "m2", label: "DeepSeek V4 Pro", model: "deepseek-ai/deepseek-v4-pro", config: { ...defaultConfig, temperature: 1, maxTokens: 16384 } },
    { id: "m3", label: "DeepSeek R1", model: "deepseek-ai/deepseek-r1", config: { ...defaultConfig } },
    { id: "m4", label: "Qwen 2.5 72B", model: "qwen/qwen2.5-72b-instruct", config: { ...defaultConfig } },
  ],
  activeModelId: "m1",
  systemPrompt: "You are a helpful assistant. Be concise and clear.",
};

function migrate(raw: any): Settings {
  const merged: Settings = { ...defaultSettings, ...raw };
  merged.models = (merged.models || []).map((m: any) => ({
    ...m,
    config: { ...defaultConfig, ...(m.config || {}) },
  }));
  if (!merged.models.length) merged.models = defaultSettings.models;
  return merged;
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem("nim_settings_v1");
    if (!raw) return defaultSettings;
    return migrate(JSON.parse(raw));
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
