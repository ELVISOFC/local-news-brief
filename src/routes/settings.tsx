import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MapPin, Plus, Trash2, Volume2, RefreshCw, Play, Square, Loader2 } from "lucide-react";
import { PageShell } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actions, useUser } from "@/lib/store";
import { US_STATES, type Location } from "@/lib/mockData";
import { VOICE_OPTIONS, createAudioContext } from "@/lib/speech";
import { loadPreviewSamples, savePreviewSamples } from "@/lib/preview-cache";

// Module-level cache of decoded PCM samples keyed by voice|speed|text.
// Survives route navigation within the SPA session; IndexedDB backs it across reloads.
const previewSampleCache = new Map<string, Float32Array>();

async function fetchPreviewSamples(
  text: string,
  voice: string,
  speed: number,
  signal: AbortSignal,
): Promise<Float32Array> {
  const key = `${voice}|${speed}|${text}`;
  const cached = previewSampleCache.get(key);
  if (cached) return cached;

  const persisted = await loadPreviewSamples(key);
  if (persisted) {
    previewSampleCache.set(key, persisted);
    return persisted;
  }
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");


  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, speed }),
    signal,
  });
  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `TTS request failed: ${res.status}`);
  }

  const chunks: Uint8Array[] = [];
  let pending = new Uint8Array(0);
  const collect = (incoming: Uint8Array) => {
    const bytes = new Uint8Array(pending.length + incoming.length);
    bytes.set(pending);
    bytes.set(incoming, pending.length);
    const usable = bytes.length - (bytes.length % 2);
    pending = bytes.slice(usable);
    if (usable > 0) chunks.push(bytes.slice(0, usable));
  };

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as { type: string; audio?: string };
        if (evt.type === "speech.audio.delta" && evt.audio) {
          const bin = atob(evt.audio);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          collect(bytes);
        }
      } catch {
        /* ignore malformed events */
      }
    }
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  const samples = new Int16Array(merged.buffer, merged.byteOffset, Math.floor(merged.length / 2));
  const floats = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) floats[i] = samples[i] / 32768;

  previewSampleCache.set(key, floats);
  void savePreviewSamples(key, floats);
  return floats;
}


export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Profile — AreaNews" }] }),
  component: Settings,
});

