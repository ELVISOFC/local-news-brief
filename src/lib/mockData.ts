// Mock data for AreaNews MVP. Swap with real APIs (NewsAPI, GNews, OpenAI, ElevenLabs)
// at the marked integration points.

export type Location = {
  id: string;
  label: string; // "Home", "Work"
  city: string;
  county?: string;
  state: string;
  zip?: string;
};

export type Story = {
  id: string;
  headline: string;
  summary: string; // 1-2 sentence preview
  body: string; // full summarized text — fed to TTS
  source: string;
  category: string; // e.g. "Local Politics", "Schools"
  publishedAt: string;
  imageHue: number; // 0-360 for a gradient placeholder
};

export type Briefing = {
  locationId: string;
  date: string; // YYYY-MM-DD
  intro: string;
  stories: Story[];
};

export const SAMPLE_LOCATIONS: Location[] = [
  { id: "austin", label: "Home", city: "Austin", county: "Travis County", state: "TX", zip: "78704" },
  { id: "miami", label: "Work", city: "Miami", county: "Miami-Dade County", state: "FL", zip: "33130" },
  { id: "sf", label: "Weekend", city: "San Francisco", county: "San Francisco County", state: "CA", zip: "94110" },
];

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const today = new Date().toISOString().slice(0, 10);

