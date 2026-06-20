import { createFileRoute, redirect } from "@tanstack/react-router";
import { getState } from "@/lib/store";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Client-only routing decision; SSR will render the fallback once and the
    // client takes over with the hydrated state on mount.
    if (typeof window !== "undefined") {
      const s = getState();
      throw redirect({ to: s.onboarded ? "/area" : "/welcome" });
    }
  },
  component: () => null,
});
