import { createFileRoute } from "@tanstack/react-router";

// POST /api/news/summarize
// Body: { stories: [{ id, headline, source, snippet }], city?, state? }
// Returns: { stories: [{ id, summary, body, category }] }
// Uses Lovable AI Gateway to produce TTS-ready summaries.
export const Route = createFileRoute("/api/news/summarize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY is not configured", { status: 500 });

        type InStory = { id: string; headline: string; source?: string; snippet?: string };
        let body: { stories?: InStory[]; city?: string; state?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const stories = Array.isArray(body.stories) ? body.stories.slice(0, 8) : [];
        if (!stories.length) return Response.json({ stories: [] });

        const list = stories
          .map(
            (s, i) =>
              `${i + 1}. HEADLINE: ${s.headline}\n   SOURCE: ${s.source || "unknown"}\n   SNIPPET: ${s.snippet || ""}`,
          )
          .join("\n\n");

        const loc = body.city ? ` for ${body.city}${body.state ? ", " + body.state : ""}` : "";
        const system =
          "You are a local news radio editor. For each headline you receive, write two things: " +
          "(1) a 1-sentence teaser (<=22 words, plain neutral tone), and " +
          "(2) a 2-3 sentence audio-ready summary (<=55 words) that a text-to-speech voice will read aloud. " +
          "Write numbers as words for TTS (e.g. 'one hundred and eighty million dollars'). No emojis, no markdown, no source links. " +
          "Pick a short category label from: Politics, Development, Housing, Transit, Schools, Public Safety, Weather, Business, Culture, Sports, Health, Environment. " +
          "Return strict JSON matching the schema.";

        const schema = {
          type: "object",
          properties: {
            stories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  summary: { type: "string" },
                  body: { type: "string" },
                  category: { type: "string" },
                },
                required: ["id", "summary", "body", "category"],
                additionalProperties: false,
              },
            },
          },
          required: ["stories"],
          additionalProperties: false,
        };

        const user = `Location context${loc}. Rewrite each of these ${stories.length} items:\n\n${list}\n\nReturn one object per item, keyed by the id I gave you: ${stories.map((s) => s.id).join(", ")}.`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            response_format: {
              type: "json_schema",
              json_schema: { name: "briefing", strict: true, schema },
            },
          }),
          signal: request.signal,
        });

        if (!upstream.ok) {
          const t = await upstream.text().catch(() => "");
          return new Response(t || `Summarize failed: ${upstream.status}`, { status: upstream.status });
        }
        const data = await upstream.json();
        const raw = data?.choices?.[0]?.message?.content ?? "{}";
        let parsed: { stories?: { id: string; summary: string; body: string; category: string }[] } = {};
        try {
          parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
          parsed = {};
        }
        return Response.json({ stories: parsed.stories || [] });
      },
    },
  },
});
