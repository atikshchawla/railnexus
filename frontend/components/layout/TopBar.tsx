import { Bell, User } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-border-default bg-surface">
      <div>
        <h2 className="text-[15px] font-semibold text-text-primary leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-text-secondary leading-tight">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-1.5 rounded hover:bg-surface-sunken transition-colors">
          <Bell size={16} strokeWidth={1.75} className="text-text-secondary" />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-critical rounded-full" />
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-border-default">
          <User size={16} strokeWidth={1.75} className="text-text-secondary" />
          <span className="text-[12px] text-text-secondary">SSE / Ambala</span>
        </div>
      </div>
    </header>
  );
}
