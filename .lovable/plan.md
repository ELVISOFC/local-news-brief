## Goal

Add a small in-app debug timeline overlay on the Player route that records lifecycle events from the streaming TTS pipeline, so pauses and stalls can be diagnosed at a glance.

## Events captured

Each entry is timestamped (ms since first event in the session) with a type, label, and optional details:

- `request:start` — `/api/tts` fetch initiated (voice, speed, text length)
- `request:status` — response status / ok / headers received
- `request:error` — fetch or stream error (message)
- `cache:hit` / `cache:miss` — for any cached PCM (preview cache reused here only if relevant; primary use is request path)
- `stream:first-chunk` — first SSE audio delta received (key "time to first audio")
- `stream:chunk` — periodic chunk count + bytes (throttled, not one per chunk)
- `stream:done` — SSE finished
- `decode:chunk` — decode duration per chunk (throttled / aggregated)
- `audio:start` — first AudioBufferSourceNode actually scheduled (onStart fired)
- `audio:underrun` — playhead fell behind currentTime (scheduling gap detected)
- `audio:end` — natural end
- `player:play` / `player:pause` / `player:stop` / `player:seek` / `player:story-change`
- `ctx:state` — AudioContext state changes (suspended/running/closed)

## Technical design

1. **New module `src/lib/debug-log.ts`**
   - Tiny ring buffer (max ~200 entries) of `{ t: number; type: string; label: string; detail?: string }`.
   - `log(type, label, detail?)`, `subscribe(fn)`, `getAll()`, `clear()`.
   - Pub/sub so React components can re-render.
   - Gated by a flag (`debugEnabled`) persisted in `localStorage` so it's off by default and zero-cost when disabled.

2. **Instrument `src/lib/speech.ts`**
   - Import `log` from debug-log.
   - Emit: `request:start` (before fetch), `request:status` (after `res`), `request:error`, `stream:first-chunk` (on first delta), `stream:done`, `decode:chunk` (with ms via `performance.now()` around the PCM conversion, throttled to every Nth chunk), `audio:start` (in the `onStart` branch), `audio:underrun` when `playhead < ctx.currentTime` at schedule time, `audio:end` (in `fireEnd`), `ctx:state` via `ctx.onstatechange`.
   - All emits no-op when debug is disabled.

3. **Instrument `src/routes/player.tsx`**
   - Emit `player:play`, `player:pause`, `player:stop`, `player:seek`, `player:story-change` at the existing handler sites.

4. **New component `src/components/DebugTimeline.tsx`**
   - Floating panel rendered in the Player (only when debug flag enabled).
   - Collapsible drawer pinned bottom-right with: toggle button (bug icon), Clear button, auto-scrolling list of events with relative timestamp `+123ms`, color-coded by category.
   - Subscribes to the debug-log store.

5. **Player UI changes**
   - Add a small "Debug" toggle (long-press on the speed pill, or a tiny icon near the back button) that flips the localStorage flag and shows/hides the timeline. Keep it visually unobtrusive.

## Out of scope

- No network-tab style request inspector, no waveform display.
- No remote log shipping; purely in-memory + console mirror when enabled.
- No changes to the TTS server route or caching behavior.

## Files

- create `src/lib/debug-log.ts`
- create `src/components/DebugTimeline.tsx`
- edit `src/lib/speech.ts` (instrumentation only)
- edit `src/routes/player.tsx` (instrumentation + debug toggle + mount `<DebugTimeline />`)
