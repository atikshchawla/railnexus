import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50 text-slate-900">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-sm font-black text-white">
          RN
        </span>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">RailNexus</h1>
          <p className="text-slate-500">
            AI-Driven Automatic Block Planning &amp; Digital Twin for Indian Railways
          </p>
        </div>
      </div>
      <Link
        href="/digital-twin"
        className="rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white shadow-md transition-colors hover:bg-sky-500"
      >
        Open Digital Twin Demo
      </Link>
    </main>
  );
}
