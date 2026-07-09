import { createFileRoute } from "@tanstack/react-router";
import { parseRss } from "@/lib/news.server";
import { feedsFor } from "@/lib/municipal.server";

// POST /api/news/validate-feed
// { url, city?, state?, county?, existing?: string[] }
// -> { ok, canonicalUrl, title?, itemCount?, duplicate?: "curated" | "custom", error? }
//
// Fetches the URL, verifies it parses as RSS/Atom with at least one item, and
// reports whether the (canonicalized) URL is already covered by our curated
// registry or the caller's existing custom feeds.
export const Route = createFileRoute("/api/news/validate-feed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        type Body = {
          url?: string;
          city?: string;
          state?: string;
          county?: string;
          existing?: string[];
        };
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
        }
        const raw = (body.url || "").trim();
        if (!/^https?:\/\/\S+$/i.test(raw)) {
          return Response.json({ ok: false, error: "Enter a valid http(s) URL." }, { status: 200 });
        }
        const canonicalUrl = canonicalize(raw);
        if (!canonicalUrl) {
          return Response.json({ ok: false, error: "That URL doesn't look valid." }, { status: 200 });
        }

        // Dedupe against caller's existing feeds
        const existing = Array.isArray(body.existing) ? body.existing.map(canonicalize).filter(Boolean) : [];
        if (existing.includes(canonicalUrl)) {
          return Response.json({ ok: false, duplicate: "custom", canonicalUrl, error: "You've already added this feed." });
        }

        // Dedupe against curated registry when we know the location
        if (body.city && body.state) {
          const curated = feedsFor(body.city.trim(), body.state.trim(), body.county?.trim() || undefined);
          if (curated.some((f) => canonicalize(f.url) === canonicalUrl)) {
            return Response.json({
              ok: false,
              duplicate: "curated",
              canonicalUrl,
              error: "This feed is already included automatically for your location.",
            });
          }
        }

        // Actually fetch it
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(canonicalUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 AreaNews/1.0",
              Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            },
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!res.ok) {
            return Response.json({ ok: false, canonicalUrl, error: `Feed returned HTTP ${res.status}.` });
          }
          const ct = res.headers.get("content-type") || "";
          const xml = await res.text();
          if (!/<rss|<feed|<channel/i.test(xml)) {
            return Response.json({
              ok: false,
              canonicalUrl,
              error: `That URL isn't an RSS or Atom feed (${ct || "unknown content type"}).`,
            });
          }
          const items = parseRss(xml);
          const feedTitle = pickTag(xml, "title") || undefined;
          if (items.length === 0 && !/<entry/i.test(xml)) {
            return Response.json({ ok: false, canonicalUrl, error: "Feed parsed but contains no items." });
          }
          return Response.json({
            ok: true,
            canonicalUrl,
            title: feedTitle,
            itemCount: items.length || undefined,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "fetch failed";
          return Response.json({ ok: false, canonicalUrl, error: `Couldn't reach that URL: ${msg}` });
        }
      },
    },
  },
});

function canonicalize(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hostname = u.hostname.toLowerCase();
    if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) u.port = "";
    // strip trailing slash except when path is root
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
    u.hash = "";
    // drop tracking params
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    for (const p of drop) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return "";
  }
}

function pickTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