const briefingTemplates: Record<string, Omit<Briefing, "locationId" | "date">> = {
  austin: {
    intro: "Good morning. It's a warm 74 degrees in Austin. Here are the seven stories shaping your day around Travis County.",
    stories: [
      {
        id: "atx-1",
        headline: "City Council approves $180M South Congress redevelopment",
        summary: "The mixed-use project will add 1,400 housing units and a new transit hub by 2027.",
        body: "Austin City Council voted 8 to 3 last night to approve a 180 million dollar redevelopment along South Congress Avenue. The mixed-use project from local developer Endeavor will deliver 1,400 housing units, 15% designated affordable, alongside ground-floor retail and a new CapMetro transit hub. Construction begins this fall with completion targeted for 2027.",
        source: "Austin American-Statesman",
        category: "Development",
        publishedAt: "6:12 AM",
        imageHue: 210,
      },
      {
        id: "atx-2",
        headline: "Travis County rolls out new property tax relief for seniors",
        summary: "Homeowners over 65 can apply for an additional $25,000 homestead exemption starting Monday.",
        body: "Travis County commissioners approved a new property tax relief measure that adds a 25 thousand dollar exemption for homeowners over 65. Applications open Monday at the county assessor's office and online. County officials estimate roughly 38,000 households qualify.",
        source: "KUT News",
        category: "County Government",
        publishedAt: "5:45 AM",
        imageHue: 160,
      },
      {
        id: "atx-3",
        headline: "AISD names finalists in superintendent search",
        summary: "Three candidates will hold public forums next week before the board votes on June 28.",
        body: "Austin Independent School District has narrowed its superintendent search to three finalists, all current superintendents from districts in Texas, Colorado, and North Carolina. Public forums begin Tuesday at LBJ High School. The board is scheduled to vote on June 28th.",
        source: "Austin Monitor",
        category: "Schools",
        publishedAt: "Yesterday",
        imageHue: 35,
      },
      {
        id: "atx-4",
        headline: "I-35 expansion project hits another six-month delay",
        summary: "TxDOT cites utility relocation issues; downtown lane closures extended through December.",
        body: "The Texas Department of Transportation announced another six-month delay on the central I-35 expansion. Crews ran into unexpected utility conflicts between Cesar Chavez and Martin Luther King. Downtown lane closures will continue through December.",
        source: "KXAN",
        category: "Transit",
        publishedAt: "Yesterday",
        imageHue: 20,
      },
      {
        id: "atx-5",
        headline: "ACL Festival single-day passes go on sale Friday",
        summary: "Headliners include Tyler, The Creator, Doja Cat, and Hozier across both weekends.",
        body: "Austin City Limits Festival single-day passes go on sale Friday at 10 AM. This year's lineup features Tyler The Creator, Doja Cat, and Hozier as headliners across both weekends at Zilker Park in October.",
        source: "Do512",
        category: "Culture",
        publishedAt: "Yesterday",
        imageHue: 305,
      },
      {
        id: "atx-6",
        headline: "Home prices in 78704 down 4% year over year",
        summary: "Median sale price now $695,000 as inventory climbs to a 4-month supply.",
        body: "The latest report from the Austin Board of Realtors shows median home prices in the 78704 zip code down 4 percent year over year, landing at 695 thousand dollars. Inventory has climbed to a four-month supply, the highest since 2019.",
        source: "Austin Board of Realtors",
        category: "Real Estate",
        publishedAt: "Yesterday",
        imageHue: 130,
      },
    ],
  },
  miami: {
    intro: "Good morning, Miami. 82 degrees with afternoon thunderstorms expected. Here's what's happening across Miami-Dade.",
    stories: [
      {
        id: "mia-1",
        headline: "Miami-Dade approves climate resilience bond worth $400M",
        summary: "Funds will go to sea wall upgrades, stormwater systems, and elevating critical infrastructure.",
        body: "Miami-Dade County commissioners approved a 400 million dollar climate resilience bond. The funds will pay for sea wall upgrades along Biscayne Bay, expanded stormwater pumps, and elevating critical roadways in low-lying neighborhoods.",
        source: "Miami Herald",
        category: "Climate",
        publishedAt: "6:20 AM",
        imageHue: 195,
      },
      {
        id: "mia-2",
        headline: "Brightline launches direct Miami to Tampa service in 2026",
        summary: "The 320-mile high-speed corridor received final federal approval this week.",
        body: "Brightline received final federal approval for its Miami to Tampa high-speed rail expansion. The 320-mile corridor will begin service in late 2026 with five daily round trips.",
        source: "South Florida Business Journal",
        category: "Transit",
        publishedAt: "Yesterday",
        imageHue: 215,
      },
      {
        id: "mia-3",
        headline: "Wynwood condo tower breaks ground after two-year delay",
        summary: "The 42-story project will bring 480 units and 30,000 square feet of retail.",
        body: "Developer Related Group broke ground on a 42 story condo tower in Wynwood after a two-year permitting delay. The project will add 480 units plus 30 thousand square feet of ground-floor retail.",
        source: "The Real Deal",
        category: "Real Estate",
        publishedAt: "Yesterday",
        imageHue: 280,
      },
      {
        id: "mia-4",
        headline: "Miami Beach votes to ban scooter rentals on Ocean Drive",
        summary: "The ban begins July 1 following a spike in pedestrian injuries.",
        body: "Miami Beach commissioners voted unanimously to ban electric scooter rentals along Ocean Drive starting July 1st. The decision follows a 60 percent increase in pedestrian injuries over the past year.",
        source: "WPLG Local 10",
        category: "City Government",
        publishedAt: "Yesterday",
        imageHue: 5,
      },
      {
        id: "mia-5",
        headline: "Hurricane season forecast: NOAA predicts above-normal activity",
        summary: "Up to 19 named storms expected; residents urged to finalize plans by July.",
        body: "NOAA's updated hurricane forecast predicts an above-normal Atlantic season with as many as 19 named storms. Emergency officials urge South Florida residents to finalize evacuation plans by early July.",
        source: "NWS Miami",
        category: "Weather",
        publishedAt: "Yesterday",
        imageHue: 245,
      },
      {
        id: "mia-6",
        headline: "Inter Miami sells out home opener at Chase Stadium",
        summary: "Messi's return draws record viewership across MLS Season Pass.",
        body: "Inter Miami sold out its home opener at Chase Stadium with Lionel Messi back in the starting eleven. The match drew record viewership numbers across MLS Season Pass.",
        source: "ESPN",
        category: "Sports",
        publishedAt: "Yesterday",
        imageHue: 320,
      },
    ],
  },
  sf: {
    intro: "Good morning, San Francisco. Foggy and 58 degrees in the Mission. Here's your Bay Area briefing.",
    stories: [
      {
        id: "sf-1",
        headline: "Mayor announces 1,200-unit affordable housing initiative for SoMa",
        summary: "The plan repurposes three city-owned parking lots for mixed-income development.",
        body: "San Francisco's mayor unveiled a 1,200 unit affordable housing initiative that repurposes three city-owned parking lots in SoMa. Construction is expected to begin in 2026 with the first units delivered by 2028.",
        source: "SF Chronicle",
        category: "Housing",
        publishedAt: "6:05 AM",
        imageHue: 215,
      },
      {
        id: "sf-2",
        headline: "BART board approves late-night weekend service expansion",
        summary: "Trains will now run until 2 AM Friday and Saturday starting in August.",
        body: "The BART board of directors approved expanded late-night weekend service. Trains will run until 2 AM on Fridays and Saturdays starting in August, the first overnight expansion since the pandemic.",
        source: "SFist",
        category: "Transit",
        publishedAt: "Yesterday",
        imageHue: 175,
      },
      {
        id: "sf-3",
        headline: "Mission District median rent drops to lowest level since 2019",
        summary: "One-bedroom apartments now average $3,100, down 9% year over year.",
        body: "Median rent in the Mission District has dropped to its lowest level since 2019. One-bedroom apartments now average 3,100 dollars per month, down 9 percent year over year, according to Zumper.",
        source: "Mission Local",
        category: "Real Estate",
        publishedAt: "Yesterday",
        imageHue: 35,
      },
      {
        id: "sf-4",
        headline: "SFUSD considers shifting school start times to 9 AM",
        summary: "A new proposal would push elementary start times later citing student health data.",
        body: "The San Francisco Unified School District is considering shifting elementary school start times to 9 AM beginning next fall. The proposal cites student sleep and health data and goes to public comment next week.",
        source: "KQED",
        category: "Schools",
        publishedAt: "Yesterday",
        imageHue: 90,
      },
      {
        id: "sf-5",
        headline: "Tech sector hiring picks up: 2,400 new openings in May",
        summary: "AI startups and infrastructure firms led the rebound after a flat first quarter.",
        body: "Bay Area tech hiring picked up in May with 2,400 new job openings posted. AI startups and infrastructure firms led the rebound after a notably flat first quarter, according to LinkedIn data.",
        source: "TechCrunch",
        category: "Business",
        publishedAt: "Yesterday",
        imageHue: 260,
      },
      {
        id: "sf-6",
        headline: "Golden Gate Park summer concert lineup released",
        summary: "Outside Lands returns August 8-10 with Sabrina Carpenter and Tame Impala headlining.",
        body: "The Outside Lands music festival returns to Golden Gate Park August 8th through 10th. Sabrina Carpenter and Tame Impala will headline alongside more than 90 other artists across six stages.",
        source: "SF Standard",
        category: "Culture",
        publishedAt: "Yesterday",
        imageHue: 310,
      },
    ],
  },
};

