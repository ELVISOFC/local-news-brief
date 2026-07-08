import { createFileRoute } from "@tanstack/react-router";
import { fetchMunicipalStories, feedsFor, type MunicipalFeed } from "@/lib/municipal.server";

// GET  /api/news/municipal?city=&state=&county=[&refresh=1]
// POST /api/news/municipal  { city, state, county?, custom?: MunicipalFeed[], refresh?: boolean }
//
// The GET variant covers curated registry feeds; POST is used when the
// client wants to include user-defined custom RSS URLs.
//
// Responses set `Cache-Control: s-maxage=600, stale-while-revalidate=1800`
// so any upstream edge cache serves the same payload for ~10 min and can
// keep serving it for up to 30 min while a background refresh runs.
export const Route = createFileRoute("/api/news/municipal")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const city = (url.searchParams.get("city") || "").trim();
        const state = (url.searchParams.get("state") || "").trim();
        const county = (url.searchParams.get("county") || "").trim() || undefined;
        const refresh = url.searchParams.get("refresh") === "1";
        if (!city || !state) return new Response("Missing city/state", { status: 400 });
        return handle(city, state, county, [], refresh, request.signal);
      },
      POST: async ({ request }) => {
        type Body = {
          city?: string;
          state?: string;
          county?: string;
          custom?: MunicipalFeed[];
          refresh?: boolean;
        };
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const city = (body.city || "").trim();
        const state = (body.state || "").trim();
        if (!city || !state) return new Response("Missing city/state", { status: 400 });
        const custom = Array.isArray(body.custom)
          ? body.custom
              .filter((f) => f && typeof f.url === "string" && /^https?:\/\//i.test(f.url))
              .slice(0, 12)
              .map((f) => ({
                source: String(f.source || "Custom feed").slice(0, 80),
                kind: String(f.kind || "Other").slice(0, 32),
                url: f.url,
              }))
          : [];
        return handle(city, state, body.county?.trim() || undefined, custom, !!body.refresh, request.signal);
      },
    },
  },
});

async function handle(
  city: string,
  state: string,
  county: string | undefined,
  custom: MunicipalFeed[],
  refresh: boolean,
  signal: AbortSignal,
) {
  try {
    const stories = await fetchMunicipalStories(city, state, county, signal, { custom, refresh });
    const feeds = [
      ...feedsFor(city, state, county).map((f) => ({ source: f.source, kind: f.kind })),
      ...custom.map((f) => ({ source: f.source, kind: f.kind })),
    ];
    return new Response(JSON.stringify({ stories, feeds, fallback: feeds.length === 0 }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        stories: [],
        feeds: [],
        fallback: true,
        error: err instanceof Error ? err.message : "fetch failed",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
