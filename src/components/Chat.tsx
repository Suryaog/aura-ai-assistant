import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Menu, Plus, Settings as SettingsIcon, Trash2, ChevronDown, Square, MessageSquare } from "lucide-react";
import { Markdown } from "./Markdown";
import { SettingsDialog } from "./SettingsDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type Chat, type Message, type Settings,
  loadChats, saveChats, loadSettings, saveSettings, uid,
} from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ChatApp() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [chats, setChats] = useState<Chat[]>(() => loadChats());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { saveChats(chats); }, [chats]);
  useEffect(() => { saveSettings(settings); }, [settings]);

  const active = useMemo(() => chats.find(c => c.id === activeId) ?? null, [chats, activeId]);
  const activeModel = settings.models.find(m => m.id === settings.activeModelId) ?? settings.models[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, streaming]);

  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const newChat = () => { setActiveId(null); setSidebarOpen(false); setInput(""); };

  const deleteChat = (id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const updateChat = (id: string, fn: (c: Chat) => Chat) => {
    setChats(prev => prev.map(c => c.id === id ? fn(c) : c));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    if (!settings.apiKey) {
      toast.error("Add your NVIDIA NIM API key in Settings");
      setSettingsOpen(true);
      return;
    }
    if (!activeModel) { toast.error("No model selected"); return; }

    let chat = active;
    if (!chat) {
      chat = {
        id: uid(),
        title: text.slice(0, 40),
        messages: [],
        createdAt: Date.now(),
        modelId: settings.activeModelId,
      };
      setChats(prev => [chat!, ...prev]);
      setActiveId(chat.id);
    }
    const userMsg: Message = { id: uid(), role: "user", content: text };
    const assistantMsg: Message = { id: uid(), role: "assistant", content: "" };
    const chatId = chat.id;
    const baseMessages = [...chat.messages, userMsg];
    updateChat(chatId, c => ({ ...c, messages: [...baseMessages, assistantMsg] }));
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payloadMessages = [
        ...(settings.systemPrompt ? [{ role: "system", content: settings.systemPrompt }] : []),
        ...baseMessages.map(m => ({ role: m.role, content: m.content })),
      ];
      const resp = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: activeModel.model,
          messages: payloadMessages,
          stream: true,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => "");
        throw new Error(`Request failed: ${resp.status} ${t.slice(0, 200)}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") { done = true; break; }
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              updateChat(chatId, c => ({
                ...c,
                messages: c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: assistantContent } : m),
              }));
            }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast.error(e.message || "Request failed");
        updateChat(chatId, c => ({
          ...c,
          messages: c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: `_Error: ${e.message}_` } : m),
        }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => { abortRef.current?.abort(); };

  return (
    <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-card flex flex-col transition-transform duration-200 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-3">
          <button
            onClick={newChat}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-accent transition"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {chats.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Chats show here</div>
          ) : chats.map(c => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-accent",
                activeId === c.id && "bg-accent"
              )}
              onClick={() => { setActiveId(c.id); setSidebarOpen(false); }}
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{c.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent transition"
          >
            <SettingsIcon className="h-4 w-4" /> Settings
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-3 md:px-4 h-14 border-b border-border">
          <button className="md:hidden p-2 -ml-2 text-foreground" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-base font-semibold hover:bg-accent transition">
                {activeModel?.label ?? "No model"}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {settings.models.map(m => (
                <DropdownMenuItem key={m.id} onClick={() => setSettings({ ...settings, activeModelId: m.id })}>
                  <div className="flex flex-col">
                    <span className="text-sm">{m.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">{m.model}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-2" /> Add / manage models
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button onClick={newChat} className="p-2 -mr-2 text-foreground hover:text-foreground" aria-label="New chat">
            <Plus className="h-5 w-5" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!active || active.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-6 text-center">
              <h1 className="text-2xl md:text-3xl font-semibold">What can I help with?</h1>
              <p className="text-sm text-muted-foreground mt-2">Powered by NVIDIA NIM</p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-6">
              {active.messages.map(m => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background">
          <div className="mx-auto w-full max-w-3xl px-3 md:px-4 py-3">
            <div className="flex items-end gap-2 rounded-3xl border border-border bg-card px-3 py-2 focus-within:border-ring transition">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                rows={1}
                placeholder="Ask anything"
                className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground max-h-[200px]"
              />
              {streaming ? (
                <Button size="icon" onClick={stop} className="h-9 w-9 rounded-full" aria-label="Stop">
                  <Square className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button size="icon" onClick={send} disabled={!input.trim()} className="h-9 w-9 rounded-full" aria-label="Send">
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {activeModel?.model ?? "no model"} · stored locally
            </p>
          </div>
        </div>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={setSettings}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl bg-bubble text-bubble-foreground px-4 py-2.5 whitespace-pre-wrap text-[15px]">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="text-[15px]">
      {message.content ? <Markdown>{message.content}</Markdown> : <TypingDots />}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
    </div>
  );
}
