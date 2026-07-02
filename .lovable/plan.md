# AreaNews — Technical Spec Sheet (DOCX)

Generate a downloadable `.docx` at `/mnt/documents/AreaNews-Technical-Spec.docx` covering what's built so far, at a feature-by-feature depth (between exec summary and exhaustive).

## Contents

1. **Overview** — product concept (hyper-local 5-min AI audio briefing + Citizen/Nextdoor-style map), target user, current status (prototype, local-only state).
2. **Tech Stack** — TanStack Start v1 + React 19, Vite 7, Tailwind v4, TanStack Router/Query, shadcn/ui, Leaflet + OpenStreetMap, Lovable AI Gateway (`gpt-4o-mini-tts`), Nominatim geocoder, Cloudflare Workers runtime target.
3. **Architecture** — file-based routing tree, `__root.tsx` shell, client-side store (localStorage via `useSyncExternalStore`), server route `api/tts` proxy, no backend/auth yet.
4. **Features (feature-by-feature, with key files)**
   - Onboarding + locations (`welcome.tsx`, `store.ts`)
   - Area briefing — top stories, filters by outlet, cached generation (`area.tsx`)
   - 5-min audio player — streaming TTS, Web Audio scheduling, autoplay-safe context, error/loop guard (`player.tsx`, `speech.ts`, `api/tts.ts`)
   - Voice selection + preview with memory + IndexedDB cache (`settings.tsx`, `preview-cache.ts`)
   - Article view with TTS (`article.$id.tsx`)
   - World tab — filters, breaking last-2-hours carousel, outlet picker (`world.tsx`)
   - Nearby tab — Leaflet map, geolocation + zip/city geocode, seeded incident pins, filter chips, radius ring (`nearby.tsx`, `incidents.ts`)
   - Neighborhood alerts — radius, category toggles, story toggle, sonner toasts, bell drawer, dedupe (`Alerts.tsx`, `notifications.ts`)
   - Debug timeline — TTS lifecycle log, JSON export (`DebugTimeline.tsx`, `debug-log.ts`)
5. **Data Models** — `UserState`, `AlertSettings`, `Filters`, `Pin`, `Notification`, `WorldArticle`, `Location` (fields + storage key summary).
6. **Persistence** — localStorage keys (`areanews_state_v1`, `areanews_notifications_v1`, `areanews_notif_seen_v1`, `tts-debug`) and IndexedDB (voice preview PCM).
7. **External Services** — Lovable AI Gateway (TTS SSE PCM), Nominatim (geocoding), OpenStreetMap tiles.
8. **Build & Tooling** — `bun`, `bun run build:dev`, `preflight` TanStack version check script.
9. **Known Limits / Not Built** — no auth, no real incident feed (synthetic seeded), no cross-device sync, no push notifications, no Cloud/DB.
10. **Suggested Next Steps** — Cloud + auth for cross-device sync, real incident feed integration, push, sharing.

## Technical details

- Use bundled `docx-js` skill workflow: US Letter, Arial default, semantic Heading1/Heading2, `LevelFormat.BULLET`, DXA tables with `columnWidths` + cell widths where used for the data-model summary.
- Validate DOCX with the skill's `validate_document.py`, then render to PDF/JPEG for visual QA of each page, fix any overflow, and only then present the artifact.
- Deliver via `<presentation-artifact path="AreaNews-Technical-Spec.docx" mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"></presentation-artifact>`.
- No code changes to the app itself.
