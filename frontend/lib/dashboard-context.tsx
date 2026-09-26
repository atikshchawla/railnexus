"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  loadDashboardData,
  optimizeRequests,
  saveOptimizerOverrides,
  resolveConflict as apiResolveConflict,
  type DashboardData,
  type OptimizerResponse,
  type OperatorOverride,
} from "./api";

interface DashboardContextValue {
  data: DashboardData;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  // Current active optimization run ID
  currentRunId: string | null;
  setCurrentRunId: (id: string | null) => void;
  // Optimizer state — computed once, shared across all pages
  optimizer: OptimizerResponse | null;
  optimizerLoading: boolean;
  optimizerError: string | null;
  rerunOptimizer: (customRequestIds?: string[]) => void;
  saveOverrides: (overrides: Record<string, OperatorOverride>) => Promise<void>;
  resolveConflict: (conflictId: string, resolutionAction: "Merged" | "Sequenced" | "Escalated") => void;
}

const emptyData: DashboardData = {
  blocks: [],
  conflicts: [],
  serverConflicts: [],
  proposals: [],
  operationalBlocks: [],
  trains: [],
  stations: [],
  topology: [],
  syncedAt: "",
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  // Optimizer — lifted up from individual pages
  const [optimizer, setOptimizer] = useState<OptimizerResponse | null>(null);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  // Track the last ID set we optimized so we only re-run when it changes
  const lastOptimizedKey = useRef<string>("");
  const optimizerRunningRef = useRef(false);

  const runOptimizer = useCallback(
    async (pendingIds: string[], force = false) => {
      if (optimizerRunningRef.current) return;
      if (pendingIds.length === 0) {
        setOptimizer(null);
        lastOptimizedKey.current = "";
        return;
      }
      const key = [...pendingIds].sort().join(",");
      if (!force && key === lastOptimizedKey.current) return; // nothing changed

      optimizerRunningRef.current = true;
      lastOptimizedKey.current = key;
      setOptimizerLoading(true);
      setOptimizerError(null);
      try {
        const res = await optimizeRequests(pendingIds, force);
        setOptimizer(res);
        if (res._run_id) {
          setCurrentRunId(res._run_id);
        }
        // Authoritatively synchronize fresh dashboard data immediately
        const freshData = await loadDashboardData();
        setData(freshData);
      } catch (err: unknown) {
        setOptimizerError(err instanceof Error ? err.message : "Optimizer failed");
      } finally {
        optimizerRunningRef.current = false;
        setOptimizerLoading(false);
      }
    },
    [],
  );

  // Load dashboard data
  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      if (optimizerRunningRef.current) return;

      try {
        const nextData = await loadDashboardData();
        if (!active) return;
        setData(nextData);
        setError(null);

        // Never overwrite an active run (including historical or 0-result runs) during background refresh!
        setCurrentRunId((prev) => {
          if (prev !== null) return prev;
          if (nextData.proposals.length > 0) {
            return nextData.proposals[0].run_id;
          }
          return null;
        });
      } catch (reason: unknown) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Unable to reach the RailNexus backend");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshToken]);

  const rerunOptimizer = useCallback(
    (customRequestIds?: string[]) => {
      const pendingIds =
        customRequestIds && customRequestIds.length > 0
          ? customRequestIds
          : data.blocks
              .filter((b) => b.status === "Under review" || b.status === "Submitted")
              .map((b) => b.id);
      runOptimizer(pendingIds, true); // force = bypass cache
    },
    [data.blocks, runOptimizer],
  );

  const saveOverrides = useCallback(
    async (overrides: Record<string, OperatorOverride>) => {
      const cacheId = optimizer?._cache_id;
      if (!cacheId) return;
      await saveOptimizerOverrides(cacheId, overrides);
      // Optimistically merge overrides into local state
      setOptimizer((prev) =>
        prev ? { ...prev, _operator_overrides: { ...prev._operator_overrides, ...overrides } } : prev
      );
    },
    [optimizer],
  );

  const resolveConflict = useCallback(
    async (conflictId: string, resolutionAction: "Merged" | "Sequenced" | "Escalated") => {
      try {
        const actionMap: Record<string, "MERGED" | "SEQUENCED" | "ESCALATED"> = {
          Merged: "MERGED",
          Sequenced: "SEQUENCED",
          Escalated: "ESCALATED",
        };
        const canonicalAction = actionMap[resolutionAction] || "ESCALATED";
        await apiResolveConflict(conflictId, {
          resolution_action: canonicalAction,
          actor_id: "CTRL-01",
          actor_role: "SECTION_CONTROLLER",
          rationale_notes: `Operator resolved via dashboard: ${resolutionAction}`,
        });
      } catch (e) {
        console.warn("Backend conflict resolve call returned error:", e);
      }
      setRefreshToken((t) => t + 1);
    },
    [],
  );

  return (
    <DashboardContext.Provider
      value={{
        data,
        loading,
        error,
        refresh: () => setRefreshToken((t) => t + 1),
        currentRunId,
        setCurrentRunId,
        optimizer,
        optimizerLoading,
        optimizerError,
        rerunOptimizer,
        saveOverrides,
        resolveConflict,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboardData must be used inside DashboardProvider");
  return context;
}
