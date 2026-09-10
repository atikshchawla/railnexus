"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { loadDashboardData, type DashboardData } from "./api";

interface DashboardContextValue {
  data: DashboardData;
  loading: boolean;
  error: string | null;
  refresh: () => void;
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

  useEffect(() => {
    let active = true;
    
    const fetchData = () => {
      loadDashboardData()
        .then((nextData) => {
          if (!active) return;
          setData(nextData);
          setError(null);
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
    const interval = setInterval(fetchData, 15000); // Auto-refresh every 15s
    
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshToken]);

  return (
    <DashboardContext.Provider value={{ data, loading, error, refresh: () => setRefreshToken((token) => token + 1) }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboardData must be used inside DashboardProvider");
  return context;
}
