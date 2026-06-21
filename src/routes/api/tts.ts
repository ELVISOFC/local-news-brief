import { createFileRoute } from "@tanstack/react-router";

// Streams text-to-speech from Lovable AI Gateway as SSE PCM chunks.
// The client decodes deltas chunk-by-chunk and plays via Web Audio.
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("LOVABLE_API_KEY is not configured", { status: 500 });
        }

        let body: { text?: string; voice?: string; instructions?: string; speed?: number };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        const text = (body.text ?? "").trim();
        if (!text) return new Response("Missing 'text'", { status: 400 });

        const voice = body.voice || "alloy";
        const speed = typeof body.speed === "number" ? body.speed : 1;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice,
            instructions: body.instructions,
            speed,
            stream_format: "sse",
            response_format: "pcm",
          }),
          signal: request.signal,
        }).catch((err) => {
          if (request.signal.aborted) return null;
          throw err;
        });

        if (!upstream) return new Response(null, { status: 499 });
        if (!upstream.ok) {
          const msg = await upstream.text().catch(() => "");
          return new Response(msg || `TTS upstream failed: ${upstream.status}`, {
            status: upstream.status,
          });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
