"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchBlocks, fetchConflicts } from "@/lib/api-client";

/** Shared hook that loads blocks from the backend and falls back to mock data. */
export function useBlocks() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBlocks();
      setBlocks(data);
      setError(null);
    } catch (err: any) {
      console.warn("Backend unavailable, using mock data:", err.message);
      // Import mock data as fallback
      const { mockBlocks } = await import("@/lib/mock-data");
      setBlocks(mockBlocks);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { blocks, loading, error, reload };
}

/** Shared hook that loads conflicts from the backend with mock fallback. */
export function useConflicts() {
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchConflicts();
      setConflicts(data);
      setError(null);
    } catch (err: any) {
      console.warn("Backend unavailable, using mock conflicts:", err.message);
      const { mockConflicts } = await import("@/lib/mock-data");
      setConflicts(mockConflicts);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { conflicts, loading, error, reload };
}
