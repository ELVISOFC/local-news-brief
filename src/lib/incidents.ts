// Synthetic hyper-local incident & story pin generator. Swap with a real feed
// (police blotter / 311 / local newsroom geocoded stories) later.

export type IncidentKind =
  | "theft"
  | "suspicious"
  | "traffic"
  | "fire"
  | "noise"
  | "assault"
  | "vandalism"
  | "lost-pet";

export type Pin = {
  id: string;
  kind: "story" | IncidentKind;
  title: string;
  detail: string;
  lat: number;
  lng: number;
  // minutes ago
  minutesAgo: number;
  source: string;
  storyId?: string;
};

const INCIDENT_TEMPLATES: { kind: IncidentKind; title: string; detail: string }[] = [
  { kind: "theft", title: "Package theft reported", detail: "Porch pirate caught on doorbell cam around 2pm." },
  { kind: "theft", title: "Bicycle stolen from rack", detail: "Black mountain bike taken outside coffee shop." },
  { kind: "suspicious", title: "Suspicious person", detail: "Resident reported someone checking car door handles overnight." },
  { kind: "traffic", title: "Multi-car fender bender", detail: "Two-lane closure, expect delays of 10-15 min." },
  { kind: "traffic", title: "Road closed for utility work", detail: "Crews working on water main, reopens by 6pm." },
  { kind: "fire", title: "Small kitchen fire", detail: "Fire dept responded, no injuries reported." },
  { kind: "noise", title: "Loud party complaint", detail: "Neighbors filed multiple noise reports after midnight." },
  { kind: "assault", title: "Altercation outside bar", detail: "Two individuals detained, no weapons involved." },
  { kind: "vandalism", title: "Graffiti on storefront", detail: "Business owner asking neighbors to watch for repeat activity." },
  { kind: "lost-pet", title: "Lost dog - golden retriever", detail: "Friendly, no collar. Last seen near the park." },
];

const SOURCES = ["Neighbor", "PD Blotter", "311", "Citizen Tip", "Local News"];

// Seeded random so pins are stable per (lat, lng) center.
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateIncidents(center: { lat: number; lng: number }, count = 14): Pin[] {
  const seed = Math.floor((center.lat + 90) * 1000) ^ Math.floor((center.lng + 180) * 1000);
  const rand = mulberry32(seed);
  const out: Pin[] = [];
  for (let i = 0; i < count; i++) {
    const t = INCIDENT_TEMPLATES[Math.floor(rand() * INCIDENT_TEMPLATES.length)];
    // ~0.5 - 4 km offset
    const r = 0.005 + rand() * 0.035;
    const theta = rand() * Math.PI * 2;
    out.push({
      id: `inc-${i}`,
      kind: t.kind,
      title: t.title,
      detail: t.detail,
      lat: center.lat + Math.sin(theta) * r,
      lng: center.lng + Math.cos(theta) * r * 1.25,
      minutesAgo: Math.floor(rand() * 600),
      source: SOURCES[Math.floor(rand() * SOURCES.length)],
    });
  }
  return out;
}

export const INCIDENT_META: Record<IncidentKind, { label: string; color: string; emoji: string }> = {
  theft: { label: "Theft", color: "#dc2626", emoji: "💰" },
  suspicious: { label: "Suspicious", color: "#d97706", emoji: "👁" },
  traffic: { label: "Traffic", color: "#2563eb", emoji: "🚗" },
  fire: { label: "Fire", color: "#ea580c", emoji: "🔥" },
  noise: { label: "Noise", color: "#7c3aed", emoji: "🔊" },
  assault: { label: "Assault", color: "#b91c1c", emoji: "⚠️" },
  vandalism: { label: "Vandalism", color: "#be185d", emoji: "🎨" },
  "lost-pet": { label: "Lost pet", color: "#0d9488", emoji: "🐾" },
};

// Haversine distance in kilometers.
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}


// Free OpenStreetMap geocoder. No key required, rate-limited to ~1 req/s.
export async function geocode(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const q = query.trim();
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data: { lat: string; lon: string; display_name: string }[] = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}
