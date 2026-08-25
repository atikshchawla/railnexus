import { DemoControls } from "@/components/digital-twin/DemoControls";
import { InspectorPanel } from "@/components/digital-twin/InspectorPanel";
import { LogPanel } from "@/components/digital-twin/LogPanel";
import { MapRenderer } from "@/components/digital-twin/MapRenderer";
import { Toolbar } from "@/components/digital-twin/Toolbar";
import { TopBar } from "@/components/digital-twin/TopBar";

export default function DigitalTwinPage() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-50">
      <MapRenderer />

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto">
          <TopBar />
        </div>

        <div className="pointer-events-auto absolute left-3 top-[76px]">
          <Toolbar />
        </div>

        <div className="pointer-events-auto absolute right-3 top-[76px]">
          <InspectorPanel />
        </div>

        <div className="pointer-events-auto absolute bottom-4 left-3">
          <LogPanel />
        </div>

        <div className="pointer-events-auto absolute inset-x-0 bottom-4 flex justify-center">
          <DemoControls />
        </div>
      </div>
    </main>
  );
}
