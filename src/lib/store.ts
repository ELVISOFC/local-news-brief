// Lightweight localStorage-backed user store. Swap with Lovable Cloud / Supabase later.
import { useEffect, useState, useSyncExternalStore } from "react";
import { SAMPLE_LOCATIONS, type Location, TOPICS, REGIONS, SOURCES, type WorldArticle } from "./mockData";
import type { IncidentKind } from "./incidents";

export type AlertSettings = {
  enabled: boolean;
  radiusKm: number; // 0.5 - 25
  notifyStories: boolean;
  categories: IncidentKind[]; // empty array = none, full list = all
};


export type Filters = {
  topics: string[];
  regions: string[];
  sources: string[];
  keyword: string;
  time: "today" | "week" | "month";
};

export type UserState = {
  onboarded: boolean;
  locations: Location[];
  activeLocationId: string;
  bookmarks: string[]; // story or article ids
  filters: Filters;
  voiceRate: number; // 1, 1.25, 1.5, 1.75, 2
  voiceId: string; // Lovable AI voice id (alloy, sage, verse, ...)
};

const KEY = "areanews_state_v1";

const defaultState: UserState = {
  onboarded: false,
  locations: [],
  activeLocationId: SAMPLE_LOCATIONS[0].id,
  bookmarks: [],
  filters: {
    topics: [...TOPICS],
    regions: [...REGIONS],
    sources: [...SOURCES],
    keyword: "",
    time: "today",
  },
  voiceRate: 1,
  voiceId: "alloy",
};

let state: UserState = load();
const listeners = new Set<() => void>();

function load(): UserState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return defaultState;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getState(): UserState {
  return state;
}

export function setState(updater: (s: UserState) => UserState) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useUser(): UserState {
  // SSR-safe: render default until hydrated, then hydrate from localStorage.
  const snap = useSyncExternalStore(subscribe, () => state, () => defaultState);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!hydrated) {
      state = load();
      setHydrated(true);
      listeners.forEach((l) => l());
    }
  }, [hydrated]);
  return snap;
}

// --- mutations ---
export const actions = {
  completeOnboarding(locations: Location[]) {
    setState((s) => ({ ...s, onboarded: true, locations, activeLocationId: locations[0]?.id ?? s.activeLocationId }));
  },
  addLocation(loc: Location) {
    setState((s) => ({ ...s, locations: [...s.locations, loc] }));
  },
  removeLocation(id: string) {
    setState((s) => {
      const locations = s.locations.filter((l) => l.id !== id);
      return { ...s, locations, activeLocationId: s.activeLocationId === id ? (locations[0]?.id ?? "") : s.activeLocationId };
    });
  },
  setActive(id: string) {
    setState((s) => ({ ...s, activeLocationId: id }));
  },
  toggleBookmark(id: string) {
    setState((s) => ({
      ...s,
      bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter((b) => b !== id) : [...s.bookmarks, id],
    }));
  },
  setFilters(f: Partial<Filters>) {
    setState((s) => ({ ...s, filters: { ...s.filters, ...f } }));
  },
  setVoiceRate(r: number) {
    setState((s) => ({ ...s, voiceRate: r }));
  },
  setVoiceId(id: string) {
    setState((s) => ({ ...s, voiceId: id }));
  },
  reset() {
    setState(() => defaultState);
  },
};

// --- world feed filtering ---
export function applyFilters(articles: WorldArticle[], f: Filters): WorldArticle[] {
  const now = Date.now();
  const maxAge =
    f.time === "today" ? 24 * 3600 * 1000 :
    f.time === "week" ? 7 * 24 * 3600 * 1000 :
    30 * 24 * 3600 * 1000;
  const kw = f.keyword.trim().toLowerCase();
  return articles.filter((a) => {
    if (!f.topics.includes(a.topic)) return false;
    if (!f.regions.includes(a.region)) return false;
    if (!f.sources.includes(a.source)) return false;
    if (now - new Date(a.publishedAt).getTime() > maxAge) return false;
    if (kw && !(a.headline + " " + a.body).toLowerCase().includes(kw)) return false;
    return true;
  });
}
