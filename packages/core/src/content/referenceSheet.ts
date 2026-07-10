/**
 * In-app Algebra Regents Reference Sheet (design doc §4.5) — the conversions
 * and formulas from the NYS Algebra I Regents Reference Table that lessons
 * point students to, in both languages.
 */
export interface ReferenceSection {
  titleEn: string;
  titleEs: string;
  rows: { labelEn: string; labelEs: string; latex: string }[];
}

export const referenceSheet: ReferenceSection[] = [
  {
    titleEn: 'Conversions',
    titleEs: 'Conversiones',
    rows: [
      { labelEn: '1 mile', labelEs: '1 milla', latex: '= 5280\\ \\text{feet} = 1760\\ \\text{yards} = 1.609\\ \\text{km}' },
      { labelEn: '1 kilometer', labelEs: '1 kilómetro', latex: '= 0.62\\ \\text{mile}' },
      { labelEn: '1 foot', labelEs: '1 pie', latex: '= 12\\ \\text{inches}' },
      { labelEn: '1 yard', labelEs: '1 yarda', latex: '= 3\\ \\text{feet}' },
      { labelEn: '1 inch', labelEs: '1 pulgada', latex: '= 2.54\\ \\text{centimeters}' },
      { labelEn: '1 pound', labelEs: '1 libra', latex: '= 16\\ \\text{ounces} = 0.454\\ \\text{kg}' },
      { labelEn: '1 kilogram', labelEs: '1 kilogramo', latex: '= 2.2\\ \\text{pounds}' },
      { labelEn: '1 ton', labelEs: '1 tonelada', latex: '= 2000\\ \\text{pounds}' },
      { labelEn: '1 gallon', labelEs: '1 galón', latex: '= 4\\ \\text{quarts} = 3.785\\ \\text{liters}' },
      { labelEn: '1 liter', labelEs: '1 litro', latex: '= 0.264\\ \\text{gallon} = 1000\\ \\text{cm}^3' },
      { labelEn: '1 hour', labelEs: '1 hora', latex: '= 60\\ \\text{minutes};\\ 1\\ \\text{min} = 60\\ \\text{s}' },
    ],
  },
  {
    titleEn: 'Formulas',
    titleEs: 'Fórmulas',
    rows: [
      { labelEn: 'Triangle area', labelEs: 'Área del triángulo', latex: 'A = \\tfrac{1}{2}bh' },
      { labelEn: 'Parallelogram area', labelEs: 'Área del paralelogramo', latex: 'A = bh' },
      { labelEn: 'Circle area', labelEs: 'Área del círculo', latex: 'A = \\pi r^2' },
      { labelEn: 'Circle circumference', labelEs: 'Circunferencia del círculo', latex: 'C = \\pi d = 2\\pi r' },
      { labelEn: 'Pythagorean Theorem', labelEs: 'Teorema de Pitágoras', latex: 'a^2 + b^2 = c^2' },
    ],
  },
  {
    titleEn: 'Linear & Slope',
    titleEs: 'Lineal y Pendiente',
    rows: [
      { labelEn: 'Slope formula', labelEs: 'Fórmula de la pendiente', latex: 'm = \\frac{y_2 - y_1}{x_2 - x_1}' },
      { labelEn: 'Slope-intercept form', labelEs: 'Forma pendiente-intercepto', latex: 'y = mx + b' },
      { labelEn: 'Point-slope form', labelEs: 'Forma punto-pendiente', latex: 'y - y_1 = m(x - x_1)' },
      { labelEn: 'Standard form', labelEs: 'Forma estándar', latex: 'Ax + By = C' },
    ],
  },
  {
    titleEn: 'Quadratics & Exponentials',
    titleEs: 'Cuadráticas y Exponenciales',
    rows: [
      { labelEn: 'Quadratic formula', labelEs: 'Fórmula cuadrática', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
      { labelEn: 'Axis of symmetry', labelEs: 'Eje de simetría', latex: 'x = \\frac{-b}{2a}' },
      { labelEn: 'Vertex form', labelEs: 'Forma de vértice', latex: 'y = a(x-h)^2 + k' },
      { labelEn: 'Exponential function', labelEs: 'Función exponencial', latex: 'y = ab^x' },
      { labelEn: 'Exponential growth', labelEs: 'Crecimiento exponencial', latex: 'y = a(1+r)^t' },
      { labelEn: 'Exponential decay', labelEs: 'Decaimiento exponencial', latex: 'y = a(1-r)^t' },
    ],
  },
  {
    titleEn: 'Inequality Keywords',
    titleEs: 'Palabras Clave de Desigualdades',
    rows: [
      { labelEn: 'at least / no less than / a minimum of', labelEs: 'al menos / no menos que / un mínimo de', latex: '\\ge' },
      { labelEn: 'at most / no more than / a maximum of', labelEs: 'a lo más / no más de / un máximo de', latex: '\\le' },
      { labelEn: 'greater than / more than', labelEs: 'mayor que / más que', latex: '>' },
      { labelEn: 'less than / fewer than', labelEs: 'menor que / menos que', latex: '<' },
    ],
  },
];