function Settings() {
  const user = useUser();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("Home");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("TX");
  const [zip, setZip] = useState("");
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing">("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);

  function teardownPreview() {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewSourceRef.current) {
      try { previewSourceRef.current.onended = null; previewSourceRef.current.stop(); } catch { /* noop */ }
      previewSourceRef.current = null;
    }
    if (previewCtxRef.current) {
      previewCtxRef.current.close().catch(() => {});
      previewCtxRef.current = null;
    }
  }

  useEffect(() => {
    return () => teardownPreview();
  }, []);

  function stopPreview() {
    teardownPreview();
    setPreviewState("idle");
  }

  async function playPreview() {
    if (previewState !== "idle") {
      stopPreview();
      return;
    }
    setPreviewError(null);
    const voice = VOICE_OPTIONS.find((v) => v.id === user.voiceId);
    const sample = `Hi, I'm ${voice?.label ?? "your narrator"}. Here's a quick sample of how your daily briefing will sound.`;
    const ctx = createAudioContext();
    if (!ctx) {
      setPreviewError("Audio playback is not supported in this browser.");
      return;
    }
    previewCtxRef.current = ctx;
    const abort = new AbortController();
    previewAbortRef.current = abort;
    setPreviewState("loading");

    try {
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      const floats = await fetchPreviewSamples(sample, user.voiceId, user.voiceRate, abort.signal);
      if (abort.signal.aborted) return;
      const buffer = ctx.createBuffer(1, floats.length, 24000);
      buffer.getChannelData(0).set(floats);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (previewSourceRef.current === source) previewSourceRef.current = null;
        if (previewCtxRef.current === ctx) {
          ctx.close().catch(() => {});
          previewCtxRef.current = null;
        }
        setPreviewState("idle");
      };
      previewSourceRef.current = source;
      source.start(ctx.currentTime + 0.05);
      setPreviewState("playing");
    } catch (err) {
      if (abort.signal.aborted) return;
      setPreviewError(err instanceof Error ? err.message : "Couldn't play preview.");
      if (previewCtxRef.current === ctx) {
        ctx.close().catch(() => {});
        previewCtxRef.current = null;
      }
      setPreviewState("idle");
    }
  }



  function add() {
    if (!city.trim()) return;
    const loc: Location = {
      id: `${city.toLowerCase().replace(/\s+/g, "-")}-${stateCode.toLowerCase()}-${Date.now()}`,
      label: label.trim() || "Home",
      city: city.trim(),
      state: stateCode,
      zip: zip.trim() || undefined,
    };
    actions.addLocation(loc);
    setCity(""); setZip(""); setLabel("Home"); setAdding(false);
  }

  function resetAll() {
    if (confirm("Reset all data and re-onboard?")) {
      actions.reset();
      navigate({ to: "/welcome" });
    }
  }

  return (
    <PageShell>
      <div className="px-5 pt-8">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage locations, voice and defaults.</p>

        <Section title="Locations" icon={<MapPin className="h-4 w-4" />}>
          <div className="space-y-2">
            {user.locations.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-primary">{l.label}</div>
                  <div className="font-medium">{l.city}, {l.state} {l.zip ? `· ${l.zip}` : ""}</div>
                  {l.county ? <div className="text-xs text-muted-foreground">{l.county}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={user.activeLocationId === l.id ? "default" : "outline"} onClick={() => actions.setActive(l.id)}>
                    {user.activeLocationId === l.id ? "Active" : "Set active"}
                  </Button>
                  <button onClick={() => actions.removeLocation(l.id)} aria-label="Remove" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {user.locations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Add your first location to get a briefing.
              </div>
            ) : null}
          </div>

          {adding ? (
            <div className="mt-3 rounded-2xl border border-border bg-surface p-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Label</label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">City</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Denver" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">State</label>
                  <Select value={stateCode} onValueChange={setStateCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">ZIP</label>
                  <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="80202" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={add} disabled={!city.trim()} className="flex-1">Save location</Button>
                <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="mt-3 w-full gap-1.5" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add location
            </Button>
          )}
        </Section>

        <Section title="Voice & playback" icon={<Volume2 className="h-4 w-4" />}>
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Default playback speed</label>
              <Select value={String(user.voiceRate)} onValueChange={(v) => actions.setVoiceRate(parseFloat(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 1.25, 1.5, 1.75, 2].map((r) => <SelectItem key={r} value={String(r)}>{r}x</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Narrator voice</label>
              <Select
                value={user.voiceId}
                onValueChange={(v) => actions.setVoiceId(v)}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOICE_OPTIONS.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label} — {v.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={playPreview}
                className="mt-3 gap-1.5"
                aria-label={previewState === "idle" ? "Play voice preview" : "Stop voice preview"}
              >
                {previewState === "loading" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
                ) : previewState === "playing" ? (
                  <><Square className="h-4 w-4" /> Stop preview</>
                ) : (
                  <><Play className="h-4 w-4" /> Preview voice</>
                )}
              </Button>
              {previewError ? (
                <div className="mt-2 text-xs text-destructive">{previewError}</div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">
                  High-quality AI narration powered by Lovable AI. Streams instantly on play.
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Bookmarks">
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            {user.bookmarks.length} saved {user.bookmarks.length === 1 ? "article" : "articles"}.
          </div>
        </Section>

        <div className="my-8">
          <Button variant="outline" className="w-full gap-1.5" onClick={resetAll}>
            <RefreshCw className="h-4 w-4" /> Reset & re-onboard
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}{title}
      </div>
      {children}
    </div>
  );
}
