import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { toast } from "sonner";
import { useUser, actions, ALL_CATEGORIES } from "@/lib/store";
import { useNotifications, useUnreadCount, notifications } from "@/lib/notifications";
import { INCIDENT_META, type IncidentKind } from "@/lib/incidents";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

/** Settings card — drop into the Settings page. */
export function AlertSettingsCard() {
  const user = useUser();
  const a = user.alerts;
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold">Neighborhood alerts</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Get notified about new stories and incidents within your chosen radius.
          </p>
        </div>
        <Switch checked={a.enabled} onCheckedChange={(v) => actions.setAlerts({ enabled: v })} />
      </div>

      <div className={a.enabled ? "mt-5 space-y-5" : "mt-5 space-y-5 opacity-50 pointer-events-none"}>
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Alert radius</span>
            <span className="text-muted-foreground">{a.radiusKm.toFixed(1)} km</span>
          </div>
          <Slider
            value={[a.radiusKm]}
            min={0.5}
            max={25}
            step={0.5}
            onValueChange={(v) => actions.setAlerts({ radiusKm: v[0] })}
            className="mt-3"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Block</span>
            <span>Neighborhood</span>
            <span>City</span>
          </div>
        </div>

        <label className="flex items-center justify-between text-sm">
          <span className="font-medium">Notify me about new stories</span>
          <Switch checked={a.notifyStories} onCheckedChange={(v) => actions.setAlerts({ notifyStories: v })} />
        </label>

        <div>
          <div className="text-sm font-medium">Incident categories</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((c) => {
              const meta = INCIDENT_META[c];
              const on = a.categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => actions.toggleAlertCategory(c)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    on ? "text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                  style={on ? { background: meta.color } : undefined}
                >
                  <span>{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bell button with unread badge + slide-down drawer. */
export function AlertsBell() {
  const unread = useUnreadCount();
  const items = useNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) notifications.markAllRead();
  }, [open, items.length]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-card hover:bg-muted/40"
      >
        {unread > 0 ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-[min(22rem,90vw)] rounded-2xl border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">Nearby alerts</div>
              <div className="flex items-center gap-1">
                {items.length > 0 && (
                  <button
                    onClick={() => notifications.clear()}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No alerts yet. New activity within your radius will show up here.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => {
                    const meta = n.kind === "story" ? null : INCIDENT_META[n.kind as IncidentKind];
                    return (
                      <li key={n.id} className="px-4 py-3">
                        <div className="flex gap-2.5">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                            style={{ background: meta ? `${meta.color}22` : "oklch(0.42 0.09 215 / 0.12)" }}
                          >
                            {meta ? meta.emoji : "📰"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              <span style={{ color: meta?.color }}>{meta ? meta.label : "Story"}</span>
                              <span> · {n.distanceKm.toFixed(1)} km · {n.source}</span>
                            </div>
                            <div className="text-sm font-medium leading-snug line-clamp-2">{n.title}</div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Imperatively raise alerts for any pins matching the user's preferences. */
export function raiseAlertsForPins(
  pins: { id: string; kind: string; title: string; detail: string; source: string; storyId?: string; lat: number; lng: number }[],
  center: { lat: number; lng: number },
  user: ReturnType<typeof useUser>,
  distanceKm: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number,
) {
  const a = user.alerts;
  if (!a.enabled) return;
  const matches: typeof pins = [];
  for (const p of pins) {
    if (notifications.hasSeen(p.id)) continue;
    const d = distanceKm(center, { lat: p.lat, lng: p.lng });
    if (d > a.radiusKm) continue;
    if (p.kind === "story") {
      if (!a.notifyStories) continue;
    } else if (!a.categories.includes(p.kind as IncidentKind)) {
      continue;
    }
    const added = notifications.add({
      pinId: p.id,
      kind: p.kind as IncidentKind | "story",
      title: p.title,
      detail: p.detail,
      source: p.source,
      storyId: p.storyId,
      distanceKm: d,
    });
    if (added) matches.push(p);
  }
  if (matches.length === 1) {
    const m = matches[0];
    const meta = m.kind === "story" ? null : INCIDENT_META[m.kind as IncidentKind];
    toast(`${meta?.emoji ?? "📰"} ${m.title}`, { description: `${m.source} · nearby` });
  } else if (matches.length > 1) {
    toast(`${matches.length} new nearby alerts`, { description: "Tap the bell to review." });
  }
}
