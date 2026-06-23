// Tiny in-memory ring buffer + pub/sub for player debugging.
// Off by default — flip via localStorage `tts-debug` = "1" (or call setDebugEnabled).

export type DebugEntry = {
  id: number;
  t: number; // ms since first entry in current session
  type: string;
  label: string;
  detail?: string;
};

const MAX = 200;
const STORAGE_KEY = "tts-debug";

let entries: DebugEntry[] = [];
let listeners = new Set<() => void>();
let nextId = 1;
let originTs: number | null = null;
let enabled = false;

if (typeof window !== "undefined") {
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    /* ignore */
  }
}

function emit() {
  for (const fn of listeners) fn();
}

export function isDebugEnabled() {
  return enabled;
}

export function setDebugEnabled(next: boolean) {
  enabled = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  emit();
}

export function log(type: string, label: string, detail?: string) {
  if (!enabled) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (originTs === null) originTs = now;
  const entry: DebugEntry = {
    id: nextId++,
    t: Math.round(now - originTs),
    type,
    label,
    detail,
  };
  entries.push(entry);
  if (entries.length > MAX) entries = entries.slice(-MAX);
  // Mirror to console for power users
  // eslint-disable-next-line no-console
  console.debug(`[tts +${entry.t}ms] ${type} — ${label}${detail ? " :: " + detail : ""}`);
  emit();
}

export function getAll(): DebugEntry[] {
  return entries;
}

export function clearLog() {
  entries = [];
  originTs = null;
  emit();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
