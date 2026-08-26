import type { ReactNode } from "react";

export type Signal = "green" | "amber" | "red" | "neutral";

const bar: Record<Signal, string> = {
  green: "bg-signal-green",
  amber: "bg-signal-amber",
  red: "bg-signal-red",
  neutral: "bg-border",
};

export function Panel({
  title,
  signal = "neutral",
  right,
  children,
  className = "",
}: {
  title?: string;
  signal?: Signal;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative panel ${className}`}>
      <span className={`absolute left-0 top-0 h-full w-[3px] ${bar[signal]}`} />
      {title && (
        <header className="flex items-center justify-between border-b border-border px-4 py-2 pl-5">
          <h2 className="text-xs tracking-[0.18em] text-muted-foreground">{title}</h2>
          {right}
        </header>
      )}
      <div className="px-4 py-3 pl-5">{children}</div>
    </section>
  );
}

export function Chip({ tone = "neutral", children }: { tone?: Signal; children: ReactNode }) {
  const tones: Record<Signal, string> = {
    green: "border-signal-green text-signal-green",
    amber: "border-signal-amber text-signal-amber",
    red: "border-signal-red text-signal-red",
    neutral: "border-border text-muted-foreground",
  };
  return (
    <span className={`num border px-1.5 py-0.5 text-[10px] tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Btn({
  variant = "ghost",
  children,
  onClick,
  disabled,
  className = "",
}: {
  variant?: "primary" | "ghost" | "danger" | "go";
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "border-signal-amber text-signal-amber hover:bg-signal-amber/10",
    ghost: "border-border text-foreground hover:bg-panel-raised",
    danger: "border-signal-red text-signal-red hover:bg-signal-red/10",
    go: "border-signal-green text-signal-green hover:bg-signal-green/10",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Lamp({ tone }: { tone: Signal }) {
  const c = { green: "bg-signal-green", amber: "bg-signal-amber", red: "bg-signal-red", neutral: "bg-border" }[tone];
  return <span className={`lamp inline-block h-2 w-2 rounded-full ${c}`} />;
}

export function Meter({ value, tone = "amber" }: { value: number; tone?: Signal }) {
  const c = { green: "bg-signal-green", amber: "bg-signal-amber", red: "bg-signal-red", neutral: "bg-border" }[tone];
  return (
    <div className="h-1.5 w-full bg-panel-raised">
      <div className={`h-full ${c}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
