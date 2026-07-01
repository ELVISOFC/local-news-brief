import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X, Zap, Newspaper } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/BottomNav";
import { StoryArt } from "@/components/StoryArt";
import { actions, applyFilters, useUser } from "@/lib/store";
import { REGIONS, SOURCES, TOPICS, WORLD_ARTICLES } from "@/lib/mockData";

export const Route = createFileRoute("/world")({
  head: () => ({
    meta: [
      { title: "World — AreaNews" },
      { name: "description", content: "Personalized world news with powerful filters." },
    ],
  }),
  component: WorldPage,
});

function WorldPage() {
  const user = useUser();
  const [q, setQ] = useState(user.filters.keyword);

  const filtered = useMemo(
    () => applyFilters(WORLD_ARTICLES, { ...user.filters, keyword: q }),
    [user.filters, q],
  );

  const breaking = useMemo(() => {
    const cutoff = Date.now() - 2 * 3600 * 1000;
    return WORLD_ARTICLES
      .filter((a) => new Date(a.publishedAt).getTime() >= cutoff)
      .filter((a) => user.filters.sources.includes(a.source))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [user.filters.sources]);

  return (
    <PageShell>
      <div className="px-5 pt-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">World</h1>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </Button>
            </SheetTrigger>
            <FilterSheet />
          </Sheet>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search keywords (e.g. climate)"
            className="pl-9 h-11 rounded-full bg-surface"
          />
        </div>

        <ActiveChips />

        <div className="mt-4 text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "story" : "stories"} matching your filters
        </div>

        <div className="mt-3 space-y-3 pb-6">
          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-surface border border-border p-6 text-center">
              <div className="text-2xl">🗞️</div>
              <div className="mt-2 font-medium">Nothing matches</div>
              <div className="text-sm text-muted-foreground">Try widening your filters or clearing the keyword.</div>
            </div>
          ) : (
            filtered.map((a) => (
              <Link
                key={a.id}
                to="/article/$id"
                params={{ id: a.id }}
                className="block rounded-2xl bg-surface border border-border shadow-card p-3"
              >
                <div className="flex gap-3">
                  <StoryArt hue={a.imageHue} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary">
                      <span>{a.topic}</span>·<span className="text-muted-foreground normal-case tracking-normal">{a.region}</span>
                    </div>
                    <div className="mt-0.5 font-medium leading-snug line-clamp-2">{a.headline}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.summary}</div>
                    <div className="mt-1.5 text-[11px] text-muted-foreground">
                      {a.source} · {timeAgo(a.publishedAt)}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}

function ActiveChips() {
  const user = useUser();
  const allTopics = user.filters.topics.length === TOPICS.length;
  const allRegions = user.filters.regions.length === REGIONS.length;
  const allSources = user.filters.sources.length === SOURCES.length;

  const chips: { label: string; onClear: () => void }[] = [];
  if (!allTopics) chips.push({ label: `${user.filters.topics.length} topics`, onClear: () => actions.setFilters({ topics: [...TOPICS] }) });
  if (!allRegions) chips.push({ label: `${user.filters.regions.length} regions`, onClear: () => actions.setFilters({ regions: [...REGIONS] }) });
  if (!allSources) chips.push({ label: `${user.filters.sources.length} sources`, onClear: () => actions.setFilters({ sources: [...SOURCES] }) });
  if (user.filters.time !== "today") chips.push({ label: user.filters.time === "week" ? "Past week" : "Past month", onClear: () => actions.setFilters({ time: "today" }) });

  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <button key={c.label} onClick={c.onClear} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
          {c.label} <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

function FilterSheet() {
  const user = useUser();
  function toggle(arr: string[], v: string) {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }
  return (
    <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl">
      <SheetHeader>
        <SheetTitle>Filters</SheetTitle>
      </SheetHeader>

      <Section title="Time">
        <div className="flex gap-2">
          {(["today","week","month"] as const).map((t) => (
            <button
              key={t}
              onClick={() => actions.setFilters({ time: t })}
              className={chip(user.filters.time === t)}
            >
              {t === "today" ? "Today" : t === "week" ? "Past week" : "Past month"}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Topics">
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button key={t} onClick={() => actions.setFilters({ topics: toggle(user.filters.topics, t) })} className={chip(user.filters.topics.includes(t))}>
              {t}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Regions">
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <button key={r} onClick={() => actions.setFilters({ regions: toggle(user.filters.regions, r) })} className={chip(user.filters.regions.includes(r))}>
              {r}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sources">
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <button key={s} onClick={() => actions.setFilters({ sources: toggle(user.filters.sources, s) })} className={chip(user.filters.sources.includes(s))}>
              {s}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Keyword boost">
        <Input
          value={user.filters.keyword}
          onChange={(e) => actions.setFilters({ keyword: e.target.value })}
          placeholder="e.g. real estate"
          className="h-11"
        />
      </Section>

      <div className="sticky bottom-0 mt-6 -mx-6 -mb-6 border-t bg-surface p-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            actions.setFilters({
              topics: [...TOPICS],
              regions: [...REGIONS],
              sources: [...SOURCES],
              keyword: "",
              time: "today",
            })
          }
        >
          Reset filters
        </Button>
      </div>
    </SheetContent>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
function chip(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-sm transition-colors ${
    active ? "bg-primary text-primary-foreground border-primary" : "bg-surface text-foreground border-border"
  }`;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
