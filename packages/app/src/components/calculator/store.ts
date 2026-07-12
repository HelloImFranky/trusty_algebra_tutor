/**
 * Calculator UI state (graphing-calculator architecture doc): React owns the
 * keypad/viewport/local state here; every actual computation goes through
 * @tutor/core's calculator engine. The store snapshot is the same
 * CalculatorState JSON the backend persists, so sessions restore anywhere.
 */
import { create } from 'zustand';
import {
  DEFAULT_WINDOW,
  EMPTY_CALCULATOR_STATE,
  evaluateCalculation,
  type AngleMode,
  type CalculatorState,
  type GraphWindow,
  type HistoryEntry,
} from '@tutor/core';

export type CalcTab = 'calc' | 'graph' | 'table';

export const GRAPH_COLORS = ['#3b5bdb', '#e8590c', '#0ca678', '#9c36b5'] as const;
export const MAX_EXPRESSIONS = GRAPH_COLORS.length;

interface CalculatorStore {
  hydrated: boolean;
  tab: CalcTab;
  input: string;
  /** 'equation' means "graph it instead" — the view renders a friendly hint */
  inputError: string | null;
  angleMode: AngleMode;
  ans: number | null;
  variables: Record<string, number>;
  history: HistoryEntry[];
  expressions: string[];
  window: GraphWindow;
  tableStart: number;
  tableStep: number;

  setTab: (tab: CalcTab) => void;
  setInput: (input: string) => void;
  setAngleMode: (mode: AngleMode) => void;
  evaluate: () => void;
  recall: (entry: HistoryEntry) => void;
  clearHistory: () => void;
  setExpression: (index: number, value: string) => void;
  addExpression: () => void;
  removeExpression: (index: number) => void;
  setWindow: (window: GraphWindow) => void;
  resetWindow: () => void;
  setTable: (start: number, step: number) => void;
  hydrate: (state: CalculatorState) => void;
  snapshot: () => CalculatorState;
}

export const useCalculatorStore = create<CalculatorStore>()((set, get) => ({
  hydrated: false,
  tab: 'calc',
  input: '',
  inputError: null,
  angleMode: EMPTY_CALCULATOR_STATE.angleMode,
  ans: null,
  variables: {},
  history: [],
  expressions: [...EMPTY_CALCULATOR_STATE.expressions],
  window: { ...DEFAULT_WINDOW },
  tableStart: -3,
  tableStep: 1,

  setTab: (tab) => set({ tab }),
  setInput: (input) => set({ input, inputError: null }),
  setAngleMode: (angleMode) => set({ angleMode }),

  evaluate: () => {
    const { input, angleMode, ans, variables, history } = get();
    if (!input.trim()) return;
    const r = evaluateCalculation(input, { angleMode, ans, variables });
    if (!r.ok || r.display === undefined) {
      set({ inputError: r.error ?? 'syntax error' });
      return;
    }
    const entry: HistoryEntry = { input: input.trim(), display: r.display };
    if (r.fraction) entry.fraction = r.fraction;
    set({
      input: '',
      inputError: null,
      ans: r.value ?? ans,
      variables: r.variables ?? variables,
      history: [...history, entry].slice(-50),
    });
  },

  recall: (entry) => set({ input: entry.input, inputError: null }),
  clearHistory: () => set({ history: [], ans: null, variables: {} }),

  setExpression: (index, value) =>
    set({ expressions: get().expressions.map((e, i) => (i === index ? value : e)) }),
  addExpression: () => {
    const { expressions } = get();
    if (expressions.length < MAX_EXPRESSIONS) set({ expressions: [...expressions, ''] });
  },
  removeExpression: (index) => {
    const next = get().expressions.filter((_, i) => i !== index);
    set({ expressions: next.length ? next : [''] });
  },

  setWindow: (window) => set({ window }),
  resetWindow: () => set({ window: { ...DEFAULT_WINDOW } }),
  setTable: (tableStart, tableStep) => set({ tableStart, tableStep }),

  hydrate: (state) =>
    set({
      hydrated: true,
      angleMode: state.angleMode,
      history: state.history,
      variables: state.variables,
      expressions: state.expressions.length ? state.expressions : [''],
      window: state.window,
      ans: lastAns(state.history),
    }),

  snapshot: () => {
    const { angleMode, expressions, window, history, variables } = get();
    return { version: 1, angleMode, expressions, window, history, variables };
  },
}));

function lastAns(history: HistoryEntry[]): number | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const n = Number(history[i].display);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
