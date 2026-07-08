// Client-side helpers for live news feeds + a small localStorage cache used
// by the Area briefing, Player, and Article pages so all three surfaces
// share the same fetched-and-summarized stories.

import type { WorldArticle, Story, Briefing } from "./mockData";

export type LiveStory = Story & { link?: string };
export type LiveWorldArticle = WorldArticle & { link?: string };

const BRIEFING_KEY = (locId: string, date: string, sig: string) =>
  `briefing_live_v1_${locId}_${date}_${sig}`;
const ARTICLES_KEY = "articles_index_v1";

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- Briefing cache ---

export function saveBriefing(locId: string, date: string, sig: string, b: Briefing) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BRIEFING_KEY(locId, date, sig), JSON.stringify(b));
  // also index every story for cross-page lookup (player, article)
  const idx = readIndex();
  for (const s of b.stories) idx[s.id] = s;
  writeIndex(idx);
}

export function loadBriefing(locId: string, date: string, sig: string): Briefing | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BRIEFING_KEY(locId, date, sig));
    return raw ? (JSON.parse(raw) as Briefing) : null;
  } catch {
    return null;
  }
}

function readIndex(): Record<string, LiveStory | LiveWorldArticle> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ARTICLES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeIndex(idx: Record<string, LiveStory | LiveWorldArticle>) {
  if (typeof window === "undefined") return;
  // cap size (~200 items) to bound growth
  const entries = Object.entries(idx);
  const trimmed = entries.slice(-200);
  localStorage.setItem(ARTICLES_KEY, JSON.stringify(Object.fromEntries(trimmed)));
}

export function cacheArticles(items: Array<LiveStory | LiveWorldArticle>) {
  const idx = readIndex();
  for (const a of items) idx[a.id] = a;
  writeIndex(idx);
}

export function getCachedArticle(id: string): LiveStory | LiveWorldArticle | null {
  const idx = readIndex();
  return idx[id] ?? null;
}

// --- Server fetchers ---

export type RawLocalStory = LiveStory & { link: string };

export async function fetchLocalStories(city: string, state: string): Promise<RawLocalStory[]> {
  const res = await fetch(`/api/news/local?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
  if (!res.ok) throw new Error(`local ${res.status}`);
  const data = (await res.json()) as { stories: RawLocalStory[] };
  return data.stories || [];
}

export type RawMunicipalStory = LiveStory & { link: string; official: true };
export type CustomFeedInput = { source: string; kind: string; url: string };

export async function fetchMunicipalStories(
  city: string,
  state: string,
  county?: string,
  custom?: CustomFeedInput[],
  refresh?: boolean,
): Promise<RawMunicipalStory[]> {
  const hasCustom = Array.isArray(custom) && custom.length > 0;
  const res = hasCustom
    ? await fetch(`/api/news/municipal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, state, county, custom, refresh }),
      })
    : await (() => {
        const params = new URLSearchParams({ city, state });
        if (county) params.set("county", county);
        if (refresh) params.set("refresh", "1");
        return fetch(`/api/news/municipal?${params.toString()}`);
      })();
  if (!res.ok) return [];
  const data = (await res.json()) as { stories: RawMunicipalStory[] };
  return data.stories || [];
}

export async function fetchWorldArticles(topics: string[]): Promise<LiveWorldArticle[]> {
  const q = topics.length ? `?topics=${encodeURIComponent(topics.join(","))}` : "";
  const res = await fetch(`/api/news/world${q}`);
  if (!res.ok) throw new Error(`world ${res.status}`);
  const data = (await res.json()) as { articles: LiveWorldArticle[] };
  return data.articles || [];
}

export async function summarizeStories(
  stories: Array<{ id: string; headline: string; source?: string; snippet?: string }>,
  city?: string,
  state?: string,
): Promise<Record<string, { summary: string; body: string; category: string }>> {
  const res = await fetch("/api/news/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stories, city, state }),
  });
  if (!res.ok) throw new Error(`summarize ${res.status}`);
  const data = (await res.json()) as {
    stories: { id: string; summary: string; body: string; category: string }[];
  };
  const map: Record<string, { summary: string; body: string; category: string }> = {};
  for (const s of data.stories) map[s.id] = { summary: s.summary, body: s.body, category: s.category };
  return map;
}

export function outletSignature(outlets: string[]): string {
  return [...outlets].sort().join("|");
}
