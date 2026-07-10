/**
 * Units 1-3 seed content, derived from the "Algebra Scaffolds__891" document
 * and the 891 pacing calendar: same numbered-step procedures, same hints and
 * mnemonics, same lesson codes as the classroom exit tickets.
 */
import type { UnitSeed } from './types.js';

export const unit1: UnitSeed = {
  number: 1,
  titleEn: 'Number Sense',
  titleEs: 'Sentido Numérico',
  lessons: [
    {
      code: '1.1',
      titleEn: 'Exponents, Perfect Squares & Roots',
      titleEs: 'Exponentes, Cuadrados Perfectos y Raíces',
      mnemonicEn: 'Squaring = multiply by itself twice. Cubing = three times.',
      mnemonicEs: 'Elevar al cuadrado = multiplicar por sí mismo dos veces. Al cubo = tres veces.',
      steps: [
        {
          bodyEn: 'A **perfect square** is the square of a whole number. Squaring a number means to multiply it by itself twice. Example: 25 is a perfect square because 5 × 5 = 25.',
          bodyEs: 'Un **cuadrado perfecto** es el cuadrado de un número entero. Elevar un número al cuadrado significa multiplicarlo por sí mismo dos veces. Ejemplo: 25 es un cuadrado perfecto porque 5 × 5 = 25.',
          workedExampleLatex: '5^2 = 5 \\times 5 = 25',
        },
        {
          bodyEn: 'There are **two** square roots for a positive number. Example: the square roots of 25 are both −5 and 5. A **perfect cube** is the cube of a whole number, and a positive number has just **one** cube root: the cube root of 125 is 5.',
          bodyEs: 'Un número positivo tiene **dos** raíces cuadradas. Ejemplo: las raíces cuadradas de 25 son −5 y 5. Un **cubo perfecto** es el cubo de un número entero, y un número positivo tiene solo **una** raíz cúbica: la raíz cúbica de 125 es 5.',
          workedExampleLatex: '\\sqrt{25} = \\pm 5, \\qquad \\sqrt[3]{125} = 5',
        },
        {
          bodyEn: '**Exponent rules**: when multiplying powers with the same base, ADD the exponents. When dividing, SUBTRACT the exponents. A power to a power: MULTIPLY the exponents.',
          bodyEs: '**Reglas de los exponentes**: al multiplicar potencias con la misma base, SUMA los exponentes. Al dividir, RESTA los exponentes. Potencia de una potencia: MULTIPLICA los exponentes.',
          workedExampleLatex: 'x^3 \\cdot x^4 = x^7, \\qquad \\frac{x^6}{x^2} = x^4, \\qquad (x^2)^3 = x^6',
          hintEn: 'Multiply → add exponents. Divide → subtract exponents.',
          hintEs: 'Multiplicar → suma exponentes. Dividir → resta exponentes.',
        },
      ],
      skill: { slug: 'exponents-perfect-squares', nameEn: 'Exponents & perfect squares', nameEs: 'Exponentes y cuadrados perfectos' },
      generated: [
        { template: 'perfect_square_root', tier: 'modified', count: 6 },
        { template: 'perfect_square_root', tier: 'standard', count: 4 },
        { template: 'exponent_product_rule', tier: 'standard', count: 6 },
        { template: 'exponent_product_rule', tier: 'challenge', count: 6 },
        { template: 'sprint_perfect_squares', tier: 'standard', count: 12, sprint: true },
      ],
      exitTicketSize: 5,
    },
    {
      code: '1.2',
      titleEn: 'Simplifying Radicals',
      titleEs: 'Simplificación de Radicales',
      mnemonicEn: 'Find the biggest perfect square hiding inside!',
      mnemonicEs: '¡Encuentra el cuadrado perfecto más grande escondido adentro!',
      steps: [
        {
          bodyEn: 'STEP 1: Find the **largest perfect square** that divides the radicand (the number under the radical). Perfect squares: 4, 9, 16, 25, 36, 49, 64, 81, 100...',
          bodyEs: 'PASO 1: Encuentra el **cuadrado perfecto más grande** que divide al radicando (el número bajo el radical). Cuadrados perfectos: 4, 9, 16, 25, 36, 49, 64, 81, 100...',
          workedExampleLatex: '\\sqrt{50} = \\sqrt{25 \\cdot 2}',
        },
        {
          bodyEn: 'STEP 2: Split the radical into a product of two radicals: the perfect square and what is left.',
          bodyEs: 'PASO 2: Separa el radical en un producto de dos radicales: el cuadrado perfecto y lo que queda.',
          workedExampleLatex: '\\sqrt{25 \\cdot 2} = \\sqrt{25} \\cdot \\sqrt{2}',
        },
        {
          bodyEn: 'STEP 3: Simplify the perfect-square radical. Your answer is fully simplified when the number left under the radical has **no perfect-square factors**.',
          bodyEs: 'PASO 3: Simplifica el radical del cuadrado perfecto. Tu respuesta está completamente simplificada cuando el número bajo el radical **no tiene factores que sean cuadrados perfectos**.',
          workedExampleLatex: '\\sqrt{25} \\cdot \\sqrt{2} = 5\\sqrt{2}',
          hintEn: 'If you can still divide the radicand by 4, 9, 16, 25... you are not done!',
          hintEs: 'Si todavía puedes dividir el radicando entre 4, 9, 16, 25... ¡no has terminado!',
        },
      ],
      skill: { slug: 'simplify-radicals', nameEn: 'Simplifying radicals', nameEs: 'Simplificar radicales' },
      generated: [
        { template: 'simplify_radical', tier: 'modified', count: 6 },
        { template: 'simplify_radical', tier: 'standard', count: 8 },
        { template: 'simplify_radical', tier: 'challenge', count: 6 },
      ],
      exitTicketSize: 4,
    },
    {
      code: '1.3',
      titleEn: 'Operations with Radicals',
      titleEs: 'Operaciones con Radicales',
      mnemonicEn: 'Like radicals combine like like terms: same radicand!',
      mnemonicEs: 'Los radicales semejantes se combinan como términos semejantes: ¡mismo radicando!',
      steps: [
        {
          bodyEn: 'To **add or subtract** radicals they must be **like radicals** — the same number under the radical. Combine the coefficients; the radical stays the same.',
          bodyEs: 'Para **sumar o restar** radicales deben ser **radicales semejantes** — el mismo número bajo el radical. Combina los coeficientes; el radical no cambia.',
          workedExampleLatex: '4\\sqrt{3} + 2\\sqrt{3} = 6\\sqrt{3}',
        },
        {
          bodyEn: 'To **multiply** radicals, multiply the radicands together under one radical, then simplify.',
          bodyEs: 'Para **multiplicar** radicales, multiplica los radicandos bajo un solo radical y luego simplifica.',
          workedExampleLatex: '\\sqrt{2} \\cdot \\sqrt{6} = \\sqrt{12} = 2\\sqrt{3}',
          hintEn: 'Always finish by checking: is the radical fully simplified?',
          hintEs: 'Siempre termina revisando: ¿está el radical completamente simplificado?',
        },
      ],
      skill: { slug: 'radical-operations', nameEn: 'Operations with radicals', nameEs: 'Operaciones con radicales' },
      generated: [
        { template: 'radical_add', tier: 'modified', count: 6 },
        { template: 'radical_add', tier: 'standard', count: 6 },
        { template: 'radical_multiply', tier: 'standard', count: 4 },
        { template: 'radical_multiply', tier: 'challenge', count: 6 },
      ],
      exitTicketSize: 5,
    },
    {
      code: '1.4',
      titleEn: 'Rational vs. Irrational',
      titleEs: 'Racional vs. Irracional',
      mnemonicEn: 'Rational = can be written as a RATIO (fraction).',
      mnemonicEs: 'Racional = se puede escribir como una RAZÓN (fracción).',
      steps: [
        {
          bodyEn: 'A **rational** number can be written as a fraction of two integers. That includes integers, fractions, terminating decimals, and repeating decimals.',
          bodyEs: 'Un número **racional** se puede escribir como una fracción de dos enteros. Eso incluye enteros, fracciones, decimales finitos y decimales periódicos.',
          workedExampleLatex: '-14,\\ \\tfrac{3}{7},\\ 0.75,\\ 0.\\overline{3}\\ \\text{are rational}',
        },
        {
          bodyEn: 'An **irrational** number cannot be written as a fraction: its decimal never ends and never repeats. Square roots of non-perfect squares and π are irrational.',
          bodyEs: 'Un número **irracional** no se puede escribir como fracción: su decimal nunca termina y nunca se repite. Las raíces cuadradas de números que no son cuadrados perfectos y π son irracionales.',
          workedExampleLatex: '\\sqrt{2},\\ \\pi,\\ 2\\pi\\ \\text{are irrational}',
          hintEn: '√16 = 4 is rational — always simplify the radical first!',
          hintEs: '√16 = 4 es racional — ¡siempre simplifica el radical primero!',
        },
      ],
      skill: { slug: 'rational-irrational', nameEn: 'Rational vs irrational', nameEs: 'Racional vs irracional' },
      generated: [
        { template: 'rational_irrational', tier: 'modified', count: 6 },
        { template: 'rational_irrational', tier: 'standard', count: 8 },
        { template: 'rational_irrational', tier: 'challenge', count: 4 },
      ],
      exitTicketSize: 4,
    },
    {
      code: '1.5',
      titleEn: 'Dimensional Analysis (Converting Measurements)',
      titleEs: 'Análisis Dimensional (Conversión de Medidas)',
      mnemonicEn: 'Set up the factor so the units CANCEL.',
      mnemonicEs: 'Escribe el factor para que las unidades se CANCELEN.',
      steps: [
        {
          bodyEn: 'STEP 1: Write the given unit as a fraction. Put the "given unit" in the numerator and "1" in the denominator.',
          bodyEs: 'PASO 1: Escribe la unidad dada como una fracción. Pon la "unidad dada" en el numerador y "1" en el denominador.',
          workedExampleLatex: '\\frac{10\\ \\text{miles}}{1}',
        },
        {
          bodyEn: 'STEP 2: Choose the conversion factor and set it up so the units cancel. You can find the conversion factor in the Algebra Regents Reference Table.',
          bodyEs: 'PASO 2: Elige el factor de conversión y colócalo de manera que las unidades se cancelen. Puedes encontrar el factor de conversión en la Tabla de Referencia de Regents de Álgebra.',
          workedExampleLatex: '\\frac{10\\ \\text{miles}}{1} \\times \\frac{1.609\\ \\text{km}}{1\\ \\text{mile}}',
          hintEn: 'The unit you want to get RID of goes on the bottom.',
          hintEs: 'La unidad de la que quieres DESHACERTE va abajo.',
        },
        {
          bodyEn: 'STEP 3: Multiply fractions (straight across). STEP 4: Divide.',
          bodyEs: 'PASO 3: Multiplica las fracciones (derecho). PASO 4: Divide.',
          workedExampleLatex: '10 \\times 1.609 = 16.09\\ \\text{km}',
        },
      ],
      skill: { slug: 'dimensional-analysis', nameEn: 'Dimensional analysis', nameEs: 'Análisis dimensional' },
      generated: [
        { template: 'dimensional_analysis', tier: 'modified', count: 6 },
        { template: 'dimensional_analysis', tier: 'standard', count: 8 },
        { template: 'dimensional_analysis', tier: 'challenge', count: 4 },
      ],
      exitTicketSize: 4,
    },
    {
      code: '1.6',
      titleEn: 'Properties of Real Numbers',
      titleEs: 'Propiedades de los Números Reales',
      mnemonicEn: 'Commutative = order changes. Associative = parentheses move.',
      mnemonicEs: 'Conmutativa = el orden cambia. Asociativa = los paréntesis se mueven.',
      steps: [
        {
          bodyEn: '**Commutative** — the order of the numbers change/numbers move. **Associative** — only the parentheses move; the numbers stay the same.',
          bodyEs: '**Conmutativa** — el orden de los números cambia/los números se mueven. **Asociativa** — solo los paréntesis se mueven; los números quedan igual.',
          workedExampleLatex: '2+5+6 = 6+5+2 \\quad\\text{vs}\\quad 56+(45+81) = (56+45)+81',
        },
        {
          bodyEn: '**Identity** — the "identity" of the number does not change (add 0, or multiply by 1). **Inverse** — means the opposite (add the opposite to get 0; multiply by the reciprocal to get 1).',
          bodyEs: '**Identidad** — la "identidad" del número no cambia (suma 0, o multiplica por 1). **Inverso** — significa lo opuesto (suma el opuesto para obtener 0; multiplica por el recíproco para obtener 1).',
          workedExampleLatex: '65+0=65, \\quad 45+(-45)=0, \\quad 45 \\cdot \\tfrac{1}{45} = 1',
        },
        {
          bodyEn: '**Distributive** — means to multiply: give the number out to each term inside the parentheses.',
          bodyEs: '**Distributiva** — significa multiplicar: dale el número a cada término dentro del paréntesis.',
          workedExampleLatex: '6(2a+3) = 12a+18',
          hintEn: 'Distributive = multiply through the parentheses.',
          hintEs: 'Distributiva = multiplicar a través del paréntesis.',
        },
      ],
      skill: { slug: 'properties-real-numbers', nameEn: 'Properties of real numbers', nameEs: 'Propiedades de los números reales' },
      fixedProblems: [
        {
          tier: 'modified',
          promptEn: 'Which property is shown? $7 + 3 = 3 + 7$ (commutative / associative / identity / inverse / distributive)',
          promptEs: '¿Qué propiedad se muestra? $7 + 3 = 3 + 7$ (commutative / associative / identity / inverse / distributive)',
          answerLatex: 'commutative',
          gradingMode: 'exact',
        },
        {
          tier: 'modified',
          promptEn: 'Which property is shown? $9 \\times 1 = 9$ (commutative / associative / identity / inverse / distributive)',
          promptEs: '¿Qué propiedad se muestra? $9 \\times 1 = 9$ (commutative / associative / identity / inverse / distributive)',
          answerLatex: 'identity',
          gradingMode: 'exact',
        },
        {
          tier: 'standard',
          promptEn: 'Which property is shown? $2+(5+6) = (2+5)+6$ (commutative / associative / identity / inverse / distributive)',
          promptEs: '¿Qué propiedad se muestra? $2+(5+6) = (2+5)+6$ (commutative / associative / identity / inverse / distributive)',
          answerLatex: 'associative',
          gradingMode: 'exact',
          steps: [
            {
              promptEn: 'Did the ORDER of the numbers change, or did only the parentheses move? (order/parentheses)',
              promptEs: '¿Cambió el ORDEN de los números o solo se movieron los paréntesis? (order/parentheses)',
              expectedLatex: 'parentheses',
              gradingMode: 'exact',
              hintEn: 'Associative — only the parentheses move; the numbers stay the same.',
              hintEs: 'Asociativa — solo los paréntesis se mueven; los números quedan igual.',
            },
          ],
        },
        {
          tier: 'standard',
          promptEn: 'Which property is shown? $45 + (-45) = 0$ (commutative / associative / identity / inverse / distributive)',
          promptEs: '¿Qué propiedad se muestra? $45 + (-45) = 0$ (commutative / associative / identity / inverse / distributive)',
          answerLatex: 'inverse',
          gradingMode: 'exact',
        },
        {
          tier: 'standard',
          promptEn: 'Which property is shown? $6(2a+3) = 12a+18$ (commutative / associative / identity / inverse / distributive)',
          promptEs: '¿Qué propiedad se muestra? $6(2a+3) = 12a+18$ (commutative / associative / identity / inverse / distributive)',
          answerLatex: 'distributive',
          gradingMode: 'exact',
        },
        {
          tier: 'challenge',
          promptEn: 'Fill in the blank so the statement shows the multiplicative inverse property: $45 \\cdot \\_\\_ = 1$',
          promptEs: 'Completa el espacio para que la ecuación muestre la propiedad del inverso multiplicativo: $45 \\cdot \\_\\_ = 1$',
          answerLatex: '1/45',
          gradingMode: 'equivalent',
        },
        {
          tier: 'challenge',
          promptEn: 'Which property is shown? $56 \\cdot (45 \\cdot 81) = (56 \\cdot 45) \\cdot 81$ (commutative / associative / identity / inverse / distributive)',
          promptEs: '¿Qué propiedad se muestra? $56 \\cdot (45 \\cdot 81) = (56 \\cdot 45) \\cdot 81$ (commutative / associative / identity / inverse / distributive)',
          answerLatex: 'associative',
          gradingMode: 'exact',
        },
      ],
      generated: [{ template: 'sprint_integer_ops', tier: 'standard', count: 12, sprint: true }],
      exitTicketSize: 4,
    },
  ],
};

