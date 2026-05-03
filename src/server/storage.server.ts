import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CHATS_FILE = path.join(DATA_DIR, "chats.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    await ensureDir();
    const txt = await fs.readFile(file, "utf-8");
    return JSON.parse(txt) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  await ensureDir();
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export const FILES = { CHATS_FILE, SETTINGS_FILE };
