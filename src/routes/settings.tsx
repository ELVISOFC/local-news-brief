import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Plus, Trash2, Volume2, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actions, useUser } from "@/lib/store";
import { US_STATES, type Location } from "@/lib/mockData";
import { VOICE_OPTIONS } from "@/lib/speech";

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
              <label className="text-xs text-muted-foreground">Voice</label>
              <Select
                value={user.voiceName ?? "auto"}
                onValueChange={(v) => actions.setVoiceName(v === "auto" ? null : v)}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Auto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (recommended)</SelectItem>
                  {voices.map((v) => <SelectItem key={v.name} value={v.name}>{v.name} ({v.lang})</SelectItem>)}
                </SelectContent>
              </Select>
              {!isSpeechSupported() ? (
                <div className="mt-2 text-xs text-muted-foreground">Speech synthesis not supported in this browser.</div>
              ) : null}
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
