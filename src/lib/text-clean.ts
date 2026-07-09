// Client-side text sanitization for RSS-sourced headlines, summaries, and bodies.
// Strips HTML, decodes entities, and removes common RSS artifacts before we
// display or narrate them.

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "\u2019",
  "&lsquo;": "\u2018",
  "&rdquo;": "\u201d",
  "&ldquo;": "\u201c",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos|nbsp|hellip|mdash|ndash|rsquo|lsquo|rdquo|ldquo|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCharCode(parseInt(n, 10));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      try {
        return String.fromCharCode(parseInt(n, 16));
      } catch {
        return "";
      }
    });
}

/**
 * Clean an RSS-derived string:
 *  - strip HTML tags and CDATA wrappers
 *  - decode HTML entities
 *  - remove Google News "View Full Coverage" / "Continue reading" tails
 *  - collapse whitespace and dedupe ellipses
 *  - drop trailing " - Publisher Name" fragments and "[+123 chars]" markers
 */
export function cleanText(input: string | undefined | null): string {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/<!\[CDATA\[|\]\]>/g, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  // Common RSS/aggregator artifacts
  s = s.replace(/\[\+\d+\s*chars?\]/gi, "");
  s = s.replace(/\bView Full Coverage on Google News\b/gi, "");
  s = s.replace(/\bContinue reading\.?\.?\.?/gi, "");
  s = s.replace(/\bRead (the )?(full |more|original )?(story|article)( here)?\.?/gi, "");
  s = s.replace(/https?:\/\/\S+/g, ""); // stray URLs in the body
  s = s.replace(/&#?\w+;?/g, " "); // any leftover entity-looking sequences
  // Collapse ellipses / whitespace
  s = s.replace(/\.{3,}/g, "…");
  s = s.replace(/\s+/g, " ").trim();
  // Trim trailing " - Source" fragments introduced by Google News
  s = s.replace(/\s+[-–—]\s+[^-\n]{2,60}$/g, "");
  return s;
}

export function cleanHeadline(input: string | undefined | null): string {
  const s = cleanText(input);
  // Some feeds prefix "BREAKING:" or category tags in ALL CAPS — keep them,
  // just make sure they aren't duplicated.
  return s.replace(/^(BREAKING|UPDATE|EXCLUSIVE):\s*(BREAKING|UPDATE|EXCLUSIVE):\s*/i, "$1: ");
}

export function safeHostname(link: string | undefined): string {
  if (!link) return "";
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
