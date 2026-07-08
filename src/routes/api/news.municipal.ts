import { createFileRoute } from "@tanstack/react-router";
import { fetchMunicipalStories, feedsFor } from "@/lib/municipal.server";

// GET /api/news/municipal?city=Austin&state=TX&county=Travis+County
// Returns official municipal / press-release stories for the given area.
export const Route = createFileRoute("/api/news/municipal")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const city = (url.searchParams.get("city") || "").trim();
        const state = (url.searchParams.get("state") || "").trim();
        const county = (url.searchParams.get("county") || "").trim() || undefined;
        if (!city || !state) return new Response("Missing city/state", { status: 400 });

        try {
          const stories = await fetchMunicipalStories(city, state, county, request.signal);
          const feeds = feedsFor(city, state, county).map((f) => ({ source: f.source, kind: f.kind }));
          return Response.json({ stories, feeds, fallback: feeds.length === 0 });
        } catch (err) {
          return Response.json(
            { stories: [], feeds: [], fallback: true, error: err instanceof Error ? err.message : "fetch failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
