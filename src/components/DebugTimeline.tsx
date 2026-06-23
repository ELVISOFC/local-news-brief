import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bug, X, Trash2 } from "lucide-react";
import {
  getAll,
  subscribe,
  clearLog,
  isDebugEnabled,
  setDebugEnabled,
  type DebugEntry,
} from "@/lib/debug-log";

const TYPE_COLOR: Record<string, string> = {
  "request:start": "text-blue-300",
  "request:status": "text-blue-200",
  "request:error": "text-red-300",
  "stream:first-chunk": "text-emerald-300",
  "stream:done": "text-emerald-200",
  "decode:chunk": "text-slate-300",
  "audio:start": "text-emerald-400",
  "audio:underrun": "text-amber-300",
  "audio:end": "text-emerald-200",
  "ctx:state": "text-purple-300",
  "player:play": "text-cyan-300",
  "player:pause": "text-cyan-300",
  "player:stop": "text-cyan-300",
  "player:seek": "text-cyan-300",
  "player:story-change": "text-cyan-200",
};

function useDebugFlag() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(isDebugEnabled());
    return subscribe(() => setEnabled(isDebugEnabled()));
  }, []);
  return enabled;
}

function useEntries(): DebugEntry[] {
  return useSyncExternalStore(subscribe, getAll, () => []);
}

export function DebugTimeline() {
  const enabled = useDebugFlag();
  const entries = useEntries();
  const [open, setOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries, open]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[320px] max-w-[90vw] rounded-xl bg-black/85 text-white shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <button
          className="flex items-center gap-1.5 text-xs font-semibold"
          onClick={() => setOpen((v) => !v)}
        >
          <Bug className="h-3.5 w-3.5" /> TTS debug ({entries.length})
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => clearLog()} title="Clear" className="opacity-70 hover:opacity-100">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setDebugEnabled(false)}
            title="Hide debug"
            className="opacity-70 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {open ? (
        <div
          ref={listRef}
          className="max-h-72 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed"
        >
          {entries.length === 0 ? (
            <div className="opacity-50">No events yet — start playback.</div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex gap-2">
                <span className="w-12 shrink-0 tabular-nums opacity-50">+{e.t}ms</span>
                <span className={`w-32 shrink-0 ${TYPE_COLOR[e.type] ?? "text-white"}`}>
                  {e.type}
                </span>
                <span className="flex-1">
                  {e.label}
                  {e.detail ? <span className="opacity-60"> · {e.detail}</span> : null}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

// Tiny corner toggle that's always visible so the panel can be turned on
// without opening devtools.
export function DebugToggleButton() {
  const enabled = useDebugFlag();
  if (enabled) return null;
  return (
    <button
      onClick={() => setDebugEnabled(true)}
      className="fixed bottom-4 right-4 z-50 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white/70 hover:text-white"
      title="Enable TTS debug"
    >
      <Bug className="h-4 w-4" />
    </button>
  );
}
