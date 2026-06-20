import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getState } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const s = getState();
    navigate({ to: s.onboarded ? "/area" : "/welcome", replace: true });
  }, [navigate]);
  return null;
}
