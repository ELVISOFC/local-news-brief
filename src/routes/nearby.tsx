import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Loader2, Search, MapPin as MapPinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/BottomNav";
import { useUser } from "@/lib/store";
import { getBriefing, SAMPLE_LOCATIONS } from "@/lib/mockData";
import { generateIncidents, geocode, INCIDENT_META, distanceKm, type Pin } from "@/lib/incidents";
import { AlertsBell, raiseAlertsForPins } from "@/components/Alerts";


export const Route = createFileRoute("/nearby")({
  head: () => ({
    meta: [
      { title: "Nearby — AreaNews" },
      { name: "description", content: "Live map of stories and reports happening around you." },
    ],
  }),
  component: NearbyPage,
});

// Rough lat/lng fallbacks for sample locations so the map has something to show.
const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  austin: { lat: 30.2672, lng: -97.7431 },
  miami: { lat: 25.7617, lng: -80.1918 },
  sf: { lat: 37.7749, lng: -122.4194 },
};

type Center = { lat: number; lng: number; label: string };

function NearbyPage() {
  const user = useUser();
  const fallbackLoc =
    user.locations.find((l) => l.id === user.activeLocationId) ??
    user.locations[0] ??
    SAMPLE_LOCATIONS[0];
  const fallbackCoords = LOCATION_COORDS[fallbackLoc.id] ?? LOCATION_COORDS.austin;

  const [center, setCenter] = useState<Center>({
    ...fallbackCoords,
    label: `${fallbackLoc.city}, ${fallbackLoc.state}`,
  });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<null | "geo" | "search">(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "stories" | "incidents">("all");

  const briefing = useMemo(() => getBriefing(fallbackLoc.id), [fallbackLoc.id]);

  const pins: Pin[] = useMemo(() => {
    const incidents = generateIncidents(center, 14);
    const storyPins: Pin[] = (briefing?.stories ?? []).slice(0, 6).map((s, i) => {
      // Scatter story pins around the center too, but a touch closer in.
      const seed = (s.id.length * 9301 + i * 49297) % 233280;
      const r = 0.004 + ((seed % 100) / 100) * 0.018;
      const theta = ((seed * 17) % 360) * (Math.PI / 180);
      return {
        id: `story-${s.id}`,
        kind: "story",
        title: s.headline,
        detail: s.summary,
        lat: center.lat + Math.sin(theta) * r,
        lng: center.lng + Math.cos(theta) * r * 1.25,
        minutesAgo: 30 + (i * 47) % 240,
        source: s.source,
        storyId: s.id,
      };
    });
    const all = [...storyPins, ...incidents];
    if (filter === "stories") return all.filter((p) => p.kind === "story");
    if (filter === "incidents") return all.filter((p) => p.kind !== "story");
    return all;
  }, [center, briefing, filter]);

  function useGeolocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setBusy("geo");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Your current location",
        });
        setBusy(null);
      },
      (err) => {
        setError(err.message || "Couldn't get your location.");
        setBusy(null);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy("search");
    setError(null);
    try {
      const result = await geocode(query);
      if (!result) {
        setError("Couldn't find that place. Try a zip code or 'City, State'.");
      } else {
        setCenter(result);
      }
    } catch {
      setError("Search failed. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  // Raise in-app alerts for pins matching the user's preferences.
  useEffect(() => {
    if (!pins.length) return;
    raiseAlertsForPins(pins, center, user, distanceKm);
  }, [pins, center, user]);

  return (
    <PageShell>
      <div className="px-5 pt-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-primary">
              <MapPinIcon className="h-4 w-4" />
              <span className="text-sm font-semibold">Nearby</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold leading-tight">What's happening around you</h1>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-1" title={center.label}>
              {center.label}
            </p>
          </div>
          <AlertsBell />
        </div>



        <form onSubmit={runSearch} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zip code or city, e.g. 78704 or Austin, TX"
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={busy === "search"}>
            {busy === "search" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={useGeolocation} disabled={busy === "geo"} aria-label="Use my location">
            {busy === "geo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
          </Button>
        </form>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

        <div className="mt-4 flex gap-2 text-xs">
          {(["all", "stories", "incidents"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
          <MapView center={center} pins={pins} radiusKm={user.alerts.enabled ? user.alerts.radiusKm : 0} />
        </div>

        <h2 className="mt-6 text-base font-semibold">Recent activity</h2>
        <p className="text-xs text-muted-foreground">Sorted by most recent. Tap a story to read more.</p>
        <ul className="mt-3 space-y-2">
          {[...pins]
            .sort((a, b) => a.minutesAgo - b.minutesAgo)
            .map((p) => {
              const meta = p.kind === "story" ? null : INCIDENT_META[p.kind];
              const Inner = (
                <div className="flex gap-3 rounded-2xl bg-surface p-3 border border-border shadow-card">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                    style={{ background: meta ? `${meta.color}22` : "oklch(0.42 0.09 215 / 0.12)" }}
                  >
                    {meta ? meta.emoji : "📰"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span style={{ color: meta?.color }}>{meta ? meta.label : "Story"}</span>
                      <span>· {p.source}</span>
                      <span>· {p.minutesAgo < 60 ? `${p.minutesAgo}m ago` : `${Math.floor(p.minutesAgo / 60)}h ago`}</span>
                    </div>
                    <div className="mt-0.5 font-medium leading-snug line-clamp-2">{p.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{p.detail}</div>
                  </div>
                </div>
              );
              return (
                <li key={p.id}>
                  {p.storyId ? (
                    <Link to="/article/$id" params={{ id: p.storyId }} className="block active:scale-[0.99] transition-transform">
                      {Inner}
                    </Link>
                  ) : (
                    Inner
                  )}
                </li>
              );
            })}
        </ul>
      </div>
    </PageShell>
  );
}

// react-leaflet uses `window` at import time, so load only on the client.
function MapView({ center, pins }: { center: { lat: number; lng: number }; pins: Pin[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex h-[360px] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map…
      </div>
    );
  }
  return <ClientMap center={center} pins={pins} />;
}

function ClientMap({ center, pins }: { center: { lat: number; lng: number }; pins: Pin[] }) {
  // Dynamic imports keep leaflet out of the SSR bundle.
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      if (!instanceRef.current) {
        instanceRef.current = L.map(mapRef.current, {
          center: [center.lat, center.lng],
          zoom: 13,
          zoomControl: true,
          attributionControl: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(instanceRef.current);
      } else {
        instanceRef.current.setView([center.lat, center.lng], 13);
      }

      if (layerRef.current) {
        instanceRef.current.removeLayer(layerRef.current);
      }
      const group = L.layerGroup();

      // "You are here" ring
      L.circle([center.lat, center.lng], {
        radius: 350,
        color: "oklch(0.42 0.09 215)",
        fillColor: "oklch(0.42 0.09 215)",
        fillOpacity: 0.08,
        weight: 1.5,
      }).addTo(group);

      for (const p of pins) {
        const meta = p.kind === "story" ? null : INCIDENT_META[p.kind];
        const color = meta?.color ?? "oklch(0.42 0.09 215)";
        const emoji = meta?.emoji ?? "📰";
        const icon = L.divIcon({
          className: "areanews-pin",
          html: `<div style="
            width:30px;height:30px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            background:white;border:2px solid ${color};
            box-shadow:0 2px 6px rgba(0,0,0,.18);font-size:15px;
          ">${emoji}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        L.marker([p.lat, p.lng], { icon })
          .bindPopup(
            `<div style="font-family:Inter,system-ui;max-width:220px">
               <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:${color}">
                 ${meta ? meta.label : "Story"} · ${p.source}
               </div>
               <div style="font-weight:600;margin-top:2px;line-height:1.25">${escapeHtml(p.title)}</div>
               <div style="font-size:12px;color:#555;margin-top:2px">${escapeHtml(p.detail)}</div>
             </div>`,
          )
          .addTo(group);
      }
      group.addTo(instanceRef.current);
      layerRef.current = group;
    })();
    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, pins]);

  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  }, []);

  return <div ref={mapRef} className="h-[360px] w-full" />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
