import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, Rewind, FastForward, Gauge, FileText } from "lucide-react";
import { actions, useUser } from "@/lib/store";
import { getBriefing, SAMPLE_LOCATIONS } from "@/lib/mockData";
import { speak, createAudioContext, type SpeechHandle } from "@/lib/speech";
import { StoryArt } from "@/components/StoryArt";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DebugTimeline, DebugToggleButton } from "@/components/DebugTimeline";
import { log as dlog } from "@/lib/debug-log";

export const Route = createFileRoute("/player")({
  head: () => ({ meta: [{ title: "Briefing — AreaNews" }] }),
  component: Player,
});

function Player() {
  const navigate = useNavigate();
  const user = useUser();
  const activeLocation =
    user.locations.find((l) => l.id === user.activeLocationId) ??
    user.locations[0] ??
    SAMPLE_LOCATIONS[0];
  const briefing = useMemo(() => getBriefing(activeLocation.id) ?? getBriefing("austin")!, [activeLocation.id]);
  const stories = briefing.stories;

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showText, setShowText] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const handleRef = useRef<SpeechHandle | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Approximate per-story duration based on word count + rate (visual progress only)
  const durations = useMemo(
    () => stories.map((s) => Math.max(20, Math.round((s.body.split(/\s+/).length / (2.6 * user.voiceRate)))) ),
    [stories, user.voiceRate],
  );
  const totalDuration = durations.reduce((a, b) => a + b, 0);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;

  // Ticker for progress
  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => {
      setElapsed((e) => Math.min(e + 0.25, totalDuration));
    }, 250);
    return () => clearInterval(t);
  }, [isPlaying, totalDuration]);

  // Start streaming TTS for current story when index changes & playing
  useEffect(() => {
    if (!isPlaying) return;
    const story = stories[index];
    setTtsError(null);
    dlog("player:story-change", `story ${index + 1}/${stories.length}`, story.headline);
    const handle = speak(story.body, {
      voice: user.voiceId,
      speed: user.voiceRate,
      audioContext: audioCtxRef.current ?? undefined,
      onEnd: () => {
        if (index < stories.length - 1) {
          setIndex((i) => i + 1);
        } else {
          setIsPlaying(false);
        }
      },
      onError: (err) => {
        setTtsError(err.message);
        setIsPlaying(false);
      },
    });
    handleRef.current = handle;
    return () => {
      handle.stop();
      if (handleRef.current === handle) handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isPlaying, user.voiceRate, user.voiceId]);

  useEffect(() => () => {
    handleRef.current?.stop();
    audioCtxRef.current?.close().catch(() => {});
  }, []);

  function togglePlay() {
    if (!isPlaying) {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = createAudioContext();
      }
      audioCtxRef.current?.resume().catch(() => {});
      dlog("player:play", "user pressed play");
      setIsPlaying(true);
    } else {
      handleRef.current?.stop();
      handleRef.current = null;
      dlog("player:pause", "user pressed pause");
      setIsPlaying(false);
    }
  }

  function seekStory(delta: number) {
    handleRef.current?.stop();
    handleRef.current = null;
    const next = Math.max(0, Math.min(stories.length - 1, index + delta));
    dlog("player:seek", `delta ${delta > 0 ? "+" : ""}${delta}`, `→ story ${next + 1}`);
    setIndex(next);
    const e = durations.slice(0, next).reduce((a, b) => a + b, 0);
    setElapsed(e);
  }

  function setStory(i: number) {
    handleRef.current?.stop();
    handleRef.current = null;
    dlog("player:seek", `jump`, `→ story ${i + 1}`);
    setIndex(i);
    const e = durations.slice(0, i).reduce((a, b) => a + b, 0);
    setElapsed(e);
  }

  const current = stories[index];
  const pct = totalDuration ? (elapsed / totalDuration) * 100 : 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.36 0.09 220) 0%, oklch(0.25 0.07 235) 100%)",
        color: "white",
      }}
    >
      <div className="flex items-center justify-between px-5 pt-6">
        <button onClick={() => navigate({ to: "/area" })} className="h-9 w-9 rounded-full bg-white/10 grid place-items-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider opacity-70">Briefing for</div>
          <div className="text-sm font-medium">{activeLocation.city}, {activeLocation.state}</div>
        </div>
        <button
          onClick={() => setShowText((v) => !v)}
          className="h-9 w-9 rounded-full bg-white/10 grid place-items-center"
          aria-label="Read instead"
        >
          <FileText className="h-5 w-5" />
        </button>
      </div>

      <div className="px-6 mt-6 flex flex-col items-center">
        <StoryArt hue={current.imageHue} size="lg" />
        <div className="mt-5 text-[11px] uppercase tracking-wider opacity-70">
          Story {index + 1} of {stories.length} · {current.category}
        </div>
        <h2 className="mt-1 text-center text-xl font-semibold leading-snug text-balance">{current.headline}</h2>
        <div className="mt-1 text-sm opacity-80">{current.source}</div>

        {showText ? (
          <div className="mt-4 max-h-44 overflow-y-auto rounded-2xl bg-white/8 p-4 text-sm leading-relaxed">
            {current.body}
          </div>
        ) : (
          <p className="mt-3 text-center text-sm opacity-85 text-balance">{current.summary}</p>
        )}
      </div>

      {/* Progress */}
      <div className="mt-auto px-6">
        <div className="flex gap-1">
          {stories.map((_, i) => {
            const before = durations.slice(0, i).reduce((a, b) => a + b, 0);
            const segPct = Math.max(0, Math.min(1, (elapsed - before) / durations[i])) * 100;
            return (
              <button
                key={i}
                onClick={() => setStory(i)}
                className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden"
              >
                <div className="h-full bg-white" style={{ width: `${segPct}%` }} />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs opacity-70">
          <span>{fmt(elapsed)}</span>
          <span>-{fmt(Math.max(0, totalDuration - elapsed))}</span>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-sm">
              <Gauge className="h-4 w-4" /> {user.voiceRate}x
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {[1, 1.25, 1.5, 1.75, 2].map((r) => (
                <DropdownMenuItem key={r} onClick={() => actions.setVoiceRate(r)}>{r}x</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button onClick={() => seekStory(-1)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10">
            <Rewind className="h-5 w-5" />
          </button>

          <button
            onClick={togglePlay}
            className="grid h-16 w-16 place-items-center rounded-full bg-white text-primary shadow-lg"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current pl-0.5" />}
          </button>

          <button onClick={() => seekStory(1)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10">
            <FastForward className="h-5 w-5" />
          </button>

          <div className="w-[60px] text-right text-xs opacity-70">
            {Math.round(pct)}%
          </div>
        </div>

        {ttsError ? (
          <div className="mt-3 rounded-lg bg-red-500/20 p-2 text-center text-xs">
            Audio failed: {ttsError}
          </div>
        ) : null}

        <div className="safe-bottom mt-4" />
      </div>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
