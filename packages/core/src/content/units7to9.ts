import type { UnitSeed } from './types.js';

export const unit7: UnitSeed = {
  number: 7,
  titleEn: 'Factoring',
  titleEs: 'Factorización',
  lessons: [
    {
      code: '7.1',
      titleEn: 'GCF & Factoring by GCF',
      titleEs: 'MCD y Factorización por MCD',
      mnemonicEn: 'Divide coefficients, SUBTRACT exponents.',
      mnemonicEs: 'Divide los coeficientes, RESTA los exponentes.',
      steps: [
        {
          bodyEn: 'How can we find the GCF of monomials? STEP 1: Find the GCF of the coefficients. STEP 2: Determine the greatest number of the **same variables** they have in common.',
          bodyEs: '¿Cómo encontramos el MCD de monomios? PASO 1: Encuentra el MCD de los coeficientes. PASO 2: Determina la mayor cantidad de las **mismas variables** que tienen en común.',
          workedExampleLatex: '\\text{GCF of } 6x^2 \\text{ and } 9x^3 = 3x^2',
        },
        {
          bodyEn: 'How do I factor a polynomial? STEP 1: Find the GCF of each term. STEP 2: Divide each term by that GCF. HINT 1: Divide the coefficients. HINT 2: Subtract the exponents.',
          bodyEs: '¿Cómo factorizo un polinomio? PASO 1: Encuentra el MCD de cada término. PASO 2: Divide cada término entre ese MCD. PISTA 1: Divide los coeficientes. PISTA 2: Resta los exponentes.',
          workedExampleLatex: '12x^4-6x^3+3x^2 = 3x^2(4x^2-2x+1)',
        },
        {
          bodyEn: 'CHECK YOUR WORK (optional): distribute the GCF to each term in the parentheses to check that you end up with the original polynomial.',
          bodyEs: 'VERIFICA TU TRABAJO (opcional): distribuye el MCD a cada término del paréntesis para comprobar que obtienes el polinomio original.',
          hintEn: 'Factoring and distributing are opposites!',
          hintEs: '¡Factorizar y distribuir son opuestos!',
        },
      ],
      skill: { slug: 'factor-gcf', nameEn: 'Factoring with GCF', nameEs: 'Factorización con MCD' },
      generated: [
        { template: 'gcf_monomials', tier: 'modified', count: 5 },
        { template: 'gcf_monomials', tier: 'standard', count: 4 },
        { template: 'factor_gcf', tier: 'standard', count: 7 },
        { template: 'factor_gcf', tier: 'challenge', count: 5 },
      ],
      exitTicketSize: 5,
    },
    {
      code: '7.2',
      titleEn: 'Factoring Trinomials & DOTS',
      titleEs: 'Factorización de Trinomios y DOTS',
      mnemonicEn: 'What MULTIPLIES to "c" and ADDS to "b"?',
      mnemonicEs: '¿Qué se MULTIPLICA para dar "c" y se SUMA para dar "b"?',
      steps: [
        {
          bodyEn: 'To factor $x^2+bx+c$: 1) Identify the a-value, b-value, c-value. 2) List the **factors** of "c", then ask yourself: what **multiplies** to "c" and **adds** to "b"? 3) Set up your binomial factors with those two integers.',
          bodyEs: 'Para factorizar $x^2+bx+c$: 1) Identifica el valor de a, b y c. 2) Enumera los **factores** de "c" y pregúntate: ¿qué se **multiplica** para dar "c" y se **suma** para dar "b"? 3) Escribe tus factores binomiales con esos dos enteros.',
          workedExampleLatex: 'x^2-7x-30 = (x-10)(x+3)',
          hintEn: 'OPTIONAL: Use FOIL to check if you factored correctly!',
          hintEs: 'OPCIONAL: ¡Usa FOIL para comprobar si factorizaste correctamente!',
        },
        {
          bodyEn: 'The **DOTS method** (Difference Of Two Squares): make sure BOTH terms are PERFECT SQUARES with a subtraction sign in between. Set up two binomials: one with a "+" sign and one with a "−" sign.',
          bodyEs: 'El **método DOTS** (Diferencia de Dos Cuadrados): asegúrate de que AMBOS términos sean CUADRADOS PERFECTOS con un signo de resta en medio. Escribe dos binomios: uno con signo "+" y otro con signo "−".',
          workedExampleLatex: '4x^2-9 = (2x+3)(2x-3)',
        },
        {
          bodyEn: 'Mixed practice: ALWAYS ask yourself first, "Is there a GCF besides 1?" Then: 2 terms (perfect squares subtracted) → DOTS. Trinomial with a=1 → multiplies-to-c-adds-to-b.',
          bodyEs: 'Práctica mixta: SIEMPRE pregúntate primero: "¿Hay un MCD además de 1?" Luego: 2 términos (cuadrados perfectos restados) → DOTS. Trinomio con a=1 → se-multiplica-para-c-se-suma-para-b.',
          hintEn: 'GCF first, always!',
          hintEs: '¡Primero el MCD, siempre!',
        },
      ],
      skill: { slug: 'factor-trinomials', nameEn: 'Factoring trinomials & DOTS', nameEs: 'Factorizar trinomios y DOTS' },
      generated: [
        { template: 'factor_trinomial', tier: 'modified', count: 5 },
        { template: 'factor_trinomial', tier: 'standard', count: 7 },
        { template: 'dots', tier: 'standard', count: 4 },
        { template: 'dots', tier: 'challenge', count: 5 },
      ],
      exitTicketSize: 5,
    },
  ],
};

