import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Headphones, Play, Sparkles, Clock, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageShell } from "@/components/BottomNav";
import { StoryArt } from "@/components/StoryArt";
import { actions, useUser } from "@/lib/store";
import { getBriefing, SAMPLE_LOCATIONS } from "@/lib/mockData";

export const Route = createFileRoute("/area")({
  head: () => ({
    meta: [
      { title: "My Area — AreaNews" },
      { name: "description", content: "Your personalized local audio briefing." },
    ],
  }),
  component: AreaPage,
});

function AreaPage() {
  const user = useUser();
  const navigate = useNavigate();
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
  }, []);

  const activeLocation =
    user.locations.find((l) => l.id === user.activeLocationId) ??
    user.locations[0] ??
    SAMPLE_LOCATIONS[0];

  const briefing = useMemo(() => {
    const base = getBriefing(activeLocation.id) ?? getBriefing("austin")!;
    const picks = user.filters.sources;
    // Filter briefing stories to the user's saved outlets. If none of the
    // briefing sources are selected, fall back to the full set so the user
    // still gets a briefing rather than an empty one.
    const filtered = base.stories.filter((s) => picks.includes(s.source));
    return { ...base, stories: filtered.length > 0 ? filtered : base.stories };
  }, [activeLocation.id, user.filters.sources]);

  // Persist generated state per day per location AND outlet selection so a
  // changed outlet list forces a fresh briefing instead of showing a stale one.
  const outletSig = useMemo(
    () => [...user.filters.sources].sort().join("|"),
    [user.filters.sources],
  );
  const storageKey = `briefing_ready_${briefing.locationId}_${briefing.date}_${outletSig}`;
  useEffect(() => {
    if (typeof window === "undefined") return;
    setGenerated(localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  function handleGenerate() {
    setGenerating(true);
    // Simulate the pipeline: aggregate -> summarize -> TTS
    setTimeout(() => {
      localStorage.setItem(storageKey, "1");
      setGenerated(true);
      setGenerating(false);
    }, 1400);
  }

  return (
    <PageShell>
      <div className="px-5 pt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary">
            <Headphones className="h-4 w-4" />
            <span className="text-sm font-semibold">AreaNews</span>
          </div>
          <Link to="/settings" className="text-xs text-muted-foreground">Settings</Link>
        </div>

        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Your briefing for</div>
          <DropdownMenu>
            <DropdownMenuTrigger className="mt-1 flex items-center gap-1.5">
              <h1 className="text-2xl font-semibold leading-tight">
                {activeLocation.city}, {activeLocation.state}
              </h1>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {user.locations.map((l) => (
                <DropdownMenuItem key={l.id} onClick={() => actions.setActive(l.id)}>
                  <span className="font-medium">{l.label}</span>
                  <span className="ml-2 text-muted-foreground text-xs">{l.city}, {l.state}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                + Add location
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {activeLocation.county ? (
            <div className="text-sm text-muted-foreground">{activeLocation.county}</div>
          ) : null}
        </div>

        {/* Briefing hero card */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
          <div
            className="relative px-6 pt-6 pb-5"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.42 0.09 215) 0%, oklch(0.55 0.1 195) 60%, oklch(0.72 0.11 175) 100%)",
              color: "white",
            }}
          >
            <div className="text-[11px] uppercase tracking-wider opacity-80" suppressHydrationWarning>{todayLabel}</div>
            <div className="mt-1 flex items-end justify-between">
              <div>
                <div className="text-2xl font-semibold">5-min briefing</div>
                <div className="text-sm opacity-85">{briefing.stories.length} stories</div>
              </div>
              <div className="text-3xl font-display font-semibold">5:00</div>
            </div>

            {generated ? (
              <button
                onClick={() => navigate({ to: "/player" })}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 font-medium text-primary shadow"
              >
                <Play className="h-5 w-5 fill-current" />
                Play briefing
              </button>
            ) : (
              <button
                disabled={generating}
                onClick={handleGenerate}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 font-medium text-primary shadow disabled:opacity-70"
              >
                {generating ? (
                  <>
                    <Sparkles className="h-5 w-5 animate-pulse" />
                    Generating your briefing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate my briefing
                  </>
                )}
              </button>
            )}
          </div>

          <div className="px-5 py-4 text-sm text-muted-foreground">
            <Clock className="mr-1.5 inline h-3.5 w-3.5" />
            {generated ? "Ready • updated this morning" : "Tap above to generate today's briefing"}
          </div>
        </div>

        <h2 className="mt-8 text-lg font-semibold">Top stories</h2>
        <p className="text-sm text-muted-foreground">Curated from local outlets and county feeds.</p>

        <div className="mt-3 space-y-3">
          {briefing.stories.map((s, i) => (
            <Link
              key={s.id}
              to="/article/$id"
              params={{ id: s.id }}
              className="flex gap-3 rounded-2xl bg-surface p-3 border border-border shadow-card transition-transform active:scale-[0.99]"
            >
              <StoryArt hue={s.imageHue} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary">
                  <span>{i + 1}</span>·<span>{s.category}</span>
                </div>
                <div className="mt-0.5 font-medium leading-snug line-clamp-2">{s.headline}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.summary}</div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{s.source}</span>
                  <BookmarkBtn id={s.id} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

function BookmarkBtn({ id }: { id: string }) {
  const user = useUser();
  const saved = user.bookmarks.includes(id);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        actions.toggleBookmark(id);
      }}
      aria-label="Bookmark"
      className="text-muted-foreground"
    >
      <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-primary text-primary" : ""}`} />
    </button>
  );
}
