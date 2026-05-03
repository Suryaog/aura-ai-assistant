import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Menu, Plus, Settings as SettingsIcon, Trash2, ChevronDown, Square, MessageSquare, SlidersHorizontal, Check, Copy, ThumbsUp, ThumbsDown, RotateCcw, Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import { Markdown } from "./Markdown";
import { SettingsDialog } from "./SettingsDialog";
import { ModelConfigDialog } from "./ModelConfigDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type Chat, type Message, type Settings, type Attachment,
  defaultSettings, uid,
} from "@/lib/types";
import { getChats, saveChatsFn, getSettingsFn, saveSettingsFn } from "@/lib/data.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ChatApp() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelCfgOpen, setModelCfgOpen] = useState(false);
  const [modelCfgTarget, setModelCfgTarget] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Initial load from server
  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([getSettingsFn(), getChats()]);
        setSettings(s);
        setChats(c);
      } catch (e) {
        console.error(e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist to server (debounced)
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => { saveChatsFn({ data: { chats } }).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [chats, loaded]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => { saveSettingsFn({ data: { settings } }).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [settings, loaded]);

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

  const runCompletion = async (chatId: string, baseMessages: Message[], assistantMsgId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    try {
      const ctxLimit = activeModel.config.contextWindow;
      const trimmed = ctxLimit > 0 ? baseMessages.slice(-ctxLimit) : baseMessages;
      const payloadMessages = [
        ...(settings.systemPrompt ? [{ role: "system", content: settings.systemPrompt }] : []),
        ...trimmed.map(m => ({ role: m.role, content: m.content })),
      ];
      const body: any = {
        model: activeModel.model,
        messages: payloadMessages,
        stream: true,
        temperature: activeModel.config.temperature,
        top_p: activeModel.config.topP,
        max_tokens: activeModel.config.maxTokens,
        frequency_penalty: activeModel.config.frequencyPenalty,
        presence_penalty: activeModel.config.presencePenalty,
      };
      if (activeModel.config.thinking) body.chat_template_kwargs = { thinking: true };
      const resp = await fetch(`/api/nim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.apiKey,
          "x-base-url": settings.baseUrl,
        },
        body: JSON.stringify(body),
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
                messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: assistantContent } : m),
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
          messages: c.messages.map(m => m.id === assistantMsgId ? { ...m, content: `_Error: ${e.message}_` } : m),
        }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
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
    const baseMessages = [...chat.messages, userMsg];
    updateChat(chat.id, c => ({ ...c, messages: [...baseMessages, assistantMsg] }));
    setInput("");
    await runCompletion(chat.id, baseMessages, assistantMsg.id);
  };

  const regenerate = async () => {
    if (!active || streaming) return;
    // Drop trailing assistant messages
    let msgs = [...active.messages];
    while (msgs.length && msgs[msgs.length - 1].role === "assistant") msgs.pop();
    if (!msgs.length) return;
    const assistantMsg: Message = { id: uid(), role: "assistant", content: "" };
    updateChat(active.id, c => ({ ...c, messages: [...msgs, assistantMsg] }));
    await runCompletion(active.id, msgs, assistantMsg.id);
  };

  const stop = () => { abortRef.current?.abort(); };

  return (
    <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden">
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

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-3 md:px-4 h-14 border-b border-border">
          <button className="md:hidden p-2 -ml-2 text-foreground" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-base font-semibold hover:bg-accent transition">
                  {activeModel?.label ?? "No model"}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-64">
                {settings.models.map(m => (
                  <DropdownMenuItem key={m.id} onSelect={(e) => { e.preventDefault(); setSettings({ ...settings, activeModelId: m.id }); }}>
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-sm flex items-center gap-1.5">
                        {m.id === settings.activeModelId && <Check className="h-3.5 w-3.5" />}
                        {m.label}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono truncate">{m.model}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setModelCfgTarget(m.id); setModelCfgOpen(true); }}
                      className="ml-2 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      aria-label="Configure"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-2" /> Add / manage models
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => { if (activeModel) { setModelCfgTarget(activeModel.id); setModelCfgOpen(true); } }}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition"
              aria-label="Model config"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
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
              {active.messages.map((m, idx) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isLast={idx === active.messages.length - 1}
                  streaming={streaming}
                  onRegenerate={regenerate}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-background">
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
          </div>
        </div>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={setSettings}
      />
      <ModelConfigDialog
        open={modelCfgOpen}
        onOpenChange={setModelCfgOpen}
        model={settings.models.find(m => m.id === modelCfgTarget) ?? null}
        onSave={(cfg, modelId, label) => {
          setSettings({
            ...settings,
            models: settings.models.map(m => m.id === modelCfgTarget ? { ...m, config: cfg, model: modelId, label } : m),
          });
        }}
      />
    </div>
  );
}

function MessageBubble({ message, isLast, streaming, onRegenerate }: { message: Message; isLast: boolean; streaming: boolean; onRegenerate: () => void }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl bg-bubble text-bubble-foreground px-4 py-2.5 whitespace-pre-wrap text-[15px]">
          {message.content}
        </div>
      </div>
    );
  }
  const showActions = !!message.content && !(isLast && streaming);
  return (
    <div className="text-[15px]">
      {message.content ? <Markdown>{message.content}</Markdown> : <TypingDots />}
      {showActions && (
        <AssistantActions content={message.content} canRegenerate={isLast} onRegenerate={onRegenerate} />
      )}
    </div>
  );
}

function AssistantActions({ content, canRegenerate, onRegenerate }: { content: string; canRegenerate: boolean; onRegenerate: () => void }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const btn = "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition";
  return (
    <div className="flex items-center gap-0.5 mt-2 -ml-1.5">
      <button onClick={copy} className={btn} aria-label="Copy">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <button onClick={() => setFeedback(feedback === "up" ? null : "up")} className={cn(btn, feedback === "up" && "text-foreground bg-accent")} aria-label="Good response">
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button onClick={() => setFeedback(feedback === "down" ? null : "down")} className={cn(btn, feedback === "down" && "text-foreground bg-accent")} aria-label="Bad response">
        <ThumbsDown className="h-4 w-4" />
      </button>
      {canRegenerate && (
        <button onClick={onRegenerate} className={btn} aria-label="Regenerate">
          <RotateCcw className="h-4 w-4" />
        </button>
      )}
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
