import { Link, useRouterState } from "@tanstack/react-router";
import { MapPin, Globe2, User } from "lucide-react";

const items = [
  { to: "/area", label: "My Area", Icon: MapPin },
  { to: "/world", label: "World", Icon: Globe2 },
  { to: "/settings", label: "Profile", Icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border safe-bottom">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-2">
        {items.map(({ to, label, Icon }) => {
          const active = pathname === to || (to !== "/" && pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className="flex flex-1 flex-col items-center gap-1 py-1 text-xs"
            >
              <div
                className={`flex h-9 w-12 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
              </div>
              <span className={active ? "text-primary font-medium" : "text-muted-foreground"}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      {children}
      <BottomNav />
    </div>
  );
}
