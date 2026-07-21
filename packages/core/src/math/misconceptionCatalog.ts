/**
 * Short EN/ES display labels for every misconception id the generators emit
 * (docs/statistics-plan.md, Phase 1). The per-problem feedback strings stay
 * in generators.ts — those speak to the student about ONE problem; these
 * name the error pattern itself for teacher-facing reports ("11 students
 * flip the inequality the wrong way"). A test asserts this catalog covers
 * every id used in generators.ts, so a new misconception can't ship
 * unlabeled.
 */

export interface MisconceptionLabel {
  labelEn: string;
  labelEs: string;
}

export const misconceptionCatalog: Record<string, MisconceptionLabel> = {
  inverse_operation_error: {
    labelEn: 'Uses the same operation instead of the inverse',
    labelEs: 'Usa la misma operación en vez de la inversa',
  },
  skipped_division: {
    labelEn: 'Stops before the final division',
    labelEs: 'Se detiene antes de la división final',
  },
  minus_not_distributed: {
    labelEn: 'Subtracts only the first term of a polynomial',
    labelEs: 'Resta solo el primer término del polinomio',
  },
  partial_distribution: {
    labelEn: 'Distributes to only the first term',
    labelEs: 'Distribuye solo al primer término',
  },
  foil_missed_middle_terms: {
    labelEn: 'Drops the middle terms when multiplying binomials',
    labelEs: 'Omite los términos del medio al multiplicar binomios',
  },
  missed_inequality_flip: {
    labelEn: "Doesn't flip the inequality after dividing by a negative",
    labelEs: 'No invierte la desigualdad al dividir entre un negativo',
  },
  unnecessary_inequality_flip: {
    labelEn: 'Flips the inequality when it should stay',
    labelEs: 'Invierte la desigualdad cuando no corresponde',
  },
  negative_square_error: {
    labelEn: 'Sign error when squaring a negative',
    labelEs: 'Error de signo al elevar un negativo al cuadrado',
  },
  missed_negative_root: {
    labelEn: 'Forgets the negative square root',
    labelEs: 'Olvida la raíz cuadrada negativa',
  },
  gcf_larger_exponent: {
    labelEn: 'Takes the larger exponent for the GCF',
    labelEs: 'Toma el exponente mayor para el MCD',
  },
  factor_signs_swapped: {
    labelEn: 'Swaps the signs when factoring',
    labelEs: 'Intercambia los signos al factorizar',
  },
  coordinates_swapped: {
    labelEn: 'Writes points as (y, x)',
    labelEs: 'Escribe los puntos como (y, x)',
  },
  slope_rise_run_inverted: {
    labelEn: 'Computes slope as run over rise',
    labelEs: 'Calcula la pendiente como avance sobre elevación',
  },
  slope_mixed_point_order: {
    labelEn: 'Mixes the point order in the slope formula',
    labelEs: 'Mezcla el orden de los puntos en la fórmula de la pendiente',
  },
};

/** Label for an id, falling back to the raw slug so unknown ids still render. */
export function misconceptionLabel(id: string, locale: 'en' | 'es'): string {
  const entry = misconceptionCatalog[id];
  if (!entry) return id.replace(/_/g, ' ');
  return locale === 'es' ? entry.labelEs : entry.labelEn;
}
