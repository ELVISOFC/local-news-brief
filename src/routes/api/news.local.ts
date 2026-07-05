import { createFileRoute } from "@tanstack/react-router";
import { fetchGoogleNewsRss, hueFromString } from "@/lib/news.server";

// GET /api/news/local?city=Austin&state=TX
// Returns an array of raw local stories from Google News RSS.
export const Route = createFileRoute("/api/news/local")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const city = (url.searchParams.get("city") || "").trim();
        const state = (url.searchParams.get("state") || "").trim();
        if (!city) return new Response("Missing city", { status: 400 });

        const q = state ? `"${city}" "${state}"` : `"${city}"`;
        const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

        try {
          const items = await fetchGoogleNewsRss(rss, request.signal);
          const stories = items.slice(0, 8).map((it, i) => {
            const id = `loc-${Buffer.from(it.link).toString("base64").slice(0, 12)}-${i}`;
            return {
              id,
              headline: it.title,
              summary: it.description || it.title,
              // body is the same as the description until the summarizer replaces it.
              body: it.description || it.title,
              source: it.source,
              category: "Local",
              publishedAt: it.pubDate,
              imageHue: hueFromString(it.source + it.title),
              link: it.link,
            };
          });
          return Response.json({ stories });
        } catch (err) {
          return Response.json(
            { stories: [], error: err instanceof Error ? err.message : "fetch failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
