import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Download, Upload } from "lucide-react";
import type { Settings, ModelDef, Chat } from "@/lib/store";
import { uid, defaultConfig, loadChats } from "@/lib/store";
import { toast } from "sonner";

export function SettingsDialog({
  open, onOpenChange, settings, onChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [newLabel, setNewLabel] = useState("");
  const [newModel, setNewModel] = useState("");

  const update = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });

  const addModel = () => {
    if (!newLabel.trim() || !newModel.trim()) return;
    const m: ModelDef = { id: uid(), label: newLabel.trim(), model: newModel.trim(), config: { ...defaultConfig } };
    update({ models: [...draft.models, m] });
    setNewLabel(""); setNewModel("");
  };
  const removeModel = (id: string) => {
    const models = draft.models.filter(m => m.id !== id);
    update({ models, activeModelId: draft.activeModelId === id ? (models[0]?.id ?? "") : draft.activeModelId });
  };

  const exportChats = () => {
    const chats = loadChats();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), chats }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `chats-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importChats = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const chats: Chat[] = Array.isArray(data) ? data : data.chats;
      if (!Array.isArray(chats)) throw new Error("Invalid file");
      const existing = loadChats();
      const merged = [...chats, ...existing.filter(c => !chats.find(n => n.id === c.id))];
      localStorage.setItem("nim_chats_v1", JSON.stringify(merged));
      toast.success(`Imported ${chats.length} chats. Reload to see them.`);
    } catch (err: any) { toast.error(err.message || "Import failed"); }
    e.target.value = "";
  };

  const save = () => { onChange(draft); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setDraft(settings); onOpenChange(o); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>API key, models, and chat data.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>NVIDIA NIM API Key</Label>
            <Input type="password" placeholder="nvapi-..." value={draft.apiKey} onChange={(e) => update({ apiKey: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input value={draft.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea rows={3} value={draft.systemPrompt} onChange={(e) => update({ systemPrompt: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Models</Label>
            <div className="space-y-2">
              {draft.models.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.label}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{m.model}</div>
                  </div>
                  <button onClick={() => removeModel(m.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 pt-1">
              <Input placeholder="Display name" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              <Input placeholder="model id (e.g. meta/llama...)" value={newModel} onChange={(e) => setNewModel(e.target.value)} />
              <Button type="button" onClick={addModel} variant="secondary"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chat data</Label>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="secondary" onClick={exportChats}>
                <Download className="h-4 w-4" /> Export JSON
              </Button>
              <label className="inline-flex items-center gap-2 rounded-md bg-secondary text-secondary-foreground px-3 h-9 text-sm font-medium cursor-pointer hover:bg-secondary/80">
                <Upload className="h-4 w-4" /> Import JSON
                <input type="file" accept="application/json" className="hidden" onChange={importChats} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Stored locally in your browser via localStorage as JSON (keys: <code className="font-mono">nim_chats_v1</code>, <code className="font-mono">nim_settings_v2</code>).</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