export const unit2: UnitSeed = {
  number: 2,
  titleEn: 'Expressions & Polynomials',
  titleEs: 'Expresiones y Polinomios',
  lessons: [
    {
      code: '2.1',
      titleEn: 'Classifying & Evaluating Expressions',
      titleEs: 'Clasificación y Evaluación de Expresiones',
      mnemonicEn: 'First SUBSTITUTE, then SIMPLIFY (PEMDAS)!',
      mnemonicEs: '¡Primero SUSTITUYE, luego SIMPLIFICA (PEMDAS)!',
      steps: [
        {
          bodyEn: 'Polynomials are classified by their number of terms: **monomial** (1 term), **binomial** (2 terms), **trinomial** (3 terms). The **degree** is the highest exponent.',
          bodyEs: 'Los polinomios se clasifican por su número de términos: **monomio** (1 término), **binomio** (2 términos), **trinomio** (3 términos). El **grado** es el exponente más alto.',
          workedExampleLatex: '3x^2\\ \\text{(monomial)}, \\quad 2x+1\\ \\text{(binomial)}, \\quad x^2+2x-8\\ \\text{(trinomial)}',
        },
        {
          bodyEn: 'When evaluating expressions, first **SUBSTITUTE** then **SIMPLIFY**!!! STEP 1: Substitute — wherever you see an "x", replace it with the given number in parentheses.',
          bodyEs: 'Al evaluar expresiones, ¡primero **SUSTITUYE** y luego **SIMPLIFICA**! PASO 1: Sustituye — donde veas una "x", reemplázala con el número dado entre paréntesis.',
          workedExampleLatex: 'x^2+3x\\ \\text{at}\\ x=-4:\\quad (-4)^2 + 3(-4)',
          hintEn: 'Always put the substituted number in parentheses — it protects the sign!',
          hintEs: 'Siempre pon el número sustituido entre paréntesis — ¡protege el signo!',
        },
        {
          bodyEn: 'STEP 2: Simplify using **PEMDAS** — Parentheses, Exponents, Multiplication/Division, Addition/Subtraction.',
          bodyEs: 'PASO 2: Simplifica usando **PEMDAS** — Paréntesis, Exponentes, Multiplicación/División, Adición/Sustracción.',
          workedExampleLatex: '(-4)^2 + 3(-4) = 16 - 12 = 4',
        },
      ],
      skill: { slug: 'evaluate-expressions', nameEn: 'Evaluating expressions', nameEs: 'Evaluar expresiones' },
      fixedProblems: [
        {
          tier: 'modified',
          promptEn: 'Classify the polynomial by its number of terms: $4x^2$ (monomial / binomial / trinomial)',
          promptEs: 'Clasifica el polinomio por su número de términos: $4x^2$ (monomial / binomial / trinomial)',
          answerLatex: 'monomial',
          gradingMode: 'exact',
        },
        {
          tier: 'standard',
          promptEn: 'Classify the polynomial by its number of terms: $x^2 + 2x - 8$ (monomial / binomial / trinomial)',
          promptEs: 'Clasifica el polinomio por su número de términos: $x^2 + 2x - 8$ (monomial / binomial / trinomial)',
          answerLatex: 'trinomial',
          gradingMode: 'exact',
        },
        {
          tier: 'standard',
          promptEn: 'What is the **degree** of the polynomial $5x^3 - 2x + 7$?',
          promptEs: '¿Cuál es el **grado** del polinomio $5x^3 - 2x + 7$?',
          answerLatex: '3',
          gradingMode: 'exact',
        },
      ],
      generated: [
        { template: 'evaluate_expression', tier: 'modified', count: 5 },
        { template: 'evaluate_expression', tier: 'standard', count: 8 },
        { template: 'evaluate_expression', tier: 'challenge', count: 5 },
      ],
      exitTicketSize: 5,
    },
    {
      code: '2.2',
      titleEn: 'Simplifying Expressions & Standard Form',
      titleEs: 'Simplificación de Expresiones y Forma Estándar',
      mnemonicEn: 'Highest degree → lowest degree = STANDARD FORM.',
      mnemonicEs: 'Mayor grado → menor grado = FORMA ESTÁNDAR.',
      steps: [
        {
          bodyEn: 'STEP 1: **IDENTIFY and COMBINE the like-terms.** TIP: Use different shapes or colors when identifying the like-terms. Like terms have the same variable AND the same exponent.',
          bodyEs: 'PASO 1: **IDENTIFICA y COMBINA los términos semejantes.** CONSEJO: Usa diferentes formas o colores al identificar los términos semejantes. Los términos semejantes tienen la misma variable Y el mismo exponente.',
          workedExampleLatex: '2x+5-3y-5x^2-x+100-19y \\;\\to\\; (2x - x),\\ (-3y-19y),\\ (5+100)',
        },
        {
          bodyEn: 'STEP 2: **Write your answer in standard form.** HINT: Determine the degree of each term, then order from highest degree to lowest degree.',
          bodyEs: 'PASO 2: **Escribe tu respuesta en forma estándar.** PISTA: Determina el grado de cada término y ordena de mayor a menor grado.',
          workedExampleLatex: '-5x^2 + x - 22y + 105',
          hintEn: 'The term with the biggest exponent goes first.',
          hintEs: 'El término con el exponente más grande va primero.',
        },
        {
          bodyEn: 'Multi-step simplifying requires two steps: first use the **distributive property** to get rid of the parentheses, then **combine like-terms**.',
          bodyEs: 'La simplificación de varios pasos requiere dos pasos: primero usa la **propiedad distributiva** para eliminar los paréntesis y luego **combina los términos semejantes**.',
          workedExampleLatex: '7-2(x^2+3)-2x^2 = 7 - 2x^2 - 6 - 2x^2 = -4x^2 + 1',
        },
      ],
      skill: { slug: 'combine-like-terms', nameEn: 'Combining like terms & standard form', nameEs: 'Combinar términos semejantes y forma estándar' },
      generated: [
        { template: 'combine_like_terms', tier: 'modified', count: 5 },
        { template: 'combine_like_terms', tier: 'standard', count: 7 },
        { template: 'distribute_simplify', tier: 'standard', count: 5 },
        { template: 'distribute_simplify', tier: 'challenge', count: 6 },
      ],
      exitTicketSize: 5,
    },
    {
      code: '2.3',
      titleEn: 'Operations with Polynomials',
      titleEs: 'Operaciones con Polinomios',
      mnemonicEn: 'FOIL: First, Outer, Inner, Last!',
      mnemonicEs: 'FOIL: ¡Primeros, Externos, Internos, Últimos!',
      steps: [
        {
          bodyEn: '**Adding polynomials**: drop the parentheses and combine like terms. **Subtracting polynomials**: distribute the −1 to EVERY term of the second polynomial first — every sign flips.',
          bodyEs: '**Sumar polinomios**: quita los paréntesis y combina los términos semejantes. **Restar polinomios**: primero distribuye el −1 a CADA término del segundo polinomio — todos los signos cambian.',
          workedExampleLatex: '(3x^2+2x) - (x^2-5x) = 3x^2+2x-x^2+5x = 2x^2+7x',
        },
        {
          bodyEn: '**Monomial × Polynomial**: distribute the monomial to each term inside the parentheses. REMEMBER: multiply coefficients, ADD exponents that have the same variable.',
          bodyEs: '**Monomio × Polinomio**: distribuye el monomio a cada término dentro del paréntesis. RECUERDA: multiplica los coeficientes y SUMA los exponentes de la misma variable.',
          workedExampleLatex: '2x(3x+4) = 6x^2 + 8x',
        },
        {
          bodyEn: 'When we multiply two binomials, we want to **DISTRIBUTE 4 TIMES**. A fun and easy way to remember the order is the **FOIL method**: First, Outer, Inner, Last. Then combine like terms.',
          bodyEs: 'Cuando multiplicamos dos binomios, queremos **DISTRIBUIR 4 VECES**. Una manera fácil y divertida de recordar el orden es el **método FOIL**: Primeros, Externos, Internos, Últimos. Luego combina los términos semejantes.',
          workedExampleLatex: '(x+5)(x-6) = x^2 - 6x + 5x - 30 = x^2 - x - 30',
          hintEn: 'Squaring a binomial? Write the binomial TWICE, then FOIL.',
          hintEs: '¿Elevar un binomio al cuadrado? Escribe el binomio DOS VECES y luego FOIL.',
        },
        {
          bodyEn: 'Multiplying bigger polynomials: we cannot use FOIL unless it is two binomials — distribute EVERY term of the first to EVERY term of the second (6 times for binomial × trinomial), then combine like terms.',
          bodyEs: 'Para multiplicar polinomios más grandes: no podemos usar FOIL a menos que sean dos binomios — distribuye CADA término del primero a CADA término del segundo (6 veces para binomio × trinomio) y luego combina.',
          workedExampleLatex: '(x+2)(x^2-5x+4) = x^3-3x^2-6x+8',
        },
      ],
      skill: { slug: 'polynomial-operations', nameEn: 'Operations with polynomials', nameEs: 'Operaciones con polinomios' },
      generated: [
        { template: 'add_polynomials', tier: 'modified', count: 5 },
        { template: 'add_polynomials', tier: 'standard', count: 5 },
        { template: 'mono_times_poly', tier: 'standard', count: 4 },
        { template: 'foil', tier: 'standard', count: 6 },
        { template: 'foil', tier: 'challenge', count: 6 },
      ],
      exitTicketSize: 6,
    },
  ],
};

