// Server-only helpers for fetching live news via Google News RSS.
// Runs in the Cloudflare Worker SSR runtime — no DOMParser, so we parse with regex.

export type RawItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
};

function pick(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = block.match(re);
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function parseRss(xml: string): RawItem[] {
  const out: RawItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const rawTitle = decodeEntities(pick(block, "title"));
    const description = stripTags(pick(block, "description"));
    // Source appears in <source url="...">Name</source>
    let source = "";
    const srcMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    if (srcMatch) source = decodeEntities(srcMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim());
    // Google News titles are "Headline - Source"
    let title = rawTitle;
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(` - ${source}`).length);
    } else {
      const dashIdx = title.lastIndexOf(" - ");
      if (dashIdx > 20 && !source) {
        source = title.slice(dashIdx + 3).trim();
        title = title.slice(0, dashIdx).trim();
      }
    }
    out.push({
      title,
      link: pick(block, "link"),
      pubDate: pick(block, "pubDate"),
      description,
      source: source || "Google News",
    });
  }
  return out;
}

export async function fetchGoogleNewsRss(url: string, signal?: AbortSignal): Promise<RawItem[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 AreaNews/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
    signal,
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();
  return parseRss(xml);
}

export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h % 360;
}

// Google News section for topic pages
export const TOPIC_SECTION: Record<string, string> = {
  Politics: "WORLD",
  Business: "BUSINESS",
  Tech: "TECHNOLOGY",
  Science: "SCIENCE",
  Health: "HEALTH",
  Entertainment: "ENTERTAINMENT",
  Sports: "SPORTS",
};

// Very rough source→region hint. Falls back to "North America".
const REGION_HINTS: { pattern: RegExp; region: string }[] = [
  { pattern: /BBC|Guardian|Reuters UK|FT\b|Sky News|Deutsche Welle|Le Monde|El Pa[ií]s|Euronews/i, region: "Europe" },
  { pattern: /Nikkei|South China|Xinhua|Times of India|The Hindu|Kyodo|Japan Times|Straits Times/i, region: "Asia" },
  { pattern: /Al Jazeera|Arab News|Haaretz|Times of Israel|Jerusalem Post|Gulf News/i, region: "Middle East" },
  { pattern: /Sydney Morning|The Age|ABC News \(Aus\)|Stuff|NZ Herald/i, region: "Oceania" },
  { pattern: /All ?Africa|Punch|Mail ?& ?Guardian|Daily Nation|News24/i, region: "Africa" },
  { pattern: /Folha|Globo|Clar[ií]n|Buenos Aires|El Comercio/i, region: "South America" },
];

export function inferRegion(source: string): string {
  for (const h of REGION_HINTS) if (h.pattern.test(source)) return h.region;
  return "North America";
}
