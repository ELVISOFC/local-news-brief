// Streaming TTS client backed by the Lovable AI Gateway (openai/gpt-4o-mini-tts).
// Streams 24kHz PCM via SSE and schedules chunks on a Web Audio context for
// low-latency playback. Returns a handle that supports stop/pause/resume.

export type SpeechHandle = {
  stop: () => void;
  pause: () => void;
  resume: () => void;
};

export type VoiceOption = {
  id: string;
  label: string;
  description: string;
};

// Curated subset of OpenAI voices exposed by the gateway.
export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "alloy", label: "Alloy", description: "Balanced, neutral newsreader" },
  { id: "sage", label: "Sage", description: "Calm, measured anchor" },
  { id: "verse", label: "Verse", description: "Warm, conversational host" },
  { id: "coral", label: "Coral", description: "Bright, friendly" },
  { id: "ballad", label: "Ballad", description: "Smooth, reflective" },
  { id: "ash", label: "Ash", description: "Grounded baritone" },
  { id: "echo", label: "Echo", description: "Clear, confident" },
  { id: "shimmer", label: "Shimmer", description: "Light, upbeat" },
  { id: "marin", label: "Marin", description: "Natural, expressive" },
  { id: "cedar", label: "Cedar", description: "Deep, narrator" },
];

export const DEFAULT_VOICE = "alloy";

export function isSpeechSupported() {
  if (typeof window === "undefined") return false;
  return typeof window.AudioContext !== "undefined" ||
    typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== "undefined";
}

type SpeakOpts = {
  voice?: string;
  speed?: number; // 0.25..4
  instructions?: string;
  audioContext?: AudioContext; // pass one created in a user-gesture handler for reliable playback
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
};

export function createAudioContext(): AudioContext | null {
  if (!isSpeechSupported()) return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AC({ sampleRate: 24000 });
}

export function speak(text: string, opts: SpeakOpts = {}): SpeechHandle {
  const noop: SpeechHandle = { stop() {}, pause() {}, resume() {} };
  if (!isSpeechSupported() || !text.trim()) {
    queueMicrotask(() => opts.onEnd?.());
    return noop;
  }

  const ctx = opts.audioContext ?? createAudioContext()!;
  const ownsContext = !opts.audioContext;
  const abort = new AbortController();

  let playhead = 0;
  let pending = new Uint8Array(0);
  let started = false;
  let stopped = false;
  let scheduledSources: AudioBufferSourceNode[] = [];
  let lastEndsAt = 0;
  let streamDone = false;
  let endFired = false;
  let endTimer: ReturnType<typeof setTimeout> | null = null;

  const fireEnd = () => {
    if (endFired || stopped) return;
    endFired = true;
    opts.onEnd?.();
    if (ownsContext) ctx.close().catch(() => {});
  };

  const scheduleEndCheck = () => {
    if (!streamDone || stopped) return;
    if (endTimer) clearTimeout(endTimer);
    const remaining = Math.max(0, lastEndsAt - ctx.currentTime);
    endTimer = setTimeout(fireEnd, Math.ceil(remaining * 1000) + 50);
  };

  const playChunk = (incoming: Uint8Array) => {
    if (stopped) return;
    const bytes = new Uint8Array(pending.length + incoming.length);
    bytes.set(pending);
    bytes.set(incoming, pending.length);
    const usable = bytes.length - (bytes.length % 2);
    pending = bytes.slice(usable);
    if (usable === 0) return;
    const samples = new Int16Array(bytes.buffer, 0, usable / 2);
    const floats = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) floats[i] = samples[i] / 32768;
    const buffer = ctx.createBuffer(1, floats.length, 24000);
    buffer.copyToChannel(floats, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    if (playhead === 0) {
      playhead = ctx.currentTime + 0.05;
      if (!started) {
        started = true;
        opts.onStart?.();
      }
    } else {
      playhead = Math.max(playhead, ctx.currentTime);
    }
    source.start(playhead);
    playhead += buffer.duration;
    lastEndsAt = playhead;
    scheduledSources.push(source);
    source.onended = () => {
      scheduledSources = scheduledSources.filter((s) => s !== source);
    };
  };

  const run = async () => {
    try {
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: opts.voice || DEFAULT_VOICE,
          speed: opts.speed,
          instructions: opts.instructions,
        }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `TTS request failed: ${res.status}`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = raw.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload) as { type: string; audio?: string };
            if (evt.type === "speech.audio.delta" && evt.audio) {
              const bin = atob(evt.audio);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              playChunk(bytes);
            }
          } catch {
            /* ignore malformed events */
          }
        }
      }
      streamDone = true;
      scheduleEndCheck();
    } catch (err) {
      if (stopped || abort.signal.aborted) return;
      stopped = true;
      if (endTimer) clearTimeout(endTimer);
      scheduledSources.forEach((s) => { try { s.stop(); } catch { /* noop */ } });
      scheduledSources = [];
      if (ownsContext) ctx.close().catch(() => {});
      opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  void run();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      abort.abort();
      if (endTimer) clearTimeout(endTimer);
      scheduledSources.forEach((s) => {
        try { s.stop(); } catch { /* noop */ }
      });
      scheduledSources = [];
      if (ownsContext) ctx.close().catch(() => {});
    },
    pause() {
      if (stopped) return;
      ctx.suspend().catch(() => {});
    },
    resume() {
      if (stopped) return;
      ctx.resume().catch(() => {});
    },
  };
}
