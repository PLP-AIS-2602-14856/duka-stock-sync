import { Link, useRouterState } from "@tanstack/react-router";
import { Boxes, Building2, Layers, ClipboardList, RefreshCw, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";

const nav = [
  { to: "/items", label: "Items", icon: Boxes },
  { to: "/warehouses", label: "Warehouses", icon: Building2 },
  { to: "/stock", label: "Stock", icon: Layers },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/sync-log", label: "Sync Log", icon: RefreshCw },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      <Link
        to="/"
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
          pathname === "/"
            ? "bg-sidebar-accent text-sidebar-primary font-semibold"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
        }`}
      >
        <Layers className="size-4" />
        Overview
      </Link>
      {nav.map(({ to, label, icon: Icon }) => {
        const active = pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="px-3 py-4">
      <p className="text-sidebar-primary text-xs font-semibold tracking-[0.18em] uppercase">
        Duka Sync
      </p>
      <p className="text-sidebar-foreground/70 mt-1 text-xs">Wholesale inventory · Kenya</p>
    </div>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-background flex min-h-screen w-full">
      <aside className="bg-sidebar border-sidebar-border hidden w-60 shrink-0 flex-col border-r px-3 py-2 md:flex">
        <Brand />
        <NavLinks />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="bg-foreground/40 absolute inset-0" onClick={() => setOpen(false)} />
          <aside className="bg-sidebar border-sidebar-border relative z-50 flex w-60 flex-col border-r px-3 py-2">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="text-sidebar-foreground/70 absolute top-4 right-3"
            >
              <X className="size-4" />
            </button>
            <Brand />
            <NavLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-card/80 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur">
          <button
            className="text-muted-foreground md:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-foreground truncate text-lg font-semibold">{title}</h1>
            {description && (
              <p className="text-muted-foreground truncate text-xs">{description}</p>
            )}
          </div>
          {actions}
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
