import { useMemo } from 'react';
import { compileGraphFunction, type GraphFunction } from '@tutor/core';
import { GRAPH_COLORS, useCalculatorStore } from './store';

export interface CompiledExpression {
  raw: string;
  color: (typeof GRAPH_COLORS)[number];
  /** null while the row is empty */
  fn: GraphFunction | null;
}

/** Compile the graph-tab expressions once per change; shared by graph + table. */
export function useCompiledFns(): CompiledExpression[] {
  const expressions = useCalculatorStore((s) => s.expressions);
  const angleMode = useCalculatorStore((s) => s.angleMode);
  return useMemo(
    () =>
      expressions.map((raw, i) => ({
        raw,
        color: GRAPH_COLORS[i % GRAPH_COLORS.length],
        fn: raw.trim() ? compileGraphFunction(raw, { angleMode }) : null,
      })),
    [expressions, angleMode],
  );
}
