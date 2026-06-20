import { createFileRoute, redirect } from "@tanstack/react-router";
import { getState } from "@/lib/store";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const onboarded =
      typeof window !== "undefined" ? getState().onboarded : false;
    throw redirect({ to: onboarded ? "/area" : "/welcome" });
  },
  component: () => null,
});
