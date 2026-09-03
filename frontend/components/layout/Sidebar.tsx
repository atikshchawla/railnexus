"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wrench,
  Layers,
  CheckSquare,
  Map,
  BarChart3,
  Radio,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Maintenance requests", href: "/maintenance", icon: Wrench },
  { label: "Shadow blocks", href: "/shadow-blocks", icon: Layers },
  { label: "Approvals", href: "/approvals", icon: CheckSquare },
  { label: "Digital twin", href: "/twin", icon: Map },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 h-screen sticky top-0 flex flex-col bg-surface border-r border-border-default">
      {/* Brand header */}
      <div className="px-4 py-3 border-b border-border-default bg-brand">
        <p className="text-[11px] text-white/70 leading-tight">
          भारतीय रेल / Indian Railways
        </p>
        <h1 className="text-[15px] font-semibold text-white tracking-tight leading-tight">
          RailNexus ABP
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded text-[13px]
                transition-colors duration-100
                ${
                  isActive
                    ? "bg-brand text-white font-medium"
                    : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
                }
              `}
            >
              <Icon size={16} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Status footer */}
      <div className="px-4 py-3 border-t border-border-default">
        <div className="flex items-center gap-2">
          <Radio size={12} className="text-success" />
          <span className="text-[11px] text-text-secondary">System online</span>
        </div>
      </div>
    </aside>
  );
}
