import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bookmark, ExternalLink, Pause, Play, Share2 } from "lucide-react";
import { WORLD_ARTICLES } from "@/lib/mockData";
import { getBriefing } from "@/lib/mockData";
import { getCachedArticle } from "@/lib/news";
import { actions, useUser } from "@/lib/store";
import { StoryArt } from "@/components/StoryArt";
import { speak, isSpeechSupported, type SpeechHandle } from "@/lib/speech";
import { cleanHeadline, cleanText, safeHostname } from "@/lib/text-clean";

export const Route = createFileRoute("/article/$id")({
  head: () => ({ meta: [{ title: "Article — AreaNews" }] }),
  component: Article,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-semibold">Article not found</h1>
    </div>
  ),
});

function Article() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const user = useUser();
  const [playing, setPlaying] = useState(false);
  const handleRef = useRef<SpeechHandle | null>(null);

  // Look up in the live cache first, then world articles, then sample briefings.
  const item = useMemo(() => {
    const cached = getCachedArticle(id);
    if (cached) {
      const category = "topic" in cached ? (cached as { topic: string }).topic : (cached as { category: string }).category;
      return { ...cached, category } as typeof cached & { category: string };
    }
    const w = WORLD_ARTICLES.find((a) => a.id === id);
    if (w) return { ...w, category: w.topic, source: w.source };
    for (const locId of ["austin", "miami", "sf"]) {
      const b = getBriefing(locId);
      const s = b?.stories.find((s) => s.id === id);
      if (s) return s;
    }
    return null;
  }, [id]);

  const clean = useMemo(() => {
    if (!item) return null;
    const headline = cleanHeadline((item as { headline: string }).headline);
    const summary = cleanText((item as { summary?: string }).summary);
    let body = cleanText((item as { body?: string }).body);
    // If body degrades to something shorter/identical to summary, prefer summary only.
    if (body && summary && (body === summary || body.length < 40)) body = "";
    const link = (item as { link?: string }).link;
    return { headline, summary, body, link, host: safeHostname(link) };
  }, [item]);

  useEffect(() => () => handleRef.current?.stop(), []);

  if (!item || !clean) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Article not found</h1>
        <button onClick={() => navigate({ to: "/world" })} className="mt-3 text-sm text-primary">Back to feed</button>
      </div>
    );
  }

  function togglePlay() {
    if (!item || !clean) return;
    if (playing) {
      handleRef.current?.stop();
      handleRef.current = null;
      setPlaying(false);
    } else {
      const narration = [clean.summary, clean.body].filter(Boolean).join(" ");
      handleRef.current = speak(narration || clean.headline, {
        voice: user.voiceId,
        speed: user.voiceRate,
        onEnd: () => setPlaying(false),
        onError: () => setPlaying(false),
      });
      setPlaying(true);
    }
  }

  const bookmarked = user.bookmarks.includes(item.id);

  async function share() {
    if (!item || !clean) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: clean.headline, text: clean.summary, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {/* user dismissed */}
  }

  return (
    <div className="mx-auto min-h-screen max-w-md pb-32">
      <div className="sticky top-0 z-10 glass flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={() => navigate({ to: ".." as any })} className="h-9 w-9 grid place-items-center rounded-full bg-surface border border-border">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-2">
          <button onClick={() => actions.toggleBookmark(item.id)} className="h-9 w-9 grid place-items-center rounded-full bg-surface border border-border">
            <Bookmark className={`h-5 w-5 ${bookmarked ? "fill-primary text-primary" : ""}`} />
          </button>
          <button onClick={share} className="h-9 w-9 grid place-items-center rounded-full bg-surface border border-border">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        <StoryArt hue={item.imageHue} size="lg" />

        <div className="mt-4 text-[11px] uppercase tracking-wider text-primary">{item.category}</div>
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-balance">{clean.headline}</h1>
        <div className="mt-2 text-sm text-muted-foreground">{item.source} · {item.publishedAt}</div>

        {clean.summary ? (
          <p className="mt-5 text-lg leading-relaxed text-balance">{clean.summary}</p>
        ) : null}
        {clean.body ? (
          <p className="mt-4 text-base leading-relaxed">{clean.body}</p>
        ) : null}

        <div className="mt-6">
          {clean.link ? (
            <a
              href={clean.link}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate max-w-[16rem]">
                {clean.host ? `Read on ${clean.host}` : "Read original source"}
              </span>
            </a>
          ) : (
            <span
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-muted-foreground opacity-70"
              title="No external source link available for this summary"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Source link unavailable
            </span>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          This is an AI-generated summary compiled from multiple sources.{clean.link ? " Tap the source link above to read the original reporting." : ""}
        </div>
      </div>

      {isSpeechSupported() ? (
        <div className="fixed bottom-0 left-0 right-0 z-20 safe-bottom">
          <div className="mx-auto max-w-md px-4">
            <button
              onClick={togglePlay}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-medium text-primary-foreground shadow-lg"
            >
              {playing ? <><Pause className="h-5 w-5 fill-current" /> Pause audio summary</> : <><Play className="h-5 w-5 fill-current" /> Play audio summary</>}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
