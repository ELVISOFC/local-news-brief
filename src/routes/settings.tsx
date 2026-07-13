import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MapPin, Plus, Trash2, Volume2, RefreshCw, Play, Square, Loader2, Rss, CheckCircle2, AlertCircle, XCircle, HelpCircle } from "lucide-react";
import { PageShell } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actions, useUser, type CustomFeed } from "@/lib/store";
import { US_STATES, type Location } from "@/lib/mockData";
import { VOICE_OPTIONS, createAudioContext } from "@/lib/speech";
import { AlertSettingsCard } from "@/components/Alerts";

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
  if (cached && cached.length > 0) return cached;

  const persisted = await loadPreviewSamples(key);
  if (persisted && persisted.length > 0) {
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

  if (floats.length > 0) {
    previewSampleCache.set(key, floats);
    void savePreviewSamples(key, floats);
  }
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
      if (!floats.length) throw new Error("No audio was returned for this voice.");
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

        <CustomFeedsSection />



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

        <div className="mt-6">
          <AlertSettingsCard />
        </div>



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

const FEED_KINDS = ["City", "County", "Police", "Transit", "Schools", "Emergency", "Other"];

function FeedStatusIndicator({ feed }: { feed: CustomFeed }) {
  const status = feed.status ?? "unknown";
  const count = feed.itemCount;
  const label =
    status === "valid"
      ? `Validated & deduped${count !== undefined ? ` · ${count} item${count === 1 ? "" : "s"} found` : ""}`
      : status === "duplicate"
      ? "Duplicate feed — not added again"
      : status === "invalid"
      ? "Validation failed"
      : "Status unknown (added before tracking)";

  const icons = {
    valid: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />,
    duplicate: <AlertCircle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />,
    invalid: <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />,
    unknown: <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />,
  };

  const badgeClass = {
    valid: "bg-emerald-500/10 text-emerald-600",
    duplicate: "bg-amber-500/10 text-amber-600",
    invalid: "bg-destructive/10 text-destructive",
    unknown: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass[status]}`}
      title={label}
      aria-label={label}
    >
      {icons[status]}
      {status === "valid" ? "Validated" : status === "duplicate" ? "Duplicate" : status === "invalid" ? "Invalid" : "Unknown"}
    </span>
  );
}

function CustomFeedsSection() {
  const user = useUser();
  const active = user.locations.find((l) => l.id === user.activeLocationId) ?? user.locations[0];
  const feeds: CustomFeed[] = active ? user.customFeeds?.[active.id] ?? [] : [];
  const [source, setSource] = useState("");
  const [kind, setKind] = useState("City");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  async function addFeed() {
    setError(null);
    setNotice(null);
    if (!active) return;
    const trimmedUrl = url.trim();
    if (!/^https?:\/\/\S+$/i.test(trimmedUrl)) {
      setError("Enter a valid http(s) RSS URL.");
      return;
    }
    if (!source.trim()) {
      setError("Give the feed a name (e.g. 'City of Denver').");
      return;
    }
    setValidating(true);
    try {
      const res = await fetch("/api/news/validate-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmedUrl,
          city: active.city,
          state: active.state,
          county: active.county,
          existing: feeds.map((f) => f.url),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        canonicalUrl?: string;
        title?: string;
        itemCount?: number;
        error?: string;
      };
      if (!data.ok) {
        setError(data.error || "Couldn't validate that feed.");
        return;
      }
      const canonical = data.canonicalUrl || trimmedUrl;
      if (feeds.some((f) => f.url === canonical)) {
        setError("This feed is already added.");
        return;
      }
      actions.addCustomFeed(active.id, {
        id: `feed-${Date.now()}`,
        source: source.trim(),
        kind,
        url: canonical,
        status: "valid",
        itemCount: data.itemCount,
        lastChecked: new Date().toISOString(),
      });
      setNotice(
        data.itemCount
          ? `Added — feed returned ${data.itemCount} recent item${data.itemCount === 1 ? "" : "s"}.`
          : "Added.",
      );
      setSource("");
      setUrl("");
      setKind("City");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  }

  return (
    <Section title="Municipal & press-release feeds" icon={<Rss className="h-4 w-4" />}>
      {!active ? (
        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Add a location first to attach official RSS feeds.
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-muted-foreground">
            Feeds for <span className="font-medium text-foreground">{active.city}, {active.state}</span>.
            Curated city/county feeds are included automatically — add extras below.
          </div>
          <div className="space-y-2">
            {feeds.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">{f.kind}</span>
                    <span className="truncate font-medium">{f.source}</span>
                    <FeedStatusIndicator feed={f} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{f.url}</div>
                </div>
                <button
                  onClick={() => actions.removeCustomFeed(active.id, f.id)}
                  aria-label="Remove feed"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {feeds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No custom feeds yet.
              </div>
            ) : null}
          </div>

          <div className="mt-3 rounded-2xl border border-border bg-surface p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Publisher name</label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="City of Denver" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Kind</label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{FEED_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">RSS URL</label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://denvergov.org/news/rss" />
              </div>
            </div>
            {error ? <div className="text-xs text-destructive">{error}</div> : null}
            {notice ? <div className="text-xs text-primary">{notice}</div> : null}
            <Button onClick={addFeed} disabled={validating} className="w-full gap-1.5">
              {validating ? <><Loader2 className="h-4 w-4 animate-spin" /> Validating…</> : <><Plus className="h-4 w-4" /> Add feed</>}
            </Button>
          </div>
        </>
      )}
    </Section>
  );
}

