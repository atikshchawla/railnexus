import { TopBar } from "@/components/layout";
import { ConflictCard } from "@/components/conflicts";
import { mockConflicts } from "@/lib/mock-data";

export default function ConflictsPage() {
  const unresolved = mockConflicts.filter((c) => !c.resolved);
  const resolved = mockConflicts.filter((c) => c.resolved);

  return (
    <>
      <TopBar
        title="Conflicts"
        subtitle={`${unresolved.length} unresolved cross-department overlap${unresolved.length !== 1 ? "s" : ""}`}
      />
      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        {/* Unresolved */}
        {unresolved.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-critical">
              Unresolved ({unresolved.length})
            </h3>
            {unresolved.map((c) => (
              <ConflictCard key={c.id} conflict={c} />
            ))}
          </div>
        )}

        {/* Resolved */}
        {resolved.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-text-secondary">
              Resolved ({resolved.length})
            </h3>
            {resolved.map((c) => (
              <ConflictCard key={c.id} conflict={c} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
