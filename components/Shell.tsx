"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConsole, type Role } from "@/lib/console-store";
import { Lamp } from "./ui-kit";

const NAV: (
  | { href: string; label: string; code: string }
)[] = [
  { href: "/", label: "Dashboard", code: "01" },
  { href: "/twin", label: "Digital Twin", code: "02" },
  { href: "/approvals", label: "Approvals", code: "03" },
  { href: "/authorize", label: "Authorization", code: "04" },
  { href: "/active", label: "Active Block", code: "05" },
  { href: "/digital-twin", label: "Demo Simulation", code: "06" },
];

const ROLES: Role[] = ["SSE", "Controller", "Station Master"];

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, dispatch } = useConsole();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 flex h-screen w-[210px] shrink-0 flex-col border-r border-border bg-panel">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <Lamp tone={state.blockActive ? "red" : "green"} />
            <h1 className="text-sm tracking-[0.2em]">RailNexus</h1>
          </div>
          <p className="num mt-1 text-[10px] text-muted-foreground">TWIN CONSOLE v0.9</p>
        </div>

        <nav className="flex flex-col py-2">
          {NAV.map((n) => {
            const active = pathname === n.href;
            const baseClasses =
              "flex items-center gap-3 border-l-2 px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] transition-colors";
            const activeClasses = active
              ? "border-signal-amber bg-panel-raised text-signal-amber"
              : "border-transparent text-muted-foreground hover:bg-panel-raised";
            const classes = `${baseClasses} ${activeClasses}`;
            return (
              <Link key={n.href} href={n.href} className={classes}>
                <span className="num text-[10px] opacity-60">{n.code}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border p-3">
          <p className="num mb-2 text-[10px] tracking-[0.14em] text-muted-foreground">ROLE</p>
          <div className="flex flex-col gap-1">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => dispatch({ type: "role", role: r })}
                className={`border px-2 py-1.5 text-left text-[10px] uppercase tracking-[0.12em] ${
                  state.role === r
                    ? "border-signal-amber text-signal-amber"
                    : "border-border text-muted-foreground hover:bg-panel-raised"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-border bg-panel px-6 py-2.5">
          <p className="num text-[11px] tracking-[0.16em] text-muted-foreground">
            DIV: DELHI · SECTION: NDLS–NZM · SIGNED IN AS {state.role.toUpperCase()}
          </p>
          <p className="num text-[11px] text-signal-amber">KAVACH ZONE · ARMED</p>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