export const unit8: UnitSeed = {
  number: 8,
  titleEn: 'Quadratics',
  titleEs: 'Cuadráticas',
  lessons: [
    {
      code: '8.1',
      titleEn: 'Solving Quadratics with Square Roots',
      titleEs: 'Resolución de Cuadráticas con Raíces Cuadradas',
      mnemonicEn: 'A positive number has TWO square roots: + and −!',
      mnemonicEs: 'Un número positivo tiene DOS raíces cuadradas: ¡+ y −!',
      steps: [
        {
          bodyEn: 'You can use the **square roots method** when solving a quadratic equation in the form $ax^2-c=0$: 1) Add/subtract the constant on both sides. 2) Divide both sides by the coefficient. 3) Square root both sides!',
          bodyEs: 'Puedes usar el **método de raíces cuadradas** al resolver una ecuación cuadrática de la forma $ax^2-c=0$: 1) Suma/resta la constante en ambos lados. 2) Divide ambos lados entre el coeficiente. 3) ¡Saca la raíz cuadrada en ambos lados!',
          workedExampleLatex: '4x^2-100=0 \\;\\to\\; x^2=25 \\;\\to\\; x=\\pm 5',
        },
        {
          bodyEn: 'For $a(x+b)^2=c$: square root both sides to get rid of the exponent and parentheses, then create TWO separate equations (one equal to the positive root, one to the negative) and solve each.',
          bodyEs: 'Para $a(x+b)^2=c$: saca la raíz cuadrada en ambos lados para eliminar el exponente y el paréntesis, luego crea DOS ecuaciones separadas (una igual a la raíz positiva y otra a la negativa) y resuelve cada una.',
          workedExampleLatex: '(x-7)^2=64 \\;\\to\\; x-7=\\pm 8 \\;\\to\\; x=15 \\text{ or } x=-1',
          hintEn: 'You will end up with two different solutions!',
          hintEs: '¡Terminarás con dos soluciones diferentes!',
        },
      ],
      skill: { slug: 'quadratics-sqrt', nameEn: 'Square roots method', nameEs: 'Método de raíces cuadradas' },
      generated: [
        { template: 'solve_sqrt_method', tier: 'modified', count: 5 },
        { template: 'solve_sqrt_method', tier: 'standard', count: 8 },
        { template: 'solve_sqrt_method', tier: 'challenge', count: 4 },
      ],
      exitTicketSize: 4,
    },
    {
      code: '8.2',
      titleEn: 'Solving Quadratics by Factoring',
      titleEs: 'Resolución de Cuadráticas por Factorización',
      mnemonicEn: 'Zero Product Property: if (A)(B)=0, then A=0 or B=0.',
      mnemonicEs: 'Propiedad del Producto Cero: si (A)(B)=0, entonces A=0 o B=0.',
      steps: [
        {
          bodyEn: '1) Make sure the equation is written in **standard form** ($ax^2+bx+c=0$). If not, use inverse operations to rewrite it. 2) If a=1, ask: what **multiplies** to "c" but **adds** to "b"? 3) Set up your binomials, then use the **Zero Product Property** to solve for x!',
          bodyEs: '1) Asegúrate de que la ecuación esté en **forma estándar** ($ax^2+bx+c=0$). Si no, usa operaciones inversas para reescribirla. 2) Si a=1, pregunta: ¿qué se **multiplica** para dar "c" pero se **suma** para dar "b"? 3) ¡Escribe tus binomios y usa la **Propiedad del Producto Cero** para resolver x!',
          workedExampleLatex: 'x^2-9x=-14 \\;\\to\\; x^2-9x+14=0 \\;\\to\\; (x-7)(x-2)=0 \\;\\to\\; x=7,\\ x=2',
        },
        {
          bodyEn: '"Find the **zeros**" means to determine the value of x when f(x)=0 — same factoring process!',
          bodyEs: '"Encontrar los **ceros**" significa determinar el valor de x cuando f(x)=0 — ¡el mismo proceso de factorización!',
          workedExampleLatex: 'f(x)=x^2+3x-4 \\;\\to\\; (x+4)(x-1)=0 \\;\\to\\; x=-4,\\ x=1',
          hintEn: 'The quadratic formula ALWAYS works when factoring is hard: x = (−b ± √(b²−4ac)) / 2a.',
          hintEs: 'La fórmula cuadrática SIEMPRE funciona cuando factorizar es difícil: x = (−b ± √(b²−4ac)) / 2a.',
        },
      ],
      skill: { slug: 'quadratics-factoring', nameEn: 'Solving quadratics by factoring', nameEs: 'Resolver cuadráticas por factorización' },
      generated: [
        { template: 'solve_quadratic_factoring', tier: 'modified', count: 5 },
        { template: 'solve_quadratic_factoring', tier: 'standard', count: 8 },
        { template: 'solve_quadratic_factoring', tier: 'challenge', count: 5 },
      ],
      exitTicketSize: 5,
    },
    {
      code: '8.3',
      titleEn: 'Graphing Quadratics: Vertex & Axis of Symmetry',
      titleEs: 'Graficación de Cuadráticas: Vértice y Eje de Simetría',
      mnemonicEn: 'Vertex form y = a(x−h)² + k → vertex is (h, k). Watch the sign of h!',
      mnemonicEs: 'Forma de vértice y = a(x−h)² + k → el vértice es (h, k). ¡Cuidado con el signo de h!',
      steps: [
        {
          bodyEn: 'A quadratic function ALWAYS forms a U-shaped curve called a **PARABOLA**. It opens UPWARDS when a is positive and DOWNWARDS when a is negative. The turning point is the **VERTEX** — the minimum or maximum.',
          bodyEs: 'Una función cuadrática SIEMPRE forma una curva en U llamada **PARÁBOLA**. Abre HACIA ARRIBA cuando a es positivo y HACIA ABAJO cuando a es negativo. El punto de giro es el **VÉRTICE** — el mínimo o el máximo.',
          workedExampleLatex: 'f(x)=x^2+1:\\ \\text{opens up, vertex } (0,1)',
        },
        {
          bodyEn: 'Vertex-form equations are written $y=a(x-h)^2+k$ where **(h, k)** is the vertex. On a graph, look for the lowest/highest point; on a table, look for the smallest/largest y-value (the y-values around the vertex are symmetrical).',
          bodyEs: 'Las ecuaciones en forma de vértice se escriben $y=a(x-h)^2+k$ donde **(h, k)** es el vértice. En una gráfica, busca el punto más bajo/alto; en una tabla, busca el valor de y más pequeño/grande (los valores de y alrededor del vértice son simétricos).',
          workedExampleLatex: 'y=(x-3)^2+2:\\ \\text{vertex } (3,2)',
        },
        {
          bodyEn: 'The **axis of symmetry** is a vertical line that splits your parabola in half, passing through the vertex. Three ways to find it: draw the line of symmetry; average the roots/x-intercepts/zeros; or use the formula $x=\\frac{-b}{2a}$ from standard form.',
          bodyEs: 'El **eje de simetría** es una recta vertical que divide tu parábola por la mitad, pasando por el vértice. Tres maneras de encontrarlo: dibuja la línea de simetría; promedia las raíces/interceptos en x/ceros; o usa la fórmula $x=\\frac{-b}{2a}$ desde la forma estándar.',
          workedExampleLatex: 'x = \\frac{-b}{2a}',
          hintEn: 'The parabola can have two, one, or NO zeros.',
          hintEs: 'La parábola puede tener dos, uno o NINGÚN cero.',
        },
      ],
      skill: { slug: 'quadratics-graphing', nameEn: 'Vertex & axis of symmetry', nameEs: 'Vértice y eje de simetría' },
      generated: [
        { template: 'vertex_from_vertex_form', tier: 'modified', count: 5 },
        { template: 'vertex_from_vertex_form', tier: 'standard', count: 5 },
        { template: 'axis_of_symmetry', tier: 'standard', count: 5 },
        { template: 'axis_of_symmetry', tier: 'challenge', count: 5 },
      ],
      exitTicketSize: 5,
    },
    {
      code: '8.4',
      titleEn: 'Real-World Quadratics',
      titleEs: 'Cuadráticas del Mundo Real',
      mnemonicEn: 'On the ground → height is 0 (the zeros). Highest point → the vertex.',
      mnemonicEs: 'En el suelo → la altura es 0 (los ceros). Punto más alto → el vértice.',
      steps: [
        {
          bodyEn: 'TIP 1: The zeros/roots/x-intercepts are usually when the object is on the ground — the height (y-value) is 0.',
          bodyEs: 'CONSEJO 1: Los ceros/raíces/interceptos en x usualmente son cuando el objeto está en el suelo — la altura (valor de y) es 0.',
          workedExampleLatex: 'h(t)=-16t^2+64t = 0 \\;\\to\\; -16t(t-4)=0 \\;\\to\\; t=4\\ \\text{seconds}',
        },
        {
          bodyEn: 'TIP 2: The vertex is when the object reaches its **maximum height** above the ground. TIP 3: Putting the equation into the graphing calculator and checking the table of values is a great method!',
          bodyEs: 'CONSEJO 2: El vértice es cuando el objeto alcanza su **altura máxima** sobre el suelo. CONSEJO 3: ¡Poner la ecuación en la calculadora gráfica y revisar la tabla de valores es un gran método!',
          hintEn: 'Try the built-in graphing calculator on this problem!',
          hintEs: '¡Prueba la calculadora gráfica integrada en este problema!',
        },
      ],
      skill: { slug: 'quadratics-realworld', nameEn: 'Real-world quadratics', nameEs: 'Cuadráticas del mundo real' },
      generated: [
        { template: 'projectile_ground', tier: 'modified', count: 4 },
        { template: 'projectile_ground', tier: 'standard', count: 6 },
        { template: 'projectile_ground', tier: 'challenge', count: 4 },
      ],
      exitTicketSize: 4,
    },
  ],
};

