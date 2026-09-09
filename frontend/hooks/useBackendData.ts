"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchBlocks, fetchConflicts } from "@/lib/api-client";

/** Shared hook for the backend block register. */
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
      setBlocks([]);
      setError(err.message ?? "Failed to load blocks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { blocks, loading, error, reload };
}

/** Shared hook for backend conflict records. */
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
      setConflicts([]);
      setError(err.message ?? "Failed to load conflicts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { conflicts, loading, error, reload };
}
