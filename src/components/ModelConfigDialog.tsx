import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { ModelDef, ModelConfig } from "@/lib/types";

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function ModelConfigDialog({
  open, onOpenChange, model, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  model: ModelDef | null;
  onSave: (cfg: ModelConfig, modelId: string, label: string) => void;
}) {
  const [cfg, setCfg] = useState<ModelConfig | null>(null);
  const [modelId, setModelId] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (model) {
      setCfg({ ...model.config });
      setModelId(model.model);
      setLabel(model.label);
    }
  }, [model, open]);

  if (!model || !cfg) return null;
  const u = (p: Partial<ModelConfig>) => setCfg({ ...cfg, ...p });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{model.label}</DialogTitle>
          <DialogDescription>Tune sampling and context for this model.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Display name</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Model ID</Label>
              <Input value={modelId} onChange={(e) => setModelId(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>

          <Row label="Temperature" value={cfg.temperature.toFixed(2)}>
            <Slider min={0} max={2} step={0.05} value={[cfg.temperature]} onValueChange={(v) => u({ temperature: v[0] })} />
          </Row>
          <Row label="Top P" value={cfg.topP.toFixed(2)}>
            <Slider min={0} max={1} step={0.01} value={[cfg.topP]} onValueChange={(v) => u({ topP: v[0] })} />
          </Row>
          <Row label="Max tokens" value={String(cfg.maxTokens)}>
            <Slider min={256} max={32768} step={256} value={[cfg.maxTokens]} onValueChange={(v) => u({ maxTokens: v[0] })} />
          </Row>
          <Row label="Frequency penalty" value={cfg.frequencyPenalty.toFixed(2)}>
            <Slider min={-2} max={2} step={0.1} value={[cfg.frequencyPenalty]} onValueChange={(v) => u({ frequencyPenalty: v[0] })} />
          </Row>
          <Row label="Presence penalty" value={cfg.presencePenalty.toFixed(2)}>
            <Slider min={-2} max={2} step={0.1} value={[cfg.presencePenalty]} onValueChange={(v) => u({ presencePenalty: v[0] })} />
          </Row>
          <Row label="Context window (messages, 0 = all)" value={String(cfg.contextWindow)}>
            <Slider min={0} max={100} step={1} value={[cfg.contextWindow]} onValueChange={(v) => u({ contextWindow: v[0] })} />
          </Row>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
            <div>
              <Label className="text-sm">Thinking mode</Label>
              <p className="text-xs text-muted-foreground">For reasoning-capable models.</p>
            </div>
            <Switch checked={cfg.thinking} onCheckedChange={(v) => u({ thinking: v })} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => { onSave(cfg, modelId, label); onOpenChange(false); }}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