export const unit3: UnitSeed = {
  number: 3,
  titleEn: 'Equations & Inequalities',
  titleEs: 'Ecuaciones y Desigualdades',
  lessons: [
    {
      code: '3.1',
      titleEn: 'Solving Multi-Step Equations',
      titleEs: 'Resolución de Ecuaciones de Varios Pasos',
      mnemonicEn: 'Do I need to distribute? Do I need to combine like terms?',
      mnemonicEs: '¿Necesito distribuir? ¿Necesito combinar términos semejantes?',
      steps: [
        {
          bodyEn: '**BEFORE solving multi-step equations, ALWAYS ask yourself:** Do I need to distribute? Do I need to combine like-terms?',
          bodyEs: '**ANTES de resolver ecuaciones de varios pasos, SIEMPRE pregúntate:** ¿Necesito distribuir? ¿Necesito combinar términos semejantes?',
          workedExampleLatex: '3(x+2)+2x = 21',
        },
        {
          bodyEn: 'STEP 1: Distribute to clear the parentheses. STEP 2: Combine like terms on each side.',
          bodyEs: 'PASO 1: Distribuye para eliminar los paréntesis. PASO 2: Combina los términos semejantes en cada lado.',
          workedExampleLatex: '3x+6+2x = 21 \\;\\to\\; 5x+6 = 21',
        },
        {
          bodyEn: 'STEP 3: Use **inverse operations** to isolate the variable — undo addition/subtraction first, then undo multiplication/division.',
          bodyEs: 'PASO 3: Usa **operaciones inversas** para aislar la variable — primero deshaz la suma/resta, luego la multiplicación/división.',
          workedExampleLatex: '5x = 15 \\;\\to\\; x = 3',
          hintEn: 'Whatever you do to one side, do to the other!',
          hintEs: '¡Lo que hagas a un lado, hazlo al otro!',
        },
      ],
      skill: { slug: 'multi-step-equations', nameEn: 'Multi-step equations', nameEs: 'Ecuaciones de varios pasos' },
      generated: [
        { template: 'two_step_equation', tier: 'modified', count: 6 },
        { template: 'two_step_equation', tier: 'standard', count: 4 },
        { template: 'multi_step_equation', tier: 'standard', count: 6 },
        { template: 'multi_step_equation', tier: 'challenge', count: 6 },
        { template: 'sprint_one_step_equations', tier: 'standard', count: 12, sprint: true },
      ],
      exitTicketSize: 5,
    },
    {
      code: '3.2',
      titleEn: 'Variables on Both Sides & Literal Equations',
      titleEs: 'Variables en Ambos Lados y Ecuaciones Literales',
      mnemonicEn: 'Move the variables to ONE side with inverse operations.',
      mnemonicEs: 'Mueve las variables a UN solo lado con operaciones inversas.',
      steps: [
        {
          bodyEn: 'When we have variables on BOTH sides, we use inverse operations to move the variables to one side, then solve the remaining two-step equation.',
          bodyEs: 'Cuando hay variables en AMBOS lados, usamos operaciones inversas para mover las variables a un lado y luego resolvemos la ecuación de dos pasos que queda.',
          workedExampleLatex: '-6n-18 = 12+4n \\;\\to\\; -10n-18 = 12 \\;\\to\\; -10n = 30 \\;\\to\\; n = -3',
        },
        {
          bodyEn: '**Literal equations** are equations that consist of more than one variable. Solving literal equations means to isolate a specific variable using inverse operations — the steps are the same!',
          bodyEs: 'Las **ecuaciones literales** son ecuaciones que tienen más de una variable. Resolver ecuaciones literales significa aislar una variable específica usando operaciones inversas — ¡los pasos son los mismos!',
          workedExampleLatex: 'A = \\pi r^2 \\;\\to\\; r = \\sqrt{\\tfrac{A}{\\pi}}',
          hintEn: 'Treat the other letters like they were numbers.',
          hintEs: 'Trata las otras letras como si fueran números.',
        },
      ],
      skill: { slug: 'var-both-sides', nameEn: 'Equations with variables on both sides', nameEs: 'Ecuaciones con variables en ambos lados' },
      fixedProblems: [
        {
          tier: 'challenge',
          promptEn: 'The perimeter formula for a rectangle is $P = 2l + 2w$. Solve the equation for $w$.',
          promptEs: 'La fórmula del perímetro de un rectángulo es $P = 2l + 2w$. Resuelve la ecuación para $w$.',
          answerLatex: 'w = (P - 2l)/2',
          gradingMode: 'equivalent',
          steps: [
            {
              promptEn: 'STEP 1: Subtract $2l$ from both sides. Write the new equation.',
              promptEs: 'PASO 1: Resta $2l$ de ambos lados. Escribe la nueva ecuación.',
              expectedLatex: 'P - 2l = 2w',
              gradingMode: 'equivalent',
            },
            {
              promptEn: 'STEP 2: Divide both sides by 2 to isolate w. Write the answer as "w = ...".',
              promptEs: 'PASO 2: Divide ambos lados entre 2 para aislar w. Escribe la respuesta como "w = ...".',
              expectedLatex: 'w = (P - 2l)/2',
              gradingMode: 'equivalent',
            },
          ],
        },
        {
          tier: 'challenge',
          promptEn: 'Solve $d = rt$ for $t$.',
          promptEs: 'Resuelve $d = rt$ para $t$.',
          answerLatex: 't = d/r',
          gradingMode: 'equivalent',
        },
      ],
      generated: [
        { template: 'two_step_equation', tier: 'modified', count: 4 },
        { template: 'var_both_sides', tier: 'modified', count: 3 },
        { template: 'var_both_sides', tier: 'standard', count: 8 },
        { template: 'var_both_sides', tier: 'challenge', count: 4 },
      ],
      exitTicketSize: 5,
    },
    {
      code: '3.3',
      titleEn: 'Solving Inequalities',
      titleEs: 'Resolución de Desigualdades',
      mnemonicEn: 'Dividing by a NEGATIVE? FLIP the symbol!',
      mnemonicEs: '¿Divides entre un NEGATIVO? ¡VOLTEA el símbolo!',
      steps: [
        {
          bodyEn: 'The steps are the SAME as solving an equation. Use inverse operations to isolate the variable.',
          bodyEs: 'Los pasos son IGUALES que al resolver una ecuación. Usa operaciones inversas para aislar la variable.',
          workedExampleLatex: '12 - 5x > 72 \\;\\to\\; -5x > 60',
        },
        {
          bodyEn: 'If you are dividing or multiplying by a **negative number**, don\'t forget to **flip the inequality symbol**!',
          bodyEs: 'Si divides o multiplicas por un **número negativo**, ¡no olvides **voltear el símbolo de desigualdad**!',
          workedExampleLatex: '-5x > 60 \\;\\to\\; x < -12',
          hintEn: 'Negative divide/multiply = flip. Adding/subtracting never flips.',
          hintEs: 'Dividir/multiplicar por negativo = voltear. Sumar/restar nunca voltea.',
        },
        {
          bodyEn: 'Real-world keywords: **at least / no less than / a minimum of** → ≥. **At most / no more than / a maximum of** → ≤. **More than** → >. **Fewer than** → <.',
          bodyEs: 'Palabras clave del mundo real: **al menos / no menos que / un mínimo de** → ≥. **A lo más / no más de / un máximo de** → ≤. **Más que** → >. **Menos que** → <.',
          workedExampleLatex: '\\text{"at least 20"} \\to x \\ge 20',
        },
      ],
      skill: { slug: 'inequalities', nameEn: 'Solving inequalities', nameEs: 'Resolver desigualdades' },
      fixedProblems: [
        {
          tier: 'challenge',
          promptEn: 'Tickets cost $8 each. You have at most $50. Write an inequality for the number of tickets $t$ you can buy (like "8t <= 50").',
          promptEs: 'Los boletos cuestan $8 cada uno. Tienes a lo más $50. Escribe una desigualdad para el número de boletos $t$ que puedes comprar (como "8t <= 50").',
          answerLatex: '8t <= 50',
          gradingMode: 'exact',
        },
      ],
      generated: [
        { template: 'two_step_inequality', tier: 'modified', count: 5 },
        { template: 'two_step_inequality', tier: 'standard', count: 8 },
        { template: 'two_step_inequality', tier: 'challenge', count: 5 },
      ],
      exitTicketSize: 5,
    },
  ],
};
