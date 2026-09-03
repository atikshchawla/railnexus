import { Sidebar } from "@/components/layout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
    </div>
  );
}
