export default function Home() {
  return (
    <div className="flex flex-col min-h-screen p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary">RailNexus ABP Dashboard</h1>
        <p className="text-foreground/70 mt-2">Automatic Block Planning System for Indian Railways</p>
      </header>
      <main className="flex-1">
        <div className="p-6 bg-panel rounded-lg border border-white/10">
          <p>System initialized. Ready for module implementation.</p>
        </div>
      </main>
    </div>
  );
}
