/**
 * Regents Review catalog: topic-by-topic multiple-choice question banks in
 * the style of the NY Algebra I Regents exam. Each topic carries a
 * handwritten bank of four questions; a served round tops that up to
 * REGENTS_ROUND_SIZE with procedurally generated questions (regentsRandom.ts).
 * Each question has four answer choices, one correct index,
 * and a worked explanation shown after the (single) attempt. Prompts,
 * choices, and explanations use the same markdown-lite + $math$ format as
 * the rest of the content package.
 */

export interface RegentsQuestion {
  /** Stable id (used as the attempt key in the database) — never renumber. */
  id: string;
  promptEn: string;
  promptEs: string;
  choicesEn: string[];
  choicesEs: string[];
  correctIndex: number;
  explanationEn: string;
  explanationEs: string;
  /**
   * Optional stepanim hook: a skill slug + params understood by
   * buildScriptForProblem, powering a "watch it worked" animation of this
   * exact question. Because params can encode the solution, this is only
   * ever revealed to the client AFTER the student's single attempt.
   */
  anim?: { skillSlug: string; params: Record<string, number | string | boolean> };
}

export interface RegentsTopic {
  slug: string;
  icon: string;
  titleEn: string;
  titleEs: string;
  blurbEn: string;
  blurbEs: string;
  questions: RegentsQuestion[];
}

