import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Headphones, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actions } from "@/lib/store";
import { SAMPLE_LOCATIONS, US_STATES, type Location } from "@/lib/mockData";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "AreaNews — Wake up knowing what matters" },
      { name: "description", content: "A 5-minute, AI-summarized daily audio briefing for your town, county, and state." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1>(0);
  const [city, setCity] = useState("");
  const [state, setSt] = useState("TX");
  const [zip, setZip] = useState("");

  function startWithSamples() {
    actions.completeOnboarding(SAMPLE_LOCATIONS);
    navigate({ to: "/area" });
  }

  function finishCustom() {
    if (!city.trim()) return;
    const loc: Location = {
      id: `${city.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}`,
      label: "Home",
      city: city.trim(),
      state,
      zip: zip.trim() || undefined,
    };
    actions.completeOnboarding([loc]);
    navigate({ to: "/area" });
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-10 flex flex-col">
      {step === 0 ? (
        <div className="flex flex-1 flex-col">
          <div className="mt-6 flex items-center gap-2 text-primary">
            <Headphones className="h-5 w-5" />
            <span className="font-semibold tracking-tight">AreaNews</span>
          </div>

          <div className="mt-16 flex-1">
            <h1 className="text-balance text-4xl font-semibold leading-[1.05]">
              Wake up knowing exactly what matters around you.
            </h1>
            <p className="mt-4 text-balance text-base text-muted-foreground">
              A 5-minute AI-narrated briefing of the top local stories from your town, county and state — ready every morning.
            </p>

            <div className="mt-10 flex items-center gap-3 rounded-2xl bg-primary/5 p-4">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground pulse-ring">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="text-sm">
                <div className="font-medium">5-minute morning briefing</div>
                <div className="text-muted-foreground">Personalized to where you live</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button size="lg" className="w-full h-12 text-base" onClick={() => setStep(1)}>
              Get started
            </Button>
            <button
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={startWithSamples}
            >
              Try demo with sample locations
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <button onClick={() => setStep(0)} className="self-start text-sm text-muted-foreground">← Back</button>

          <div className="mt-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold">Where do you want news from?</h2>
            <p className="mt-1 text-sm text-muted-foreground">You can add more places later.</p>
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium">City or town</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Austin" className="mt-1 h-12" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">State</label>
                <Select value={state} onValueChange={setSt}>
                  <SelectTrigger className="mt-1 h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ZIP (optional)</label>
                <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="78704" className="mt-1 h-12" />
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-3 pt-10">
            <Button size="lg" className="w-full h-12 text-base" disabled={!city.trim()} onClick={finishCustom}>
              Continue
            </Button>
            <button className="w-full text-sm text-muted-foreground" onClick={startWithSamples}>
              Use sample locations instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
