import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { APPROVALS, type Approval } from "@/lib/mock-data";

export type Role = "SSE" | "Controller" | "Station Master";

export type State = {
  role: Role;
  selectedLine: string | null;
  selectedTrain: string | null;
  drawerDefectId: string | null;
  block: { start: number; end: number; lineId: string; t0: number; t1: number };
  approvals: Approval[];
  activeApprovalId: string | null;
  numberRevealed: boolean;
  ackSM: boolean;
  ackSSE: boolean;
  blockActive: boolean;
  remaining: number; // seconds
};

type Action =
  | { type: "role"; role: Role }
  | { type: "selectLine"; lineId: string | null }
  | { type: "selectTrain"; trainId: string | null; lineId: string | null }
  | { type: "openDrawer"; defectId: string }
  | { type: "closeDrawer" }
  | { type: "setWindow"; start: number; end: number }
  | { type: "decide"; id: string; status: "approved" | "rejected" }
  | { type: "reveal"; value: boolean }
  | { type: "ack"; who: "SM" | "SSE"; value: boolean }
  | { type: "startBlock" }
  | { type: "tick" }
  | { type: "extend" }
  | { type: "endBlock" };

const initial: State = {
  role: "SSE",
  selectedLine: null,
  selectedTrain: null,
  drawerDefectId: null,
  block: { start: 810, end: 960, lineId: "yellow", t0: 0.3, t1: 0.55 },
  approvals: APPROVALS,
  activeApprovalId: "BR-4471",
  numberRevealed: false,
  ackSM: false,
  ackSSE: false,
  blockActive: false,
  remaining: 150 * 60,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "role":
      return { ...state, role: action.role };
    case "selectLine":
      return { ...state, selectedLine: action.lineId, selectedTrain: null };
    case "selectTrain":
      return { ...state, selectedTrain: action.trainId, selectedLine: action.lineId };
    case "openDrawer":
      return { ...state, drawerDefectId: action.defectId };
    case "closeDrawer":
      return { ...state, drawerDefectId: null };
    case "setWindow":
      return { ...state, block: { ...state.block, start: action.start, end: action.end } };
    case "decide":
      return {
        ...state,
        approvals: state.approvals.map((a) =>
          a.id === action.id ? { ...a, status: action.status } : a,
        ),
      };
    case "reveal":
      return { ...state, numberRevealed: action.value };
    case "ack":
      return action.who === "SM" ? { ...state, ackSM: action.value } : { ...state, ackSSE: action.value };
    case "startBlock":
      return { ...state, blockActive: true };
    case "tick":
      return { ...state, remaining: Math.max(0, state.remaining - 1) };
    case "extend":
      return { ...state, remaining: state.remaining + 30 * 60 };
    case "endBlock":
      return { ...state, blockActive: false, remaining: 0 };
    default:
      return state;
  }
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConsole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConsole must be used inside ConsoleProvider");
  return ctx;
}
