// Municipal & press-release RSS registry + fetcher.
// Runs server-side only (Cloudflare Worker). Uses the same regex RSS parser
// as news.server.ts so we don't need DOMParser.

import { fetchGoogleNewsRss, hueFromString, type RawItem } from "./news.server";

export type MunicipalFeed = {
  // Human-facing publisher label ("City of Austin", "Travis County", …)
  source: string;
  // "City" | "County" | "Police" | "Transit" | "Schools" | "Emergency"
  kind: string;
  url: string;
};

// Curated registry keyed by lowercase "city|state" and "county|state".
// Only entries we've verified expose a public RSS/Atom feed.
const CITY_FEEDS: Record<string, MunicipalFeed[]> = {
  "austin|tx": [
    { source: "City of Austin", kind: "City", url: "https://www.austintexas.gov/rss.xml" },
    { source: "Austin Police Department", kind: "Police", url: "https://www.austintexas.gov/police/rss.xml" },
    { source: "CapMetro", kind: "Transit", url: "https://www.capmetro.org/rss/news" },
  ],
  "miami|fl": [
    { source: "City of Miami", kind: "City", url: "https://www.miamigov.com/Home/Components/News/RSSFeed/12/16" },
  ],
  "san francisco|ca": [
    { source: "SF.gov", kind: "City", url: "https://www.sf.gov/news/rss.xml" },
    { source: "SFMTA", kind: "Transit", url: "https://www.sfmta.com/rss.xml" },
  ],
  "new york|ny": [
    { source: "NYC.gov", kind: "City", url: "https://www.nyc.gov/assets/home/rss/press-releases.xml" },
    { source: "MTA", kind: "Transit", url: "https://new.mta.info/rss.xml" },
  ],
  "chicago|il": [
    { source: "City of Chicago", kind: "City", url: "https://www.chicago.gov/city/en/rss.html" },
  ],
  "seattle|wa": [
    { source: "City of Seattle", kind: "City", url: "https://news.seattle.gov/feed/" },
  ],
  "los angeles|ca": [
    { source: "Mayor of Los Angeles", kind: "City", url: "https://mayor.lacity.gov/news/press-releases/feed" },
  ],
  "boston|ma": [
    { source: "City of Boston", kind: "City", url: "https://www.boston.gov/departments/mayors-office/news.xml" },
  ],
};

const COUNTY_FEEDS: Record<string, MunicipalFeed[]> = {
  "travis county|tx": [
    { source: "Travis County", kind: "County", url: "https://www.traviscountytx.gov/news/rss" },
  ],
  "miami-dade county|fl": [
    { source: "Miami-Dade County", kind: "County", url: "https://www.miamidade.gov/rss/news.xml" },
  ],
  "san francisco county|ca": [
    { source: "SF.gov", kind: "County", url: "https://www.sf.gov/news/rss.xml" },
  ],
};

export function feedsFor(city: string, state: string, county?: string): MunicipalFeed[] {
  const out: MunicipalFeed[] = [];
  const cKey = `${city.toLowerCase()}|${state.toLowerCase()}`;
  if (CITY_FEEDS[cKey]) out.push(...CITY_FEEDS[cKey]);
  if (county) {
    const coKey = `${county.toLowerCase()}|${state.toLowerCase()}`;
    if (COUNTY_FEEDS[coKey]) out.push(...COUNTY_FEEDS[coKey]);
  }
  return out;
}

// Google News scoped to the municipal domain(s) — a resilient fallback for
// cities where we don't have a direct RSS URL. Example query:
//   site:austintexas.gov OR site:traviscountytx.gov
export function officialFallbackRss(city: string, state: string, county?: string): string {
  const parts = [`"${city}"`, `"${state}"`, "(press release OR announcement OR statement)"];
  if (county) parts.push(`"${county}"`);
  const q = parts.join(" ");
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q + " site:.gov")}&hl=en-US&gl=US&ceid=US:en`;
}

async function fetchRssRaw(url: string, signal?: AbortSignal): Promise<RawItem[]> {
  // Reuse the regex parser from news.server via fetchGoogleNewsRss (works for
  // any RSS 2.0 / Atom feed, not just Google News).
  return fetchGoogleNewsRss(url, signal);
}

export type MunicipalStory = {
  id: string;
  headline: string;
  summary: string;
  body: string;
  source: string;
  category: string;
  publishedAt: string;
  imageHue: number;
  link: string;
  official: true;
};

export async function fetchMunicipalStories(
  city: string,
  state: string,
  county: string | undefined,
  signal?: AbortSignal,
): Promise<MunicipalStory[]> {
  const feeds = feedsFor(city, state, county);
  const useFallback = feeds.length === 0;
  const targets: MunicipalFeed[] = useFallback
    ? [{ source: `${city} Official`, kind: "City", url: officialFallbackRss(city, state, county) }]
    : feeds;

  const results = await Promise.allSettled(
    targets.map(async (f) => {
      const items = await fetchRssRaw(f.url, signal);
      return items.slice(0, 4).map<MunicipalStory>((it, i) => {
        const idSeed = Buffer.from(it.link || (f.url + i)).toString("base64").slice(0, 12);
        return {
          id: `muni-${idSeed}-${i}`,
          headline: it.title,
          summary: it.description || it.title,
          body: it.description || it.title,
          source: it.source && it.source !== "Google News" ? it.source : f.source,
          category: f.kind,
          publishedAt: it.pubDate,
          imageHue: hueFromString(f.source + it.title),
          link: it.link,
          official: true,
        };
      });
    }),
  );

  const stories = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  // Dedupe by headline
  const seen = new Set<string>();
  return stories.filter((s) => {
    const k = s.headline.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