export function getBriefing(locationId: string): Briefing | null {
  const t = briefingTemplates[locationId];
  if (!t) return null;
  return { locationId, date: today, ...t };
}

// ---------- World news ----------

export type WorldArticle = {
  id: string;
  headline: string;
  summary: string;
  body: string;
  source: string;
  topic: "Politics" | "Business" | "Tech" | "Science" | "Health" | "Entertainment" | "Sports";
  region: "North America" | "Europe" | "Asia" | "Africa" | "South America" | "Oceania" | "Middle East";
  publishedAt: string; // ISO
  imageHue: number;
};

export const TOPICS: WorldArticle["topic"][] = ["Politics","Business","Tech","Science","Health","Entertainment","Sports"];
export const REGIONS: WorldArticle["region"][] = ["North America","Europe","Asia","Africa","South America","Oceania","Middle East"];
export const SOURCES = ["Associated Press","Reuters","BBC","Bloomberg","The Guardian","Al Jazeera","Nikkei"];

const hour = (h: number) => {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
};

export const WORLD_ARTICLES: WorldArticle[] = [
  { id: "w1", headline: "EU finalizes landmark AI safety framework", summary: "Member states agreed on tiered rules covering general-purpose AI, with phased enforcement through 2027.", body: "European Union member states finalized a landmark AI safety framework after 18 months of negotiation. The rules establish a tiered system for general-purpose AI models, with the strictest requirements applied to systems above a defined compute threshold. Enforcement begins in phases through 2027.", source: "Reuters", topic: "Tech", region: "Europe", publishedAt: hour(1), imageHue: 215 },
  { id: "w2", headline: "Japan's central bank holds rates, signals patience on hikes", summary: "Governor Ueda emphasized the need to confirm sustained wage growth before further moves.", body: "The Bank of Japan held its benchmark rate steady and signaled patience on further hikes. Governor Kazuo Ueda told reporters the bank wants to confirm sustained wage growth before tightening further.", source: "Nikkei", topic: "Business", region: "Asia", publishedAt: hour(2), imageHue: 25 },
  { id: "w3", headline: "Brazil pledges $5B Amazon reforestation fund", summary: "Lula announced the initiative ahead of COP30, with backing from Norway and Germany.", body: "Brazilian President Lula da Silva announced a 5 billion dollar Amazon reforestation fund ahead of COP30. The initiative has initial backing from Norway and Germany and targets restoring 12 million hectares by 2035.", source: "BBC", topic: "Science", region: "South America", publishedAt: hour(3), imageHue: 140 },
  { id: "w4", headline: "Nigerian fintech Flutterwave files for IPO at $7B valuation", summary: "The Lagos-based payments giant plans a dual listing in New York and Lagos.", body: "Nigerian fintech Flutterwave filed for an IPO targeting a 7 billion dollar valuation. The Lagos-based payments company plans a dual listing on the NYSE and Nigerian Exchange.", source: "Bloomberg", topic: "Business", region: "Africa", publishedAt: hour(4), imageHue: 280 },
  { id: "w5", headline: "WHO warns of accelerating antibiotic resistance", summary: "New report finds resistant bloodstream infections rose 15% globally since 2019.", body: "The World Health Organization warned that antibiotic resistance is accelerating faster than predicted. A new report finds resistant bloodstream infections have risen 15 percent globally since 2019.", source: "Associated Press", topic: "Health", region: "Europe", publishedAt: hour(5), imageHue: 5 },
  { id: "w6", headline: "Australia opens largest green hydrogen plant in Southern Hemisphere", summary: "The Pilbara facility will produce 200,000 tons annually starting in 2027.", body: "Australia opened the largest green hydrogen plant in the Southern Hemisphere. The Pilbara facility will produce 200 thousand tons of green hydrogen annually starting in 2027, with most exports bound for Japan and South Korea.", source: "The Guardian", topic: "Science", region: "Oceania", publishedAt: hour(6), imageHue: 175 },
  { id: "w7", headline: "Cannes Film Festival jury awards Palme d'Or to debut director", summary: "Iranian filmmaker Niloofar Sadeghi won for her hometown drama 'Silver Wind'.", body: "Iranian filmmaker Niloofar Sadeghi won the Palme d'Or at Cannes for her debut feature 'Silver Wind', a quiet drama set in her hometown of Isfahan. She is the youngest debut director ever to take the top prize.", source: "BBC", topic: "Entertainment", region: "Europe", publishedAt: hour(8), imageHue: 320 },
  { id: "w8", headline: "Saudi Arabia announces $40B push into space launch market", summary: "The kingdom plans 12 orbital launches per year by 2030 from a new Red Sea spaceport.", body: "Saudi Arabia announced a 40 billion dollar investment to enter the commercial space launch market. The plan calls for 12 orbital launches per year by 2030 from a new spaceport on the Red Sea coast.", source: "Al Jazeera", topic: "Science", region: "Middle East", publishedAt: hour(10), imageHue: 250 },
  { id: "w9", headline: "Manchester City clinches Premier League title in dramatic finish", summary: "A 92nd-minute winner sealed a record fifth consecutive championship.", body: "Manchester City clinched a record fifth consecutive Premier League title with a 92nd minute winner against Arsenal. Phil Foden scored the deciding goal in front of a sold-out Etihad Stadium.", source: "BBC", topic: "Sports", region: "Europe", publishedAt: hour(12), imageHue: 195 },
  { id: "w10", headline: "India crosses 500 million 5G subscribers", summary: "The country reached the milestone less than three years after launch.", body: "India crossed 500 million 5G subscribers less than three years after launch, making it the fastest 5G rollout in history. Reliance Jio and Bharti Airtel together account for more than 85 percent of subscribers.", source: "Nikkei", topic: "Tech", region: "Asia", publishedAt: hour(14), imageHue: 290 },
  { id: "w11", headline: "UN climate envoy: 2030 emissions targets 'still within reach'", summary: "Despite slow progress, a new analysis sees a viable path if current pledges are met.", body: "The United Nations climate envoy said 2030 emissions targets remain within reach despite slow progress. A new analysis from the UN Environment Programme finds the goals viable if all current pledges are fully implemented.", source: "Reuters", topic: "Politics", region: "North America", publishedAt: hour(18), imageHue: 130 },
  { id: "w12", headline: "Spotify launches AI-powered podcast translation in 20 languages", summary: "Creators can publish in their native voice cloned into other languages automatically.", body: "Spotify launched AI-powered podcast translation across 20 languages. Creators can publish episodes in their native voice cloned into other languages automatically, expanding reach without re-recording.", source: "Bloomberg", topic: "Tech", region: "North America", publishedAt: hour(22), imageHue: 165 },
];