export const unit9: UnitSeed = {
  number: 9,
  titleEn: 'Function Families',
  titleEs: 'Familias de Funciones',
  lessons: [
    {
      code: '9.1',
      titleEn: 'Transforming Functions',
      titleEs: 'Transformación de Funciones',
      mnemonicEn: '+k up, −k down; (x−h) right, (x+h) left; −a flips.',
      mnemonicEs: '+k arriba, −k abajo; (x−h) derecha, (x+h) izquierda; −a voltea.',
      steps: [
        {
          bodyEn: 'For quadratics $y=a(x-h)^2+k$, absolute value $y=a|x-h|+k$, and square roots $y=a\\sqrt{x-h}+k$: **+k** shifts up, **−k** shifts down; **(x−h)** shifts right, **(x+h)** shifts left.',
          bodyEs: 'Para cuadráticas $y=a(x-h)^2+k$, valor absoluto $y=a|x-h|+k$ y raíces cuadradas $y=a\\sqrt{x-h}+k$: **+k** desplaza hacia arriba, **−k** hacia abajo; **(x−h)** desplaza a la derecha, **(x+h)** a la izquierda.',
          workedExampleLatex: 'y=(x-2)^2+3:\\ \\text{right 2, up 3}',
        },
        {
          bodyEn: 'A **negative a** turns the graph upside down. If **a > 1** the graph gets narrower (vertical stretch); if **0 < a < 1** it gets wider (vertical compression).',
          bodyEs: 'Una **a negativa** voltea la gráfica. Si **a > 1** la gráfica se hace más angosta (estiramiento vertical); si **0 < a < 1** se hace más ancha (compresión vertical).',
          workedExampleLatex: 'y=-x^2\\ \\text{opens down};\\quad y=3x^2\\ \\text{narrower}',
          hintEn: 'Try graphing the parent function and the transformed one in the graphing calculator!',
          hintEs: '¡Grafica la función original y la transformada en la calculadora gráfica!',
        },
      ],
      skill: { slug: 'transformations', nameEn: 'Transforming functions', nameEs: 'Transformar funciones' },
      generated: [
        { template: 'transformation_identify', tier: 'modified', count: 6 },
        { template: 'transformation_identify', tier: 'standard', count: 8 },
        { template: 'transformation_identify', tier: 'challenge', count: 4 },
      ],
      exitTicketSize: 4,
    },
    {
      code: '9.2',
      titleEn: 'Comparing Function Families',
      titleEs: 'Comparación de Familias de Funciones',
      mnemonicEn: 'Power of 1 → linear. Power of 2 → quadratic. x in the exponent → exponential.',
      mnemonicEs: 'Potencia de 1 → lineal. Potencia de 2 → cuadrática. x en el exponente → exponencial.',
      steps: [
        {
          bodyEn: 'ALL **quadratic** functions can be written $y=ax^2+bx+c$ (highest power of x is 2). ALL **exponential** functions have x in the **exponent** ($y=ab^x$). ALL **linear** functions have an x with an exponent of 1 ($y=mx+b$ or $Ax+By=C$).',
          bodyEs: 'TODAS las funciones **cuadráticas** se escriben $y=ax^2+bx+c$ (la mayor potencia de x es 2). TODAS las funciones **exponenciales** tienen la x en el **exponente** ($y=ab^x$). TODAS las funciones **lineales** tienen una x con exponente 1 ($y=mx+b$ o $Ax+By=C$).',
          workedExampleLatex: 'y=2x^2-8\\ \\text{(quadratic)},\\quad y=100(3)^x\\ \\text{(exponential)},\\quad y=x+5\\ \\text{(linear)}',
        },
        {
          bodyEn: 'A **piecewise function** is a function made up of pieces of different functions over different intervals. Open circle = point NOT included (<, >); closed circle = point included (≤, ≥).',
          bodyEs: 'Una **función por partes** es una función formada por piezas de diferentes funciones en diferentes intervalos. Círculo abierto = punto NO incluido (<, >); círculo cerrado = punto incluido (≤, ≥).',
          workedExampleLatex: 'y=x+2\\ (x<1);\\quad y=(x-1)^2\\ (x \\ge 1)',
          hintEn: 'When a graph is increasing/decreasing/constant, focus on the x-axis for the interval.',
          hintEs: 'Cuando una gráfica crece/decrece/es constante, enfócate en el eje x para el intervalo.',
        },
      ],
      skill: { slug: 'function-families', nameEn: 'Comparing function families', nameEs: 'Comparar familias de funciones' },
      generated: [
        { template: 'classify_function_type', tier: 'modified', count: 6 },
        { template: 'classify_function_type', tier: 'standard', count: 8 },
        { template: 'classify_function_type', tier: 'challenge', count: 4 },
      ],
      exitTicketSize: 4,
    },
  ],
};
