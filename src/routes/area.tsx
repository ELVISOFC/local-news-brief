import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Headphones, Play, Sparkles, Clock, Bookmark, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageShell } from "@/components/BottomNav";
import { StoryArt } from "@/components/StoryArt";
import { actions, useUser } from "@/lib/store";
import { getBriefing, SAMPLE_LOCATIONS, type Briefing } from "@/lib/mockData";
import {
  fetchLocalStories,
  fetchMunicipalStories,
  summarizeStories,
  saveBriefing,
  loadBriefing,
  cacheArticles,
  outletSignature,
  todayKey,
} from "@/lib/news";

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
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayLabel, setTodayLabel] = useState("");
  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
    );
  }, []);

  const activeLocation =
    user.locations.find((l) => l.id === user.activeLocationId) ??
    user.locations[0] ??
    SAMPLE_LOCATIONS[0];

  const outletSig = useMemo(() => outletSignature(user.filters.sources), [user.filters.sources]);
  const date = todayKey();

  // Load cached live briefing on mount / location change.
  useEffect(() => {
    setError(null);
    const cached = loadBriefing(activeLocation.id, date, outletSig);
    if (cached && cached.stories.length > 0) {
      setBriefing(cached);
    } else {
      setBriefing(null);
    }
  }, [activeLocation.id, date, outletSig]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const [muniRes, localRes] = await Promise.allSettled([
        fetchMunicipalStories(activeLocation.city, activeLocation.state, activeLocation.county),
        fetchLocalStories(activeLocation.city, activeLocation.state),
      ]);
      const muni = muniRes.status === "fulfilled" ? muniRes.value : [];
      const local = localRes.status === "fulfilled" ? localRes.value : [];

      // Prefer up to 2 official items at the top, then fill with Google News.
      const officialTop = muni.slice(0, 2);
      const officialKeys = new Set(officialTop.map((s) => s.headline.toLowerCase()));
      const filler = local.filter((s) => !officialKeys.has(s.headline.toLowerCase()));
      const raw = [...officialTop, ...filler].slice(0, 6);
      if (raw.length === 0) throw new Error("no-stories");

      // Summarize with Lovable AI so bodies read cleanly through TTS.
      let summaries: Record<string, { summary: string; body: string; category: string }> = {};
      try {
        summaries = await summarizeStories(
          raw.slice(0, 6).map((s) => ({
            id: s.id,
            headline: s.headline,
            source: s.source,
            snippet: s.summary,
          })),
          activeLocation.city,
          activeLocation.state,
        );
      } catch {
        // If summarization is unavailable we still show the raw items.
      }

      const officialIds = new Set(officialTop.map((s) => s.id));
      const stories = raw.map((s) => {
        const sum = summaries[s.id];
        const isOfficial = officialIds.has(s.id);
        return {
          ...s,
          summary: sum?.summary ?? s.summary,
          body: sum?.body ?? s.body,
          // Keep the municipal category ("City", "County", "Police", …) so
          // official items are visibly distinct from Google News stories.
          category: isOfficial ? s.category : sum?.category ?? s.category,
        };
      });
      const built: Briefing = {
        locationId: activeLocation.id,
        date,
        intro: `Here are the top ${stories.length} stories around ${activeLocation.city} today.`,
        stories,
      };
      saveBriefing(activeLocation.id, date, outletSig, built);
      cacheArticles(stories);
      setBriefing(built);
    } catch (err) {
      // Fallback to the sample briefing when we recognize the location.
      const mock = getBriefing(activeLocation.id);
      if (mock) {
        saveBriefing(activeLocation.id, date, outletSig, mock);
        cacheArticles(mock.stories);
        setBriefing(mock);
        setError("Showing sample stories — live feed unavailable.");
      } else {
        setError(
          err instanceof Error && err.message === "no-stories"
            ? "No local stories found for this area yet."
            : "Couldn't reach the live news feed. Try again in a moment.",
        );
      }
    } finally {
      setGenerating(false);
    }
  }

  const generated = !!briefing;

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
                  <span className="ml-2 text-muted-foreground text-xs">
                    {l.city}, {l.state}
                  </span>
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
            <div className="text-[11px] uppercase tracking-wider opacity-80" suppressHydrationWarning>
              {todayLabel}
            </div>
            <div className="mt-1 flex items-end justify-between">
              <div>
                <div className="text-2xl font-semibold">5-min briefing</div>
                <div className="text-sm opacity-85">
                  {generated ? `${briefing!.stories.length} stories` : "Live from local publishers"}
                </div>
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
                    Aggregating & summarizing…
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
            {generated
              ? "Ready • sourced live from Google News + local outlets"
              : "Tap above to fetch today's local headlines"}
          </div>
        </div>

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>{error}</div>
          </div>
        ) : null}

        <h2 className="mt-8 text-lg font-semibold">Top stories</h2>
        <p className="text-sm text-muted-foreground">
          {generated
            ? "Live headlines from local outlets."
            : "Generate your briefing to see today's headlines."}
        </p>

        <div className="mt-3 space-y-3">
          {generated
            ? briefing!.stories.map((s, i) => (
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
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-2xl border border-dashed border-border bg-surface/50 p-3"
                >
                  <div className="h-16 w-16 shrink-0 rounded-xl bg-muted/40" />
                  <div className="min-w-0 flex-1">
                    <div className="h-3 w-24 rounded bg-muted/40" />
                    <div className="mt-2 h-4 w-full rounded bg-muted/40" />
                    <div className="mt-1.5 h-3 w-2/3 rounded bg-muted/30" />
                  </div>
                </div>
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
