"use client";

import { ConsoleProvider } from "@/lib/console-store";
import { Shell } from "@/components/Shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleProvider>
      <Shell>{children}</Shell>
    </ConsoleProvider>
  );
}
