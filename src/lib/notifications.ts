// In-app notification feed (ring buffer, persisted). Drives the bell badge
// on the Nearby tab and the notification drawer.
import { useSyncExternalStore } from "react";
import type { Pin } from "./incidents";

export type Notification = {
  id: string;
  pinId: string;
  kind: Pin["kind"];
  title: string;
  detail: string;
  source: string;
  distanceKm: number;
  storyId?: string;
  createdAt: number;
  read: boolean;
};

const KEY = "areanews_notifications_v1";
const SEEN_KEY = "areanews_notif_seen_v1"; // pin ids we've already alerted on
const MAX = 60;

type Store = { items: Notification[]; seen: Set<string> };

function load(): Store {
  if (typeof window === "undefined") return { items: [], seen: new Set() };
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || "[]") as Notification[];
    const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
    return { items, seen };
  } catch {
    return { items: [], seen: new Set() };
  }
}

let store: Store = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(store.items));
  localStorage.setItem(SEEN_KEY, JSON.stringify([...store.seen]));
}

function emit() {
  listeners.forEach((l) => l());
}

export const notifications = {
  list(): Notification[] {
    return store.items;
  },
  unreadCount(): number {
    return store.items.filter((n) => !n.read).length;
  },
  hasSeen(pinId: string): boolean {
    return store.seen.has(pinId);
  },
  add(n: Omit<Notification, "id" | "createdAt" | "read">) {
    if (store.seen.has(n.pinId)) return;
    store.seen.add(n.pinId);
    const item: Notification = {
      ...n,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      read: false,
    };
    store.items = [item, ...store.items].slice(0, MAX);
    persist();
    emit();
    return item;
  },
  markAllRead() {
    store.items = store.items.map((n) => ({ ...n, read: true }));
    persist();
    emit();
  },
  clear() {
    store.items = [];
    store.seen = new Set();
    persist();
    emit();
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useNotifications() {
  return useSyncExternalStore(
    subscribe,
    () => store.items,
    () => [] as Notification[],
  );
}

export function useUnreadCount() {
  return useSyncExternalStore(
    subscribe,
    () => store.items.filter((n) => !n.read).length,
    () => 0,
  );
}
