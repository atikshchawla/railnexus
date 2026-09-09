import { useState, useEffect, useCallback } from 'react';

const CONFIG = {
  world: "http://localhost:9001",
  bridge: "http://localhost:9002",
  memberB: "http://localhost:8787",
};

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function normalizeWorld(raw, network) {
  if (!network || !raw) return null;
  const byId = new Map(network.sections.map((section) => [section.id, section]));
  return {
    tick: raw.tick,
    timestamp: raw.timestamp,
    trains: raw.trains.map((train) => {
      const section = byId.get(train.section_id);
      return {
        id: train.train_id,
        name: train.train_id,
        km: (section?.from.km || 0) + train.position_km,
        speedKmh: train.speed_kmph,
        status: train.status === "waiting" ? "stopped" : train.status,
        delayMinutes: train.delay_min,
        nextSectionId: train.section_id,
        heldSectionIds: [train.section_id],
      };
    }),
    sections: raw.sections.map((section) => {
      const topology = byId.get(section.section_id);
      return {
        id: section.section_id,
        fromStation: topology?.from.name || section.section_id.split("-")[0],
        toStation: topology?.to.name || section.section_id.split("-")[1],
        fromKm: topology?.from.km || 0,
        toKm: topology?.to.km || 0,
        status: section.state === "maintenance" ? "Caution" : "Clear",
        occupiedBy: section.occupant_train_id || undefined,
        fault: section.fault_reason || undefined,
        state: section.state,
      };
    }),
  };
}

function normalizeMemberB(raw) {
  if (!raw) return null;
  const requests = ["TMS", "TDMS", "SMMS"].flatMap((department) =>
    (raw.departments?.[department]?.requests || []).map((request) => ({
      id: request.request_id,
      department,
      type: request.type,
      trainId: request.train_id,
      sectionId: request.section_id,
      description: request.description,
      raisedAt: request.raised_at,
      status: "decided",
    }))
  );

  return {
    ...raw,
    departments: {
      TMS: { requests: requests.filter((r) => r.department === "TMS") },
      TDMS: { requests: requests.filter((r) => r.department === "TDMS") },
      SMMS: { requests: requests.filter((r) => r.department === "SMMS") },
    },
    decisions: (raw.decisions || []).map((decision) => ({
      requestId: decision.request_id,
      decision: decision.status,
      sectionId: decision.section_id,
      sectionState: decision.resulting_state,
    })),
  };
}

export function useDemoState() {
  const [network, setNetwork] = useState(null);
  const [world, setWorld] = useState(null);
  const [rawWorld, setRawWorld] = useState(null);
  const [memberB, setMemberB] = useState(null);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);

  const fetchState = useCallback(async () => {
    if (paused) return;
    try {
      const [newNetwork, newRawWorld, newRawMemberB] = await Promise.all([
        getJson(`${CONFIG.world}/network`),
        getJson(`${CONFIG.bridge}/world-state`),
        getJson(`${CONFIG.memberB}/api/state`),
      ]);

      const newWorld = normalizeWorld(newRawWorld, newNetwork);
      
      setNetwork(newNetwork);
      setWorld(newWorld);
      setRawWorld(newRawWorld);
      setMemberB(normalizeMemberB(newRawMemberB));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [paused]);

  useEffect(() => {
    fetchState(); // Initial fetch
    const interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const injectFault = async (sectionId, type, durationTicks = 30) => {
    await fetch(`${CONFIG.world}/faults`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section_id: sectionId, type, duration_ticks: durationTicks }),
    });
    fetchState();
  };

  const clearFault = async (sectionId) => {
    await fetch(`${CONFIG.world}/faults/${encodeURIComponent(sectionId)}`, { method: "DELETE" });
    fetchState();
  };

  const raiseRequest = async (department, type, sectionId, trainId) => {
    await fetch(`${CONFIG.memberB}/api/inject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ department, type, sectionId, trainId: trainId || undefined }),
    });
    fetchState();
  };

  return {
    network,
    world,
    rawWorld,
    memberB,
    error,
    paused,
    setPaused,
    injectFault,
    clearFault,
    raiseRequest,
  };
}
