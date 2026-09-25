"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import {
  loadDashboardData,
  optimizeRequests,
  saveOptimizerOverrides,
  type DashboardData,
  type OptimizerResponse,
  type OperatorOverride,
} from "./api";

interface DashboardContextValue {
  data: DashboardData;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  // Optimizer state — computed once, shared across all pages
  optimizer: OptimizerResponse | null;
  optimizerLoading: boolean;
  optimizerError: string | null;
  rerunOptimizer: () => void;
  saveOverrides: (overrides: Record<string, OperatorOverride>) => Promise<void>;
}

const emptyData: DashboardData = {
  blocks: [],
  conflicts: [],
  trains: [],
  stations: [],
  syncedAt: "",
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Optimizer — lifted up from individual pages
  const [optimizer, setOptimizer] = useState<OptimizerResponse | null>(null);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  // Track the last ID set we optimized so we only re-run when it changes
  const lastOptimizedKey = useRef<string>("");

  const runOptimizer = useCallback(
    (pendingIds: string[], force = false) => {
      if (pendingIds.length === 0) {
        setOptimizer(null);
        lastOptimizedKey.current = "";
        return;
      }
      const key = [...pendingIds].sort().join(",");
      if (!force && key === lastOptimizedKey.current) return; // nothing changed

      lastOptimizedKey.current = key;
      setOptimizerLoading(true);
      setOptimizerError(null);
      optimizeRequests(pendingIds, force)
        .then((res) => setOptimizer(res))
        .catch((err: unknown) =>
          setOptimizerError(err instanceof Error ? err.message : "Optimizer failed")
        )
        .finally(() => setOptimizerLoading(false));
    },
    [],
  );

  // Load dashboard data
  useEffect(() => {
    let active = true;

    const fetchData = () => {
      loadDashboardData()
        .then((nextData) => {
          if (!active) return;
          setData(nextData);
          setError(null);

          // Run optimizer for pending blocks (served from cache if unchanged)
          const pendingIds = nextData.blocks
            .filter((b) => b.status === "Under review" || b.status === "Submitted")
            .map((b) => b.id);
          runOptimizer(pendingIds);
        })
        .catch((reason: unknown) => {
          if (!active) return;
          setError(reason instanceof Error ? reason.message : "Unable to reach the RailNexus backend");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshToken, runOptimizer]);

  const rerunOptimizer = useCallback(() => {
    const pendingIds = data.blocks
      .filter((b) => b.status === "Under review" || b.status === "Submitted")
      .map((b) => b.id);
    runOptimizer(pendingIds, true); // force = bypass cache
  }, [data.blocks, runOptimizer]);

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

  return (
    <DashboardContext.Provider
      value={{
        data,
        loading,
        error,
        refresh: () => setRefreshToken((t) => t + 1),
        optimizer,
        optimizerLoading,
        optimizerError,
        rerunOptimizer,
        saveOverrides,
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
