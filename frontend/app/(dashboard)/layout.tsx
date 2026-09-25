import { Sidebar, AccessibilityToolbar } from "@/components/layout";
import { DashboardProvider } from "@/lib/dashboard-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardProvider>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AccessibilityToolbar />
          <main id="main-content" className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}