export const regentsTopics: RegentsTopic[] = [
  {
    slug: 'exponents-radicals',
    icon: '🧮',
    titleEn: 'Exponents & Radicals',
    titleEs: 'Exponentes y Radicales',
    blurbEn: 'Exponent rules, simplifying radicals, rational vs. irrational.',
    blurbEs: 'Reglas de exponentes, simplificar radicales, racional vs. irracional.',
    questions: [
      {
        id: 'exponents-radicals-q1',
        promptEn: 'Which expression is equivalent to $x^3 \\cdot x^5$?',
        promptEs: '¿Qué expresión es equivalente a $x^3 \\cdot x^5$?',
        choicesEn: ['$x^{15}$', '$x^8$', '$x^2$', '$2x^8$'],
        choicesEs: ['$x^{15}$', '$x^8$', '$x^2$', '$2x^8$'],
        correctIndex: 1,
        explanationEn:
          'When multiplying powers with the **same base**, ADD the exponents: $x^3 \\cdot x^5 = x^{3+5} = x^8$. Multiplying the exponents ($x^{15}$) is the rule for a power raised to a power, not a product.',
        explanationEs:
          'Al multiplicar potencias con la **misma base**, SUMA los exponentes: $x^3 \\cdot x^5 = x^{3+5} = x^8$. Multiplicar los exponentes ($x^{15}$) es la regla para una potencia elevada a otra potencia, no para un producto.',
      },
      {
        id: 'exponents-radicals-q2',
        promptEn: 'What is $\\sqrt{72}$ written in simplest radical form?',
        promptEs: '¿Cuál es $\\sqrt{72}$ escrito en su forma radical más simple?',
        choicesEn: ['$2\\sqrt{18}$', '$3\\sqrt{8}$', '$6\\sqrt{2}$', '$36\\sqrt{2}$'],
        choicesEs: ['$2\\sqrt{18}$', '$3\\sqrt{8}$', '$6\\sqrt{2}$', '$36\\sqrt{2}$'],
        correctIndex: 2,
        explanationEn:
          'Find the **largest perfect square** inside 72: $72 = 36 \\cdot 2$. Then $\\sqrt{72} = \\sqrt{36} \\cdot \\sqrt{2} = 6\\sqrt{2}$. Choices like $2\\sqrt{18}$ split out a smaller perfect square, so the radical is not fully simplified.',
        explanationEs:
          'Encuentra el **cuadrado perfecto más grande** dentro de 72: $72 = 36 \\cdot 2$. Entonces $\\sqrt{72} = \\sqrt{36} \\cdot \\sqrt{2} = 6\\sqrt{2}$. Opciones como $2\\sqrt{18}$ usan un cuadrado perfecto más pequeño, así que el radical no queda completamente simplificado.',
      },
      {
        id: 'exponents-radicals-q3',
        promptEn: 'Which expression is equivalent to $(2x^2)^3$?',
        promptEs: '¿Qué expresión es equivalente a $(2x^2)^3$?',
        choicesEn: ['$6x^6$', '$8x^6$', '$2x^6$', '$8x^5$'],
        choicesEs: ['$6x^6$', '$8x^6$', '$2x^6$', '$8x^5$'],
        correctIndex: 1,
        explanationEn:
          'The power applies to **everything** inside the parentheses: $(2x^2)^3 = 2^3 \\cdot (x^2)^3 = 8x^6$. Cube the coefficient ($2^3 = 8$) and multiply the exponents ($2 \\cdot 3 = 6$).',
        explanationEs:
          'La potencia se aplica a **todo** lo que está dentro del paréntesis: $(2x^2)^3 = 2^3 \\cdot (x^2)^3 = 8x^6$. Eleva al cubo el coeficiente ($2^3 = 8$) y multiplica los exponentes ($2 \\cdot 3 = 6$).',
      },
      {
        id: 'exponents-radicals-q4',
        promptEn: 'Which number is **irrational**?',
        promptEs: '¿Qué número es **irracional**?',
        choicesEn: ['$\\sqrt{49}$', '$0.25$', '$\\sqrt{10}$', '$\\tfrac{2}{3}$'],
        choicesEs: ['$\\sqrt{49}$', '$0.25$', '$\\sqrt{10}$', '$\\tfrac{2}{3}$'],
        correctIndex: 2,
        explanationEn:
          '10 is **not a perfect square**, so $\\sqrt{10}$ is a never-ending, never-repeating decimal — irrational. $\\sqrt{49} = 7$, $0.25 = \\tfrac{1}{4}$, and $\\tfrac{2}{3}$ can all be written as ratios of integers, so they are rational.',
        explanationEs:
          '10 **no es un cuadrado perfecto**, así que $\\sqrt{10}$ es un decimal infinito no periódico — irracional. $\\sqrt{49} = 7$, $0.25 = \\tfrac{1}{4}$ y $\\tfrac{2}{3}$ se pueden escribir como razones de enteros, por lo tanto son racionales.',
      },
    ],
  },
  {
    slug: 'linear-equations',
    icon: '⚖️',
    titleEn: 'Solving Linear Equations',
    titleEs: 'Resolver Ecuaciones Lineales',
    blurbEn: 'Multi-step equations: distribute, combine, and isolate x.',
    blurbEs: 'Ecuaciones de varios pasos: distribuir, combinar y despejar x.',
    questions: [
      {
        id: 'linear-equations-q1',
        promptEn: 'What is the solution of $3x + 7 = 22$?',
        promptEs: '¿Cuál es la solución de $3x + 7 = 22$?',
        choicesEn: ['$x = 3$', '$x = 5$', '$x = 7$', '$x = 15$'],
        choicesEs: ['$x = 3$', '$x = 5$', '$x = 7$', '$x = 15$'],
        correctIndex: 1,
        explanationEn:
          'Undo operations in reverse order. Subtract 7 from both sides: $3x = 15$. Then divide both sides by 3: $x = 5$. Check: $3(5) + 7 = 22$ ✓',
        explanationEs:
          'Deshaz las operaciones en orden inverso. Resta 7 en ambos lados: $3x = 15$. Luego divide ambos lados entre 3: $x = 5$. Comprueba: $3(5) + 7 = 22$ ✓',
      },
      {
        id: 'linear-equations-q2',
        promptEn: 'What is the solution of $4(x - 2) = 20$?',
        promptEs: '¿Cuál es la solución de $4(x - 2) = 20$?',
        choicesEn: ['$x = 3$', '$x = 4.5$', '$x = 5.5$', '$x = 7$'],
        choicesEs: ['$x = 3$', '$x = 4.5$', '$x = 5.5$', '$x = 7$'],
        correctIndex: 3,
        explanationEn:
          'Distribute first: $4x - 8 = 20$. Add 8 to both sides: $4x = 28$, so $x = 7$. (Getting $5.5$ usually means the 4 was only multiplied by $x$ and not by $-2$.)',
        explanationEs:
          'Primero distribuye: $4x - 8 = 20$. Suma 8 en ambos lados: $4x = 28$, así que $x = 7$. (Obtener $5.5$ normalmente significa que el 4 solo se multiplicó por $x$ y no por $-2$.)',
      },
      {
        id: 'linear-equations-q3',
        promptEn: 'Solve for $x$: $2x + 5 = 5x - 4$',
        promptEs: 'Resuelve para $x$: $2x + 5 = 5x - 4$',
        choicesEn: ['$x = -3$', '$x = \\tfrac{1}{3}$', '$x = 3$', '$x = 9$'],
        choicesEs: ['$x = -3$', '$x = \\tfrac{1}{3}$', '$x = 3$', '$x = 9$'],
        correctIndex: 2,
        explanationEn:
          'Collect the variables on one side: subtract $2x$ from both sides to get $5 = 3x - 4$. Add 4: $9 = 3x$. Divide by 3: $x = 3$. Check: $2(3)+5 = 11$ and $5(3)-4 = 11$ ✓',
        explanationEs:
          'Agrupa las variables en un lado: resta $2x$ en ambos lados para obtener $5 = 3x - 4$. Suma 4: $9 = 3x$. Divide entre 3: $x = 3$. Comprueba: $2(3)+5 = 11$ y $5(3)-4 = 11$ ✓',
      },
      {
        id: 'linear-equations-q4',
        promptEn: 'What is the solution of $\\tfrac{x}{3} - 2 = 4$?',
        promptEs: '¿Cuál es la solución de $\\tfrac{x}{3} - 2 = 4$?',
        choicesEn: ['$x = 2$', '$x = 6$', '$x = 12$', '$x = 18$'],
        choicesEs: ['$x = 2$', '$x = 6$', '$x = 12$', '$x = 18$'],
        correctIndex: 3,
        explanationEn:
          'Add 2 to both sides first: $\\tfrac{x}{3} = 6$. Then multiply both sides by 3: $x = 18$. (Answering $6$ means the last step — multiplying by 3 — was skipped.)',
        explanationEs:
          'Primero suma 2 en ambos lados: $\\tfrac{x}{3} = 6$. Luego multiplica ambos lados por 3: $x = 18$. (Responder $6$ significa que se saltó el último paso — multiplicar por 3.)',
      },
    ],
  },
  {
    slug: 'inequalities',
    icon: '🚦',
    titleEn: 'Inequalities',
    titleEs: 'Desigualdades',
    blurbEn: 'Solve and interpret inequalities — remember the flip!',
    blurbEs: 'Resuelve e interpreta desigualdades — ¡recuerda el cambio de sentido!',
    questions: [
      {
        id: 'inequalities-q1',
        promptEn: 'What is the solution of $-2x + 6 > 10$?',
        promptEs: '¿Cuál es la solución de $-2x + 6 > 10$?',
        choicesEn: ['$x < -2$', '$x > -2$', '$x < 2$', '$x > 2$'],
        choicesEs: ['$x < -2$', '$x > -2$', '$x < 2$', '$x > 2$'],
        correctIndex: 0,
        explanationEn:
          'Subtract 6: $-2x > 4$. Now divide by $-2$ — dividing by a **negative flips the inequality sign**: $x < -2$. Forgetting the flip gives $x > -2$, which is the trap answer.',
        explanationEs:
          'Resta 6: $-2x > 4$. Ahora divide entre $-2$ — dividir entre un **negativo invierte el signo de la desigualdad**: $x < -2$. Olvidar el cambio da $x > -2$, que es la respuesta trampa.',
      },
      {
        id: 'inequalities-q2',
        promptEn: 'Which value of $x$ is in the solution set of $3x - 1 \\ge 8$?',
        promptEs: '¿Qué valor de $x$ está en el conjunto solución de $3x - 1 \\ge 8$?',
        choicesEn: ['$0$', '$1$', '$2$', '$4$'],
        choicesEs: ['$0$', '$1$', '$2$', '$4$'],
        correctIndex: 3,
        explanationEn:
          'Solve it first: add 1 to get $3x \\ge 9$, then divide by 3 to get $x \\ge 3$. The only choice that is at least 3 is $4$. You can also test each choice: $3(4) - 1 = 11 \\ge 8$ ✓',
        explanationEs:
          'Primero resuélvela: suma 1 para obtener $3x \\ge 9$, luego divide entre 3: $x \\ge 3$. La única opción que es al menos 3 es $4$. También puedes probar cada opción: $3(4) - 1 = 11 \\ge 8$ ✓',
      },
      {
        id: 'inequalities-q3',
        promptEn: 'What is the solution of $5 - x \\le 9$?',
        promptEs: '¿Cuál es la solución de $5 - x \\le 9$?',
        choicesEn: ['$x \\ge -4$', '$x \\le -4$', '$x \\ge 4$', '$x \\le 4$'],
        choicesEs: ['$x \\ge -4$', '$x \\le -4$', '$x \\ge 4$', '$x \\le 4$'],
        correctIndex: 0,
        explanationEn:
          'Subtract 5: $-x \\le 4$. Multiply (or divide) both sides by $-1$ and **flip the sign**: $x \\ge -4$. Check with $x = 0$: $5 - 0 = 5 \\le 9$ ✓, and 0 is indeed $\\ge -4$.',
        explanationEs:
          'Resta 5: $-x \\le 4$. Multiplica (o divide) ambos lados por $-1$ e **invierte el signo**: $x \\ge -4$. Comprueba con $x = 0$: $5 - 0 = 5 \\le 9$ ✓, y 0 sí es $\\ge -4$.',
      },
      {
        id: 'inequalities-q4',
        promptEn:
          'A gym charges a $25 sign-up fee plus $4 per class. Jayden can spend at most $60. What is the **greatest** number of classes he can take, using $25 + 4c \\le 60$?',
        promptEs:
          'Un gimnasio cobra una cuota de inscripción de $25 más $4 por clase. Jayden puede gastar como máximo $60. ¿Cuál es el **mayor** número de clases que puede tomar, usando $25 + 4c \\le 60$?',
        choicesEn: ['$7$', '$8$', '$9$', '$35$'],
        choicesEs: ['$7$', '$8$', '$9$', '$35$'],
        correctIndex: 1,
        explanationEn:
          'Subtract 25: $4c \\le 35$. Divide by 4: $c \\le 8.75$. He cannot take a fraction of a class, so round **down** to the greatest whole number: $8$ classes ($25 + 4(8) = 57 \\le 60$ ✓).',
        explanationEs:
          'Resta 25: $4c \\le 35$. Divide entre 4: $c \\le 8.75$. No puede tomar una fracción de clase, así que redondea **hacia abajo** al mayor número entero: $8$ clases ($25 + 4(8) = 57 \\le 60$ ✓).',
      },
    ],
  },
  {
    slug: 'linear-functions',
    icon: '📈',
    titleEn: 'Linear Functions & Slope',
    titleEs: 'Funciones Lineales y Pendiente',
    blurbEn: 'Slope, y-intercepts, function notation, parallel lines.',
    blurbEs: 'Pendiente, interceptos en y, notación de funciones, rectas paralelas.',
    questions: [
      {
        id: 'linear-functions-q1',
        promptEn: 'What is the slope of the line that passes through $(2, 3)$ and $(6, 11)$?',
        promptEs: '¿Cuál es la pendiente de la recta que pasa por $(2, 3)$ y $(6, 11)$?',
        choicesEn: ['$\\tfrac{1}{2}$', '$2$', '$4$', '$8$'],
        choicesEs: ['$\\tfrac{1}{2}$', '$2$', '$4$', '$8$'],
        correctIndex: 1,
        explanationEn:
          'Slope is **rise over run**: $m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{11 - 3}{6 - 2} = \\frac{8}{4} = 2$. Getting $\\tfrac{1}{2}$ means the fraction was flipped (run over rise).',
        explanationEs:
          'La pendiente es **cambio en y sobre cambio en x**: $m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{11 - 3}{6 - 2} = \\frac{8}{4} = 2$. Obtener $\\tfrac{1}{2}$ significa que la fracción se invirtió.',
      },
      {
        id: 'linear-functions-q2',
        promptEn: 'For the line $y = -3x + 5$, what are the slope and the $y$-intercept?',
        promptEs: 'Para la recta $y = -3x + 5$, ¿cuáles son la pendiente y el intercepto en $y$?',
        choicesEn: [
          'slope $= 5$, $y$-intercept $= -3$',
          'slope $= -3$, $y$-intercept $= 5$',
          'slope $= 3$, $y$-intercept $= 5$',
          'slope $= -3$, $y$-intercept $= -5$',
        ],
        choicesEs: [
          'pendiente $= 5$, intercepto en $y = -3$',
          'pendiente $= -3$, intercepto en $y = 5$',
          'pendiente $= 3$, intercepto en $y = 5$',
          'pendiente $= -3$, intercepto en $y = -5$',
        ],
        correctIndex: 1,
        explanationEn:
          'In slope-intercept form $y = mx + b$, the coefficient of $x$ is the slope and the constant is the $y$-intercept. Here $m = -3$ (keep the negative sign!) and $b = 5$.',
        explanationEs:
          'En la forma pendiente-intercepto $y = mx + b$, el coeficiente de $x$ es la pendiente y la constante es el intercepto en $y$. Aquí $m = -3$ (¡conserva el signo negativo!) y $b = 5$.',
      },
      {
        id: 'linear-functions-q3',
        promptEn: 'Which equation represents the line **parallel** to $y = 2x - 1$ that passes through $(0, 4)$?',
        promptEs: '¿Qué ecuación representa la recta **paralela** a $y = 2x - 1$ que pasa por $(0, 4)$?',
        choicesEn: ['$y = 2x + 4$', '$y = -2x + 4$', '$y = -\\tfrac{1}{2}x + 4$', '$y = 2x - 4$'],
        choicesEs: ['$y = 2x + 4$', '$y = -2x + 4$', '$y = -\\tfrac{1}{2}x + 4$', '$y = 2x - 4$'],
        correctIndex: 0,
        explanationEn:
          'Parallel lines have the **same slope**, so keep $m = 2$. The point $(0, 4)$ is on the $y$-axis, so the $y$-intercept is 4: $y = 2x + 4$. ($-\\tfrac{1}{2}$ would be the slope of a *perpendicular* line.)',
        explanationEs:
          'Las rectas paralelas tienen la **misma pendiente**, así que conserva $m = 2$. El punto $(0, 4)$ está sobre el eje $y$, así que el intercepto en $y$ es 4: $y = 2x + 4$. ($-\\tfrac{1}{2}$ sería la pendiente de una recta *perpendicular*.)',
      },
      {
        id: 'linear-functions-q4',
        promptEn: 'If $f(x) = 4x - 9$, what is $f(-2)$?',
        promptEs: 'Si $f(x) = 4x - 9$, ¿cuál es $f(-2)$?',
        choicesEn: ['$-17$', '$-1$', '$1$', '$17$'],
        choicesEs: ['$-17$', '$-1$', '$1$', '$17$'],
        correctIndex: 0,
        explanationEn:
          'Substitute $-2$ for $x$: $f(-2) = 4(-2) - 9 = -8 - 9 = -17$. Watch the signs: a common error is $-8 + 9 = 1$.',
        explanationEs:
          'Sustituye $-2$ por $x$: $f(-2) = 4(-2) - 9 = -8 - 9 = -17$. Cuidado con los signos: un error común es $-8 + 9 = 1$.',
      },
    ],
  },
  {
    slug: 'systems',
    icon: '🔀',
    titleEn: 'Systems of Equations',
    titleEs: 'Sistemas de Ecuaciones',
    blurbEn: 'Substitution, elimination, and word-problem systems.',
    blurbEs: 'Sustitución, eliminación y sistemas en problemas verbales.',
    questions: [
      {
        id: 'systems-q1',
        promptEn: 'What is the solution of the system $y = x + 3$ and $y = 2x + 1$?',
        promptEs: '¿Cuál es la solución del sistema $y = x + 3$ y $y = 2x + 1$?',
        choicesEn: ['$(2, 5)$', '$(5, 2)$', '$(1, 4)$', '$(-2, 1)$'],
        choicesEs: ['$(2, 5)$', '$(5, 2)$', '$(1, 4)$', '$(-2, 1)$'],
        correctIndex: 0,
        explanationEn:
          'Both expressions equal $y$, so set them equal: $x + 3 = 2x + 1$. Subtract $x$: $3 = x + 1$, so $x = 2$. Then $y = 2 + 3 = 5$. The solution is the point $(2, 5)$ — it must work in **both** equations.',
        explanationEs:
          'Ambas expresiones son iguales a $y$, así que iguálalas: $x + 3 = 2x + 1$. Resta $x$: $3 = x + 1$, así que $x = 2$. Luego $y = 2 + 3 = 5$. La solución es el punto $(2, 5)$ — debe funcionar en **ambas** ecuaciones.',
      },
      {
        id: 'systems-q2',
        promptEn: 'What is the solution of the system $x + y = 10$ and $x - y = 4$?',
        promptEs: '¿Cuál es la solución del sistema $x + y = 10$ y $x - y = 4$?',
        choicesEn: ['$(3, 7)$', '$(7, 3)$', '$(6, 4)$', '$(5, 5)$'],
        choicesEs: ['$(3, 7)$', '$(7, 3)$', '$(6, 4)$', '$(5, 5)$'],
        correctIndex: 1,
        explanationEn:
          '**Elimination**: add the two equations — the $y$ terms cancel: $2x = 14$, so $x = 7$. Substitute back: $7 + y = 10$, so $y = 3$. Order matters: $(7, 3)$ means $x = 7$, $y = 3$.',
        explanationEs:
          '**Eliminación**: suma las dos ecuaciones — los términos $y$ se cancelan: $2x = 14$, así que $x = 7$. Sustituye: $7 + y = 10$, así que $y = 3$. El orden importa: $(7, 3)$ significa $x = 7$, $y = 3$.',
      },
      {
        id: 'systems-q3',
        promptEn:
          'Two burgers and a drink cost $13. One burger and the same drink cost $8. What is the cost of **one burger**?',
        promptEs:
          'Dos hamburguesas y una bebida cuestan $13. Una hamburguesa y la misma bebida cuestan $8. ¿Cuánto cuesta **una hamburguesa**?',
        choicesEn: ['$3', '$4', '$5', '$8'],
        choicesEs: ['$3', '$4', '$5', '$8'],
        correctIndex: 2,
        explanationEn:
          'Let $b$ = burger, $d$ = drink: $2b + d = 13$ and $b + d = 8$. Subtract the second equation from the first: $b = 5$. (Then the drink is $8 - 5 = 3$ — that is the trap answer.)',
        explanationEs:
          'Sea $b$ = hamburguesa, $d$ = bebida: $2b + d = 13$ y $b + d = 8$. Resta la segunda ecuación de la primera: $b = 5$. (Entonces la bebida cuesta $8 - 5 = 3$ — esa es la respuesta trampa.)',
      },
      {
        id: 'systems-q4',
        promptEn: 'How many solutions does the system $y = 3x + 2$ and $y = 3x - 5$ have?',
        promptEs: '¿Cuántas soluciones tiene el sistema $y = 3x + 2$ y $y = 3x - 5$?',
        choicesEn: ['none', 'exactly one', 'exactly two', 'infinitely many'],
        choicesEs: ['ninguna', 'exactamente una', 'exactamente dos', 'infinitas'],
        correctIndex: 0,
        explanationEn:
          'Both lines have slope 3 but **different** $y$-intercepts (2 and $-5$), so they are parallel lines that never intersect. No intersection point means **no solution**.',
        explanationEs:
          'Ambas rectas tienen pendiente 3 pero interceptos en $y$ **diferentes** (2 y $-5$), así que son rectas paralelas que nunca se cruzan. Sin punto de intersección, **no hay solución**.',
      },
    ],
  },
  {
    slug: 'polynomials',
    icon: '🧩',
    titleEn: 'Polynomials',
    titleEs: 'Polinomios',
    blurbEn: 'Add, subtract, multiply, and divide polynomial expressions.',
    blurbEs: 'Suma, resta, multiplica y divide expresiones polinomiales.',
    questions: [
      {
        id: 'polynomials-q1',
        promptEn: 'What is the sum of $3x^2 + 2x - 5$ and $x^2 - 4x + 1$?',
        promptEs: '¿Cuál es la suma de $3x^2 + 2x - 5$ y $x^2 - 4x + 1$?',
        choicesEn: ['$4x^2 - 2x - 4$', '$4x^2 + 2x - 4$', '$2x^2 - 2x - 6$', '$4x^2 - 6x - 4$'],
        choicesEs: ['$4x^2 - 2x - 4$', '$4x^2 + 2x - 4$', '$2x^2 - 2x - 6$', '$4x^2 - 6x - 4$'],
        correctIndex: 0,
        explanationEn:
          'Combine **like terms** by degree: $3x^2 + x^2 = 4x^2$; $2x + (-4x) = -2x$; $-5 + 1 = -4$. Result: $4x^2 - 2x - 4$.',
        explanationEs:
          'Combina **términos semejantes** por grado: $3x^2 + x^2 = 4x^2$; $2x + (-4x) = -2x$; $-5 + 1 = -4$. Resultado: $4x^2 - 2x - 4$.',
      },
      {
        id: 'polynomials-q2',
        promptEn: 'Which expression is equivalent to $(x + 4)(x - 2)$?',
        promptEs: '¿Qué expresión es equivalente a $(x + 4)(x - 2)$?',
        choicesEn: ['$x^2 - 8$', '$x^2 + 2x - 8$', '$x^2 - 2x - 8$', '$x^2 + 6x - 8$'],
        choicesEs: ['$x^2 - 8$', '$x^2 + 2x - 8$', '$x^2 - 2x - 8$', '$x^2 + 6x - 8$'],
        correctIndex: 1,
        explanationEn:
          'Use FOIL (double distribution): $x \\cdot x + x(-2) + 4x + 4(-2) = x^2 - 2x + 4x - 8 = x^2 + 2x - 8$. Forgetting the middle terms gives $x^2 - 8$, the trap answer.',
        explanationEs:
          'Usa doble distribución (FOIL): $x \\cdot x + x(-2) + 4x + 4(-2) = x^2 - 2x + 4x - 8 = x^2 + 2x - 8$. Olvidar los términos del medio da $x^2 - 8$, la respuesta trampa.',
      },
      {
        id: 'polynomials-q3',
        promptEn: 'Which expression is equivalent to $(2x - 3)^2$?',
        promptEs: '¿Qué expresión es equivalente a $(2x - 3)^2$?',
        choicesEn: ['$4x^2 + 9$', '$4x^2 - 9$', '$4x^2 - 12x + 9$', '$4x^2 - 6x + 9$'],
        choicesEs: ['$4x^2 + 9$', '$4x^2 - 9$', '$4x^2 - 12x + 9$', '$4x^2 - 6x + 9$'],
        correctIndex: 2,
        explanationEn:
          'Squaring a binomial means multiplying it by itself: $(2x-3)(2x-3) = 4x^2 - 6x - 6x + 9 = 4x^2 - 12x + 9$. Squaring each term separately ($4x^2 - 9$ or $4x^2 + 9$) skips the middle term.',
        explanationEs:
          'Elevar un binomio al cuadrado significa multiplicarlo por sí mismo: $(2x-3)(2x-3) = 4x^2 - 6x - 6x + 9 = 4x^2 - 12x + 9$. Elevar cada término por separado ($4x^2 - 9$ o $4x^2 + 9$) omite el término del medio.',
      },
      {
        id: 'polynomials-q4',
        promptEn: 'What is the quotient of $\\frac{6x^3 + 9x^2}{3x}$, where $x \\ne 0$?',
        promptEs: '¿Cuál es el cociente de $\\frac{6x^3 + 9x^2}{3x}$, donde $x \\ne 0$?',
        choicesEn: ['$2x^2 + 3x$', '$2x^2 + 9x$', '$3x^2 + 3x$', '$2x + 3$'],
        choicesEs: ['$2x^2 + 3x$', '$2x^2 + 9x$', '$3x^2 + 3x$', '$2x + 3$'],
        correctIndex: 0,
        explanationEn:
          'Divide **each term** by $3x$: $\\frac{6x^3}{3x} = 2x^2$ and $\\frac{9x^2}{3x} = 3x$. So the quotient is $2x^2 + 3x$ (divide the coefficients, subtract the exponents).',
        explanationEs:
          'Divide **cada término** entre $3x$: $\\frac{6x^3}{3x} = 2x^2$ y $\\frac{9x^2}{3x} = 3x$. El cociente es $2x^2 + 3x$ (divide los coeficientes, resta los exponentes).',
      },
    ],
  },
  {
    slug: 'factoring',
    icon: '🔨',
    titleEn: 'Factoring',
    titleEs: 'Factorización',
    blurbEn: 'GCF, trinomials, difference of squares, factoring completely.',
    blurbEs: 'MCD, trinomios, diferencia de cuadrados, factorizar por completo.',
    questions: [
      {
        id: 'factoring-q1',
        promptEn: 'Which is the factored form of $x^2 + 7x + 12$?',
        promptEs: '¿Cuál es la forma factorizada de $x^2 + 7x + 12$?',
        choicesEn: ['$(x + 2)(x + 6)$', '$(x + 3)(x + 4)$', '$(x + 1)(x + 12)$', '$(x - 3)(x - 4)$'],
        choicesEs: ['$(x + 2)(x + 6)$', '$(x + 3)(x + 4)$', '$(x + 1)(x + 12)$', '$(x - 3)(x - 4)$'],
        correctIndex: 1,
        explanationEn:
          'Find two numbers that **multiply to 12** and **add to 7**: $3 \\cdot 4 = 12$ and $3 + 4 = 7$. So $x^2 + 7x + 12 = (x + 3)(x + 4)$. ($2 + 6 = 8$ and $1 + 12 = 13$ have the right product but the wrong sum.)',
        explanationEs:
          'Busca dos números que **multiplicados den 12** y **sumados den 7**: $3 \\cdot 4 = 12$ y $3 + 4 = 7$. Así $x^2 + 7x + 12 = (x + 3)(x + 4)$. ($2 + 6 = 8$ y $1 + 12 = 13$ tienen el producto correcto pero la suma incorrecta.)',
      },
      {
        id: 'factoring-q2',
        promptEn: 'Which is the factored form of $x^2 - 25$?',
        promptEs: '¿Cuál es la forma factorizada de $x^2 - 25$?',
        choicesEn: ['$(x - 5)^2$', '$(x + 5)^2$', '$(x + 5)(x - 5)$', 'It cannot be factored'],
        choicesEs: ['$(x - 5)^2$', '$(x + 5)^2$', '$(x + 5)(x - 5)$', 'No se puede factorizar'],
        correctIndex: 2,
        explanationEn:
          'This is a **difference of two squares**: $a^2 - b^2 = (a + b)(a - b)$. Here $a = x$, $b = 5$, so $x^2 - 25 = (x + 5)(x - 5)$. Note $(x - 5)^2 = x^2 - 10x + 25$, which has a middle term.',
        explanationEs:
          'Esta es una **diferencia de cuadrados**: $a^2 - b^2 = (a + b)(a - b)$. Aquí $a = x$, $b = 5$, así que $x^2 - 25 = (x + 5)(x - 5)$. Nota que $(x - 5)^2 = x^2 - 10x + 25$, que tiene término del medio.',
      },
      {
        id: 'factoring-q3',
        promptEn: 'What is $12x^3 + 8x^2$ with its **greatest common factor** factored out?',
        promptEs: '¿Cómo queda $12x^3 + 8x^2$ al sacar su **máximo factor común**?',
        choicesEn: ['$4x^2(3x + 2)$', '$4x(3x^2 + 2x)$', '$2x^2(6x + 4)$', '$x^2(12x + 8)$'],
        choicesEs: ['$4x^2(3x + 2)$', '$4x(3x^2 + 2x)$', '$2x^2(6x + 4)$', '$x^2(12x + 8)$'],
        correctIndex: 0,
        explanationEn:
          'The GCF of 12 and 8 is **4**; the GCF of $x^3$ and $x^2$ is $x^2$. Pull out $4x^2$: $12x^3 + 8x^2 = 4x^2(3x + 2)$. The other choices factor something out, but not the *greatest* common factor.',
        explanationEs:
          'El MCD de 12 y 8 es **4**; el MCD de $x^3$ y $x^2$ es $x^2$. Saca $4x^2$: $12x^3 + 8x^2 = 4x^2(3x + 2)$. Las otras opciones sacan un factor, pero no el factor común *máximo*.',
      },
      {
        id: 'factoring-q4',
        promptEn: 'Which is the **completely** factored form of $2x^2 - 8$?',
        promptEs: '¿Cuál es la forma **completamente** factorizada de $2x^2 - 8$?',
        choicesEn: ['$2(x^2 - 4)$', '$(2x + 4)(x - 2)$', '$2(x + 2)(x - 2)$', '$(x + 4)(x - 2)$'],
        choicesEs: ['$2(x^2 - 4)$', '$(2x + 4)(x - 2)$', '$2(x + 2)(x - 2)$', '$(x + 4)(x - 2)$'],
        correctIndex: 2,
        explanationEn:
          'First factor out the GCF: $2(x^2 - 4)$. But $x^2 - 4$ is a difference of squares, so keep going: $2(x + 2)(x - 2)$. "Completely factored" means **no factor can be factored further**.',
        explanationEs:
          'Primero saca el MCD: $2(x^2 - 4)$. Pero $x^2 - 4$ es una diferencia de cuadrados, así que continúa: $2(x + 2)(x - 2)$. "Completamente factorizado" significa que **ningún factor se puede factorizar más**.',
      },
    ],
  },
  {
    slug: 'quadratics',
    icon: '🎯',
    titleEn: 'Quadratic Equations',
    titleEs: 'Ecuaciones Cuadráticas',
    blurbEn: 'Roots, vertex, axis of symmetry, and square-root solutions.',
    blurbEs: 'Raíces, vértice, eje de simetría y soluciones con raíz cuadrada.',
    questions: [
      {
        id: 'quadratics-q1',
        promptEn: 'What are the roots of $x^2 - 5x + 6 = 0$?',
        promptEs: '¿Cuáles son las raíces de $x^2 - 5x + 6 = 0$?',
        choicesEn: ['$x = 2$ and $x = 3$', '$x = -2$ and $x = -3$', '$x = 1$ and $x = 6$', '$x = -1$ and $x = -6$'],
        choicesEs: ['$x = 2$ y $x = 3$', '$x = -2$ y $x = -3$', '$x = 1$ y $x = 6$', '$x = -1$ y $x = -6$'],
        correctIndex: 0,
        explanationEn:
          'Factor: two numbers that multiply to $+6$ and add to $-5$ are $-2$ and $-3$, so $(x - 2)(x - 3) = 0$. The zero-product property gives $x = 2$ or $x = 3$ (the roots have the **opposite** sign of the factors).',
        explanationEs:
          'Factoriza: dos números que multiplicados den $+6$ y sumados den $-5$ son $-2$ y $-3$, así que $(x - 2)(x - 3) = 0$. La propiedad del producto cero da $x = 2$ o $x = 3$ (las raíces tienen el signo **opuesto** al de los factores).',
      },
      {
        id: 'quadratics-q2',
        promptEn: 'What is the solution set of $x^2 = 49$?',
        promptEs: '¿Cuál es el conjunto solución de $x^2 = 49$?',
        choicesEn: ['$\\{7\\}$', '$\\{-7\\}$', '$\\{-7, 7\\}$', '$\\{24.5\\}$'],
        choicesEs: ['$\\{7\\}$', '$\\{-7\\}$', '$\\{-7, 7\\}$', '$\\{24.5\\}$'],
        correctIndex: 2,
        explanationEn:
          'Take the square root of **both** sides — and remember a positive number has **two** square roots: $x = \\pm\\sqrt{49} = \\pm 7$. Both work: $7^2 = 49$ and $(-7)^2 = 49$.',
        explanationEs:
          'Saca la raíz cuadrada de **ambos** lados — y recuerda que un número positivo tiene **dos** raíces cuadradas: $x = \\pm\\sqrt{49} = \\pm 7$. Ambas funcionan: $7^2 = 49$ y $(-7)^2 = 49$.',
      },
      {
        id: 'quadratics-q3',
        promptEn: 'What is the equation of the **axis of symmetry** of the parabola $y = x^2 - 6x + 8$?',
        promptEs: '¿Cuál es la ecuación del **eje de simetría** de la parábola $y = x^2 - 6x + 8$?',
        choicesEn: ['$x = 3$', '$x = -3$', '$x = 6$', '$x = -6$'],
        choicesEs: ['$x = 3$', '$x = -3$', '$x = 6$', '$x = -6$'],
        correctIndex: 0,
        explanationEn:
          'The axis of symmetry is $x = \\frac{-b}{2a}$. Here $a = 1$ and $b = -6$: $x = \\frac{-(-6)}{2(1)} = \\frac{6}{2} = 3$. Watch the signs — dropping the negative in the formula gives $x = -3$.',
        explanationEs:
          'El eje de simetría es $x = \\frac{-b}{2a}$. Aquí $a = 1$ y $b = -6$: $x = \\frac{-(-6)}{2(1)} = \\frac{6}{2} = 3$. Cuidado con los signos — omitir el negativo de la fórmula da $x = -3$.',
      },
      {
        id: 'quadratics-q4',
        promptEn: 'What is the **vertex** of the parabola $y = (x - 2)^2 + 5$?',
        promptEs: '¿Cuál es el **vértice** de la parábola $y = (x - 2)^2 + 5$?',
        choicesEn: ['$(2, 5)$', '$(-2, 5)$', '$(2, -5)$', '$(-2, -5)$'],
        choicesEs: ['$(2, 5)$', '$(-2, 5)$', '$(2, -5)$', '$(-2, -5)$'],
        correctIndex: 0,
        explanationEn:
          'Vertex form is $y = (x - h)^2 + k$ with vertex $(h, k)$. Matching $(x - 2)^2 + 5$ gives $h = 2$ (note: **opposite** sign of what appears inside) and $k = 5$, so the vertex is $(2, 5)$.',
        explanationEs:
          'La forma de vértice es $y = (x - h)^2 + k$ con vértice $(h, k)$. Comparando con $(x - 2)^2 + 5$, $h = 2$ (nota: signo **opuesto** al que aparece adentro) y $k = 5$, así que el vértice es $(2, 5)$.',
      },
    ],
  },
  {
    slug: 'exponential-functions',
    icon: '🚀',
    titleEn: 'Exponential Functions',
    titleEs: 'Funciones Exponenciales',
    blurbEn: 'Growth vs. decay, growth factors, and evaluating exponentials.',
    blurbEs: 'Crecimiento vs. decaimiento, factores de crecimiento y evaluación.',
    questions: [
      {
        id: 'exponential-functions-q1',
        promptEn:
          'The value of a collectible is modeled by $A(t) = 500(1.06)^t$, where $t$ is in years. What does $1.06$ represent?',
        promptEs:
          'El valor de un objeto de colección se modela con $A(t) = 500(1.06)^t$, donde $t$ está en años. ¿Qué representa $1.06$?',
        choicesEn: [
          'The value grows by 6% each year',
          'The value decays by 6% each year',
          'The value grows by 106% each year',
          'The starting value is $1.06',
        ],
        choicesEs: [
          'El valor crece 6% cada año',
          'El valor decae 6% cada año',
          'El valor crece 106% cada año',
          'El valor inicial es $1.06',
        ],
        correctIndex: 0,
        explanationEn:
          'In $A(t) = a(b)^t$, $b$ is the **growth factor**: $b = 1 + r$. Here $1.06 = 1 + 0.06$, so the rate is $r = 0.06 = 6\\%$ growth per year. The starting value is $a = 500$.',
        explanationEs:
          'En $A(t) = a(b)^t$, $b$ es el **factor de crecimiento**: $b = 1 + r$. Aquí $1.06 = 1 + 0.06$, así que la tasa es $r = 0.06 = 6\\%$ de crecimiento anual. El valor inicial es $a = 500$.',
      },
      {
        id: 'exponential-functions-q2',
        promptEn: 'Which function represents exponential **decay**?',
        promptEs: '¿Qué función representa **decaimiento** exponencial?',
        choicesEn: ['$y = 100(0.9)^x$', '$y = 0.5(3)^x$', '$y = 100(1.9)^x$', '$y = 9(1.09)^x$'],
        choicesEs: ['$y = 100(0.9)^x$', '$y = 0.5(3)^x$', '$y = 100(1.9)^x$', '$y = 9(1.09)^x$'],
        correctIndex: 0,
        explanationEn:
          'Look at the **base** (growth factor), not the front coefficient. Decay means the base is between 0 and 1: only $0.9 < 1$ qualifies. $y = 0.5(3)^x$ starts small but **grows**, because its base is 3.',
        explanationEs:
          'Mira la **base** (factor de crecimiento), no el coeficiente del frente. Decaimiento significa que la base está entre 0 y 1: solo $0.9 < 1$ cumple. $y = 0.5(3)^x$ empieza pequeña pero **crece**, porque su base es 3.',
      },
      {
        id: 'exponential-functions-q3',
        promptEn: 'If $f(x) = 2^x$, what is $f(5)$?',
        promptEs: 'Si $f(x) = 2^x$, ¿cuál es $f(5)$?',
        choicesEn: ['$10$', '$25$', '$32$', '$64$'],
        choicesEs: ['$10$', '$25$', '$32$', '$64$'],
        correctIndex: 2,
        explanationEn:
          '$f(5) = 2^5 = 2 \\cdot 2 \\cdot 2 \\cdot 2 \\cdot 2 = 32$. The exponent counts how many times to multiply the base by itself — it is **not** $2 \\times 5 = 10$ and not $5^2 = 25$.',
        explanationEs:
          '$f(5) = 2^5 = 2 \\cdot 2 \\cdot 2 \\cdot 2 \\cdot 2 = 32$. El exponente indica cuántas veces multiplicar la base por sí misma — **no** es $2 \\times 5 = 10$ ni $5^2 = 25$.',
      },
      {
        id: 'exponential-functions-q4',
        promptEn:
          '$300 is invested in an account that grows 4% per year. Which equation models the value $y$ after $t$ years?',
        promptEs:
          'Se invierten $300 en una cuenta que crece 4% al año. ¿Qué ecuación modela el valor $y$ después de $t$ años?',
        choicesEn: ['$y = 300(1.4)^t$', '$y = 300(1.04)^t$', '$y = 300(0.04)^t$', '$y = 300 + 1.04t$'],
        choicesEs: ['$y = 300(1.4)^t$', '$y = 300(1.04)^t$', '$y = 300(0.04)^t$', '$y = 300 + 1.04t$'],
        correctIndex: 1,
        explanationEn:
          'Growth of 4% means the factor is $1 + 0.04 = 1.04$: $y = 300(1.04)^t$. $1.4$ would be 40% growth, $0.04$ would shrink the value almost to zero, and $300 + 1.04t$ is linear, not exponential.',
        explanationEs:
          'Un crecimiento de 4% significa que el factor es $1 + 0.04 = 1.04$: $y = 300(1.04)^t$. $1.4$ sería 40% de crecimiento, $0.04$ reduciría el valor casi a cero, y $300 + 1.04t$ es lineal, no exponencial.',
      },
    ],
  },
  {
    slug: 'statistics',
    icon: '📊',
    titleEn: 'Statistics & Data',
    titleEs: 'Estadística y Datos',
    blurbEn: 'Mean, median, correlation, and the effect of outliers.',
    blurbEs: 'Media, mediana, correlación y el efecto de valores atípicos.',
    questions: [
      {
        id: 'statistics-q1',
        promptEn: 'What is the **mean** of the data set $4, 8, 6, 10, 7$?',
        promptEs: '¿Cuál es la **media** del conjunto de datos $4, 8, 6, 10, 7$?',
        choicesEn: ['$6$', '$7$', '$8$', '$35$'],
        choicesEs: ['$6$', '$7$', '$8$', '$35$'],
        correctIndex: 1,
        explanationEn:
          'Mean = sum ÷ count: $\\frac{4 + 8 + 6 + 10 + 7}{5} = \\frac{35}{5} = 7$. ($35$ is just the sum — remember to divide by how many values there are.)',
        explanationEs:
          'Media = suma ÷ cantidad: $\\frac{4 + 8 + 6 + 10 + 7}{5} = \\frac{35}{5} = 7$. ($35$ es solo la suma — recuerda dividir entre la cantidad de valores.)',
      },
      {
        id: 'statistics-q2',
        promptEn: 'What is the **median** of the data set $2, 4, 4, 5, 7, 9$?',
        promptEs: '¿Cuál es la **mediana** del conjunto de datos $2, 4, 4, 5, 7, 9$?',
        choicesEn: ['$4$', '$4.5$', '$5$', '$6$'],
        choicesEs: ['$4$', '$4.5$', '$5$', '$6$'],
        correctIndex: 1,
        explanationEn:
          'The data is already in order, and there is an **even** number of values (6), so the median is the average of the two middle ones: $\\frac{4 + 5}{2} = 4.5$.',
        explanationEs:
          'Los datos ya están en orden y hay una cantidad **par** de valores (6), así que la mediana es el promedio de los dos del medio: $\\frac{4 + 5}{2} = 4.5$.',
      },
      {
        id: 'statistics-q3',
        promptEn:
          'A study of hours studied vs. test scores has a correlation coefficient of $r = 0.9$. Which best describes the relationship?',
        promptEs:
          'Un estudio de horas de estudio vs. calificaciones tiene un coeficiente de correlación $r = 0.9$. ¿Cuál describe mejor la relación?',
        choicesEn: [
          'strong positive correlation',
          'weak positive correlation',
          'strong negative correlation',
          'no correlation',
        ],
        choicesEs: [
          'correlación positiva fuerte',
          'correlación positiva débil',
          'correlación negativa fuerte',
          'sin correlación',
        ],
        correctIndex: 0,
        explanationEn:
          '$r$ runs from $-1$ to $1$. The **sign** gives the direction (positive: both increase together) and the **closeness to 1** gives the strength. $0.9$ is close to 1, so: strong positive.',
        explanationEs:
          '$r$ va de $-1$ a $1$. El **signo** da la dirección (positiva: ambas aumentan juntas) y la **cercanía a 1** da la fuerza. $0.9$ está cerca de 1, así que: positiva fuerte.',
      },
      {
        id: 'statistics-q4',
        promptEn:
          'A very large value is added to a data set. Which measure of central tendency is affected the **most**?',
        promptEs:
          'Se agrega un valor muy grande a un conjunto de datos. ¿Qué medida de tendencia central se ve **más** afectada?',
        choicesEn: ['the mean', 'the median', 'the mode', 'they are all equally affected'],
        choicesEs: ['la media', 'la mediana', 'la moda', 'todas se afectan por igual'],
        correctIndex: 0,
        explanationEn:
          'The **mean** uses every value in its calculation, so one huge outlier drags it upward. The median only depends on the middle position and the mode on the most frequent value — both barely move.',
        explanationEs:
          'La **media** usa todos los valores en su cálculo, así que un valor atípico enorme la arrastra hacia arriba. La mediana solo depende de la posición central y la moda del valor más frecuente — casi no cambian.',
      },
    ],
  },
];

/** Fast lookup used by the API: question id → its topic + question. */
export const regentsQuestionIndex: ReadonlyMap<
  string,
  { topic: RegentsTopic; question: RegentsQuestion }
> = new Map(
  regentsTopics.flatMap((topic) => topic.questions.map((q) => [q.id, { topic, question: q }])),
);
