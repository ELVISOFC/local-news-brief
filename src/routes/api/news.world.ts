import { createFileRoute } from "@tanstack/react-router";
import { fetchGoogleNewsRss, hueFromString, inferRegion, TOPIC_SECTION } from "@/lib/news.server";

// GET /api/news/world?topics=Politics,Business,Tech
// Returns WorldArticle-shaped items pulled from Google News section feeds.
export const Route = createFileRoute("/api/news/world")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const topicsParam = (url.searchParams.get("topics") || "").trim();
        const topics = topicsParam
          ? topicsParam.split(",").map((s) => s.trim()).filter((t) => TOPIC_SECTION[t])
          : Object.keys(TOPIC_SECTION);

        const results = await Promise.allSettled(
          topics.map(async (topic) => {
            const section = TOPIC_SECTION[topic];
            const rss = `https://news.google.com/rss/headlines/section/topic/${section}?hl=en-US&gl=US&ceid=US:en`;
            const items = await fetchGoogleNewsRss(rss, request.signal);
            return items.slice(0, 6).map((it, i) => ({
              id: `w-${section.toLowerCase()}-${i}-${Buffer.from(it.link).toString("base64").slice(0, 8)}`,
              headline: it.title,
              summary: it.description || it.title,
              body: it.description || it.title,
              source: it.source,
              topic,
              region: inferRegion(it.source),
              publishedAt: new Date(it.pubDate || Date.now()).toISOString(),
              imageHue: hueFromString(it.source + it.title),
              link: it.link,
            }));
          }),
        );

        const articles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
        // Dedupe by headline
        const seen = new Set<string>();
        const unique = articles.filter((a) => {
          const k = a.headline.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return Response.json({ articles: unique });
      },
    },
  },
});
