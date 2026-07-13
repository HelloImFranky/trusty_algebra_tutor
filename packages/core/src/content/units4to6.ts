import type { UnitSeed } from './types.js';

export const unit4: UnitSeed = {
  number: 4,
  titleEn: 'Functions',
  titleEs: 'Funciones',
  lessons: [
    {
      code: '4.1',
      titleEn: 'Understanding Functions',
      titleEs: 'Comprensión de Funciones',
      mnemonicEn: 'One INPUT → one OUTPUT. A function is like a machine!',
      mnemonicEs: 'Una ENTRADA → una SALIDA. ¡Una función es como una máquina!',
      steps: [
        {
          bodyEn: 'A relation is a **function** when an INPUT has **one** OUTPUT. A function is like a machine: when we input a number into the machine, only one output comes out!',
          bodyEs: 'Una relación es una **función** cuando una ENTRADA tiene **una sola** SALIDA. Una función es como una máquina: cuando ingresamos un número a la máquina, ¡solo sale una salida!',
          workedExampleLatex: '(2,3)\\ (3,4)\\ (4,5)\\ (5,6) \\;\\text{✓ function}',
        },
        {
          bodyEn: 'In ordered pairs, tables, or mapping diagrams: check whether any input (x-value) repeats with a **different** output. If it does, it is NOT a function.',
          bodyEs: 'En pares ordenados, tablas o diagramas de mapeo: verifica si alguna entrada (valor de x) se repite con una salida **diferente**. Si es así, NO es una función.',
          workedExampleLatex: '(2,3)\\ (2,4)\\ (4,5) \\;\\text{✗ 2 has two outputs}',
        },
        {
          bodyEn: 'On a graph, use the **vertical line test**: if any vertical line touches the graph more than once, it is not a function.',
          bodyEs: 'En una gráfica, usa la **prueba de la línea vertical**: si alguna línea vertical toca la gráfica más de una vez, no es una función.',
          hintEn: 'Vertical line touches twice → not a function.',
          hintEs: 'La línea vertical toca dos veces → no es función.',
        },
      ],
      skill: { slug: 'understanding-functions', nameEn: 'Understanding functions', nameEs: 'Comprensión de funciones' },
      generated: [
        { template: 'is_function', tier: 'modified', count: 6 },
        { template: 'is_function', tier: 'standard', count: 8 },
        { template: 'is_function', tier: 'challenge', count: 4 },
      ],
    },
    {
      code: '4.2',
      titleEn: 'Evaluating Functions, Domain & Range',
      titleEs: 'Evaluación de Funciones, Dominio y Rango',
      mnemonicEn: 'Domain = x-values. Range = y-values.',
      mnemonicEs: 'Dominio = valores de x. Rango = valores de y.',
      steps: [
        {
          bodyEn: 'Evaluating functions requires you to INPUT your x-value into the given function (or machine) and use order of operations to determine the OUTPUT.',
          bodyEs: 'Evaluar funciones requiere INGRESAR tu valor de x en la función dada (o máquina) y usar el orden de operaciones para determinar la SALIDA.',
          workedExampleLatex: 'f(x)=4x^2+5:\\quad f(-6) = 4(-6)^2+5 = 4(36)+5 = 149',
          hintEn: 'Substitute in parentheses, then PEMDAS.',
          hintEs: 'Sustituye entre paréntesis, luego PEMDAS.',
        },
        {
          bodyEn: '**Domain**: all of the x-values of a function. **Range**: all of the y-values of a function.',
          bodyEs: '**Dominio**: todos los valores de x de una función. **Rango**: todos los valores de y de una función.',
          workedExampleLatex: '(1,2)\\ (3,4)\\ (5,6):\\ \\text{domain} = \\{1,3,5\\},\\ \\text{range} = \\{2,4,6\\}',
        },
        {
          bodyEn: '**Equality of functions**: set the two given functions EQUAL to each other, then use inverse operations to solve for x. Your answer tells you which x gives the SAME OUTPUT from both functions.',
          bodyEs: '**Igualdad de funciones**: iguala las dos funciones dadas y usa operaciones inversas para resolver x. Tu respuesta te dice qué x da la MISMA SALIDA en ambas funciones.',
          workedExampleLatex: 'f(x)=g(x) \\;\\to\\; 3x+2 = x+6 \\;\\to\\; x=2',
        },
      ],
      skill: { slug: 'evaluate-functions', nameEn: 'Evaluating functions, domain & range', nameEs: 'Evaluar funciones, dominio y rango' },
      generated: [
        { template: 'evaluate_function', tier: 'modified', count: 5 },
        { template: 'evaluate_function', tier: 'standard', count: 7 },
        { template: 'domain_from_points', tier: 'standard', count: 4 },
        { template: 'domain_from_points', tier: 'modified', count: 3 },
        { template: 'evaluate_function', tier: 'challenge', count: 5 },
      ],
    },
  ],
};

export const unit5: UnitSeed = {
  number: 5,
  titleEn: 'Linear Relationships',
  titleEs: 'Relaciones Lineales',
  lessons: [
    {
      code: '5.1',
      titleEn: 'Identifying Linear Functions',
      titleEs: 'Identificación de Funciones Lineales',
      mnemonicEn: 'Linear = straight line, exponent of 1, constant add/subtract change.',
      mnemonicEs: 'Lineal = línea recta, exponente de 1, cambio constante de suma/resta.',
      steps: [
        {
          bodyEn: 'ALL linear equations can be written in **STANDARD FORM** (Ax + By = C) and must follow 3 RULES. RULE #1: x and y must have an exponent of 1 (the exponent of 1 is invisible).',
          bodyEs: 'TODAS las ecuaciones lineales se pueden escribir en **FORMA ESTÁNDAR** (Ax + By = C) y deben seguir 3 REGLAS. REGLA #1: x y y deben tener un exponente de 1 (el exponente de 1 es invisible).',
          workedExampleLatex: 'y=2x+5\\ \\text{✓}\\qquad y=x^2\\ \\text{✗}',
        },
        {
          bodyEn: 'RULE #2: x and y cannot be multiplied together. RULE #3: x and y do NOT appear in denominators, exponents, or radicands.',
          bodyEs: 'REGLA #2: x y y no pueden estar multiplicadas entre sí. REGLA #3: x y y NO aparecen en denominadores, exponentes ni radicandos.',
          workedExampleLatex: 'xy=2\\ \\text{✗}\\qquad y=\\tfrac{2}{x}\\ \\text{✗}\\qquad y=2^x\\ \\text{✗}',
        },
        {
          bodyEn: 'On a **table**, x-values and y-values must have constant additive/subtractive change. In a **word problem**, look for keywords showing a constant add/subtract change ("receives $20 every month"). Doubling, tripling, or percent change → NOT linear.',
          bodyEs: 'En una **tabla**, los valores de x y y deben tener un cambio aditivo/sustractivo constante. En un **problema verbal**, busca palabras clave que muestren un cambio constante de suma/resta ("recibe $20 cada mes"). Duplicar, triplicar o cambio porcentual → NO es lineal.',
          hintEn: 'Constant +/− change = linear.',
          hintEs: 'Cambio constante de +/− = lineal.',
        },
      ],
      skill: { slug: 'identify-linear', nameEn: 'Identifying linear functions', nameEs: 'Identificar funciones lineales' },
      fixedProblems: [
        {
          tier: 'modified',
          promptEn: 'Is $y = 2x + 5$ a linear equation? (yes / no)',
          promptEs: '¿Es $y = 2x + 5$ una ecuación lineal? (yes / no)',
          answerLatex: 'yes',
          gradingMode: 'exact',
        },
        {
          tier: 'modified',
          promptEn: 'Is $y = x^2$ a linear equation? (yes / no)',
          promptEs: '¿Es $y = x^2$ una ecuación lineal? (yes / no)',
          answerLatex: 'no',
          gradingMode: 'exact',
        },
        {
          tier: 'standard',
          promptEn: 'Is $xy = 2$ a linear equation? (yes / no)',
          promptEs: '¿Es $xy = 2$ una ecuación lineal? (yes / no)',
          answerLatex: 'no',
          gradingMode: 'exact',
          steps: [
            {
              promptEn: 'RULE #2: can x and y be multiplied together in a linear equation? (yes/no)',
              promptEs: 'REGLA #2: ¿pueden x y y estar multiplicadas entre sí en una ecuación lineal? (yes/no)',
              expectedLatex: 'no',
              gradingMode: 'exact',
            },
          ],
        },
        {
          tier: 'standard',
          promptEn: 'Is $-3x + 2y = 5$ a linear equation? (yes / no)',
          promptEs: '¿Es $-3x + 2y = 5$ una ecuación lineal? (yes / no)',
          answerLatex: 'yes',
          gradingMode: 'exact',
        },
        {
          tier: 'standard',
          promptEn: 'Is $y = \\frac{2}{x}$ a linear equation? (yes / no)',
          promptEs: '¿Es $y = \\frac{2}{x}$ una ecuación lineal? (yes / no)',
          answerLatex: 'no',
          gradingMode: 'exact',
        },
        {
          tier: 'standard',
          promptEn: '"Mrs. Sonnick will deduct 10 points each day the assignment is late." Is this situation linear? (yes / no)',
          promptEs: '"La Sra. Sonnick descontará 10 puntos por cada día de retraso de la tarea." ¿Es lineal esta situación? (yes / no)',
          answerLatex: 'yes',
          gradingMode: 'exact',
        },
        {
          tier: 'challenge',
          promptEn: 'A table has x-values 1, 2, 3, 4 and y-values 3, 6, 12, 24. Is the function linear? (yes / no)',
          promptEs: 'Una tabla tiene valores de x 1, 2, 3, 4 y valores de y 3, 6, 12, 24. ¿Es lineal la función? (yes / no)',
          answerLatex: 'no',
          gradingMode: 'exact',
          steps: [
            {
              promptEn: 'Do the y-values change by a constant ADDED amount, or do they DOUBLE? (add/double)',
              promptEs: '¿Los valores de y cambian por una cantidad SUMADA constante o se DUPLICAN? (add/double)',
              expectedLatex: 'double',
              gradingMode: 'exact',
              hintEn: 'If something doubles, it is NOT linear — that is exponential.',
              hintEs: 'Si algo se duplica, NO es lineal — eso es exponencial.',
            },
          ],
        },
        {
          tier: 'challenge',
          promptEn: 'Is $y = \\frac{1}{2}x + 2$ a linear equation? (yes / no)',
          promptEs: '¿Es $y = \\frac{1}{2}x + 2$ una ecuación lineal? (yes / no)',
          answerLatex: 'yes',
          gradingMode: 'exact',
        },
      ],
    },
    {
      code: '5.2',
      titleEn: 'Slope & Intercepts',
      titleEs: 'Pendiente e Interceptos',
      mnemonicEn: 'Slope = RISE / RUN. Rise = change in y, Run = change in x.',
      mnemonicEs: 'Pendiente = ELEVACIÓN / AVANCE. Elevación = cambio en y, Avance = cambio en x.',
      steps: [
        {
          bodyEn: 'The **slope** is a number that measures the **steepness** of a line. On a graph, we calculate the **RISE/RUN** using ANY two points. RISE (up or down) = difference in y-values; RUN (left or right) = difference in x-values.',
          bodyEs: 'La **pendiente** es un número que mide la **inclinación** de una recta. En una gráfica, calculamos la **ELEVACIÓN/AVANCE** usando DOS puntos cualesquiera. ELEVACIÓN (arriba o abajo) = diferencia en y; AVANCE (izquierda o derecha) = diferencia en x.',
          workedExampleLatex: 'm = \\frac{y_2 - y_1}{x_2 - x_1}',
        },
        {
          bodyEn: 'Slope formula steps: STEP 1: Identify ANY TWO points. STEP 2: Label the points. STEP 3: Substitute the values into the formula. STEP 4: Simplify!',
          bodyEs: 'Pasos de la fórmula de la pendiente: PASO 1: Identifica DOS puntos cualesquiera. PASO 2: Etiqueta los puntos. PASO 3: Sustituye los valores en la fórmula. PASO 4: ¡Simplifica!',
          workedExampleLatex: '(1,2),\\ (6,5):\\quad m = \\frac{5-2}{6-1} = \\frac{3}{5}',
        },
        {
          bodyEn: '**x-intercept**: where the graph touches the x-axis — (some #, 0). **y-intercept**: where the graph touches the y-axis — (0, some #). On a table, the y-intercept is the point where x is 0.',
          bodyEs: '**Intercepto en x**: donde la gráfica toca el eje x — (algún #, 0). **Intercepto en y**: donde la gráfica toca el eje y — (0, algún #). En una tabla, el intercepto en y es el punto donde x es 0.',
          hintEn: 'Rate of change = slope! Use the slope formula for average rate of change.',
          hintEs: '¡La tasa de cambio = pendiente! Usa la fórmula de la pendiente para la tasa de cambio promedio.',
        },
      ],
      skill: { slug: 'slope-intercepts', nameEn: 'Slope & intercepts', nameEs: 'Pendiente e interceptos' },
      generated: [
        { template: 'identify_slope_yint', tier: 'modified', count: 6 },
        { template: 'slope_two_points', tier: 'standard', count: 8 },
        { template: 'slope_two_points', tier: 'challenge', count: 5 },
      ],
    },
    {
      code: '5.3',
      titleEn: 'Slope-Intercept Form & Graphing',
      titleEs: 'Forma Pendiente-Intercepto y Graficación',
      mnemonicEn: 'y = mx + b: "m" is the slope, "b" is the y-intercept.',
      mnemonicEs: 'y = mx + b: "m" es la pendiente, "b" es el intercepto en y.',
      steps: [
        {
          bodyEn: '**Slope-intercept form** is written as **y = mx + b** where the "m" represents the **slope** and the "b" represents the **y-intercept**.',
          bodyEs: 'La **forma pendiente-intercepto** se escribe como **y = mx + b** donde la "m" representa la **pendiente** y la "b" representa el **intercepto en y**.',
          workedExampleLatex: 'y=-2x+5:\\quad m=-2,\\ b=(0,5)',
        },
        {
          bodyEn: 'What if the equation is NOT written in slope-intercept form? Use **inverse operations** to isolate the "y" variable!',
          bodyEs: '¿Y si la ecuación NO está escrita en forma pendiente-intercepto? ¡Usa **operaciones inversas** para aislar la variable "y"!',
          workedExampleLatex: '6x+2y=12 \\;\\to\\; 2y=-6x+12 \\;\\to\\; y=-3x+6',
        },
        {
          bodyEn: 'To graph y = mx + b: STEP 1: Plot the y-intercept first. STEP 2: Use the slope to plot the next point (rise over run). STEP 3: Connect the points!',
          bodyEs: 'Para graficar y = mx + b: PASO 1: Traza primero el intercepto en y. PASO 2: Usa la pendiente para trazar el siguiente punto (elevación sobre avance). PASO 3: ¡Conecta los puntos!',
          workedExampleLatex: 'f(x)=2x+3:\\ \\text{start at } (0,3),\\ \\text{go up 2, right 1}',
          hintEn: 'Writing an equation from a graph? Find b, count rise/run for m, substitute into y=mx+b.',
          hintEs: '¿Escribir una ecuación desde una gráfica? Encuentra b, cuenta elevación/avance para m, sustituye en y=mx+b.',
        },
      ],
      skill: { slug: 'slope-intercept-form', nameEn: 'Slope-intercept form & graphing', nameEs: 'Forma pendiente-intercepto y graficación' },
      generated: [
        { template: 'identify_slope_yint', tier: 'modified', count: 5 },
        { template: 'slope_intercept_rewrite', tier: 'standard', count: 8 },
        { template: 'slope_intercept_rewrite', tier: 'challenge', count: 5 },
      ],
    },
    {
      code: '5.4',
      titleEn: 'Systems: Graphing & Substitution',
      titleEs: 'Sistemas: Graficación y Sustitución',
      mnemonicEn: 'The SOLUTION is the point of intersection!',
      mnemonicEs: '¡La SOLUCIÓN es el punto de intersección!',
      steps: [
        {
          bodyEn: '**"Systems"** means 2 or more equations. We **solve** a system of linear equations by finding the **point of intersection** — where the two lines touch.',
          bodyEs: '**"Sistemas"** significa 2 o más ecuaciones. **Resolvemos** un sistema de ecuaciones lineales encontrando el **punto de intersección** — donde las dos rectas se tocan.',
          workedExampleLatex: 'x+y=-3,\\ -2x+y=-3 \\;\\to\\; \\text{solution } (0,-3)',
        },
        {
          bodyEn: 'By graphing: STEP 1: Write both equations in slope-intercept form. STEP 2: Graph both equations. STEP 3: LOOK FOR THE POINT OF INTERSECTION! STEP 4 (optional): Check by substituting the point into both equations.',
          bodyEs: 'Por graficación: PASO 1: Escribe ambas ecuaciones en forma pendiente-intercepto. PASO 2: Grafica ambas ecuaciones. PASO 3: ¡BUSCA EL PUNTO DE INTERSECCIÓN! PASO 4 (opcional): Verifica sustituyendo el punto en ambas ecuaciones.',
        },
        {
          bodyEn: 'The **substitution method** works best when at least one variable is already isolated: substitute that expression into the other equation, solve, then back-substitute to find the other variable.',
          bodyEs: 'El **método de sustitución** funciona mejor cuando al menos una variable ya está aislada: sustituye esa expresión en la otra ecuación, resuelve y luego vuelve a sustituir para encontrar la otra variable.',
          workedExampleLatex: '-3x+y=1,\\ 4x+y=8 \\;\\to\\; \\text{solution } (1,4)',
          hintEn: 'The point MUST satisfy both equations.',
          hintEs: 'El punto DEBE satisfacer ambas ecuaciones.',
        },
      ],
      skill: { slug: 'systems-substitution', nameEn: 'Systems by graphing & substitution', nameEs: 'Sistemas por graficación y sustitución' },
      generated: [
        { template: 'system_substitution', tier: 'modified', count: 4 },
        { template: 'system_substitution', tier: 'standard', count: 8 },
        { template: 'system_substitution', tier: 'challenge', count: 4 },
      ],
    },
    {
      code: '5.5',
      titleEn: 'Systems: Elimination',
      titleEs: 'Sistemas: Eliminación',
      mnemonicEn: 'Opposite coefficients ELIMINATE each other when you add!',
      mnemonicEs: '¡Los coeficientes opuestos se ELIMINAN al sumar!',
      steps: [
        {
          bodyEn: 'STEP 1: Ask yourself: are BOTH equations in standard form (Ax + By = C)? STEP 2: Do I see opposite coefficients? If not, multiply one or both equations by a constant to create opposite coefficients.',
          bodyEs: 'PASO 1: Pregúntate: ¿están AMBAS ecuaciones en forma estándar (Ax + By = C)? PASO 2: ¿Veo coeficientes opuestos? Si no, multiplica una o ambas ecuaciones por una constante para crear coeficientes opuestos.',
          workedExampleLatex: '3x+8y=7,\\ 4(2x-2y)=4(-10) \\;\\to\\; 8y \\text{ and } -8y',
        },
        {
          bodyEn: 'STEP 3: Add your new equations together and solve for the remaining variable! STEP 4: Take the value you found and substitute it into EITHER original equation.',
          bodyEs: 'PASO 3: ¡Suma tus nuevas ecuaciones y resuelve para la variable que queda! PASO 4: Toma el valor que encontraste y sustitúyelo en CUALQUIERA de las ecuaciones originales.',
          workedExampleLatex: '\\text{solution } (-3, 2)',
        },
        {
          bodyEn: 'Which method to use? **Graphing** when both are in slope-intercept form. **Substitution** when a variable is isolated. **Elimination** when both are in standard form. It does not matter which method — some are just easier!',
          bodyEs: '¿Qué método usar? **Graficación** cuando ambas están en forma pendiente-intercepto. **Sustitución** cuando una variable está aislada. **Eliminación** cuando ambas están en forma estándar. No importa el método — ¡algunos son simplemente más fáciles!',
          hintEn: 'Find the LCM of the coefficients to create opposites.',
          hintEs: 'Encuentra el MCM de los coeficientes para crear opuestos.',
        },
      ],
      skill: { slug: 'systems-elimination', nameEn: 'Systems by elimination', nameEs: 'Sistemas por eliminación' },
      generated: [
        { template: 'system_elimination', tier: 'modified', count: 4 },
        { template: 'system_elimination', tier: 'standard', count: 8 },
        { template: 'system_elimination', tier: 'challenge', count: 4 },
      ],
    },
  ],
};

export const unit6: UnitSeed = {
  number: 6,
  titleEn: 'Exponential Relationships',
  titleEs: 'Relaciones Exponenciales',
  lessons: [
    {
      code: '6.1',
      titleEn: 'Graphing & Writing Exponential Functions',
      titleEs: 'Graficación y Escritura de Funciones Exponenciales',
      mnemonicEn: 'y = ab^x: "a" is the start amount, "b" is the constant ratio.',
      mnemonicEs: 'y = ab^x: "a" es la cantidad inicial, "b" es la razón constante.',
      steps: [
        {
          bodyEn: 'While linear functions form a straight line, ALL **exponential functions** form a **curve**. The graph gets close to, but does not touch, the x-axis.',
          bodyEs: 'Mientras las funciones lineales forman una línea recta, TODAS las **funciones exponenciales** forman una **curva**. La gráfica se acerca al eje x pero no lo toca.',
          workedExampleLatex: 'f(x) = 3^x',
        },
        {
          bodyEn: 'Exponential functions can be written in the form $f(x)=ab^x$ where "a" represents the original value (y-intercept) and "b" represents the constant ratio. You can think of the constant ratio like the slope.',
          bodyEs: 'Las funciones exponenciales se escriben en la forma $f(x)=ab^x$ donde "a" representa el valor original (intercepto en y) y "b" representa la razón constante. Puedes pensar en la razón constante como la pendiente.',
          workedExampleLatex: '\\text{500 bacteria double each hour: } f(x) = 500(2)^x',
          hintEn: 'Doubling → b = 2. Tripling → b = 3. Half-life → b = 1/2.',
          hintEs: 'Duplicar → b = 2. Triplicar → b = 3. Media vida → b = 1/2.',
        },
      ],
      skill: { slug: 'exponential-functions', nameEn: 'Writing exponential functions', nameEs: 'Escribir funciones exponenciales' },
      generated: [
        { template: 'exponential_write', tier: 'modified', count: 4 },
        { template: 'exponential_write', tier: 'standard', count: 8 },
        { template: 'exponential_write', tier: 'challenge', count: 4 },
      ],
    },
    {
      code: '6.2',
      titleEn: 'Growth vs. Decay; Linear vs. Exponential',
      titleEs: 'Crecimiento vs. Decaimiento; Lineal vs. Exponencial',
      mnemonicEn: 'Growth: b = 1 + r. Decay: b = 1 − r.',
      mnemonicEs: 'Crecimiento: b = 1 + r. Decaimiento: b = 1 − r.',
      steps: [
        {
          bodyEn: 'When something grows or decreases by a **constant percentage**, use the exponential **growth** ($y = a(1+r)^t$) or **decay** ($y = a(1-r)^t$) formula, where r is the percent as a decimal.',
          bodyEs: 'Cuando algo crece o disminuye por un **porcentaje constante**, usa la fórmula de **crecimiento** exponencial ($y = a(1+r)^t$) o de **decaimiento** ($y = a(1-r)^t$), donde r es el porcentaje como decimal.',
          workedExampleLatex: '\\text{iPhone worth \\$1100 loses 20\\%/yr: } y = 1100(0.8)^t',
        },
        {
          bodyEn: '**LINEAR**: straight line; increases/decreases at a constant rate of addition or subtraction. **EXPONENTIAL**: curve; increases/decreases at a constant rate of multiplication. In a word problem, look for **double, triple, or percent**.',
          bodyEs: '**LINEAL**: línea recta; aumenta/disminuye a una tasa constante de suma o resta. **EXPONENCIAL**: curva; aumenta/disminuye a una tasa constante de multiplicación. En un problema verbal, busca **duplicar, triplicar o porcentaje**.',
          hintEn: '"$20 every month" → linear. "doubles every day" → exponential.',
          hintEs: '"$20 cada mes" → lineal. "se duplica cada día" → exponencial.',
        },
      ],
      skill: { slug: 'growth-decay', nameEn: 'Exponential growth & decay', nameEs: 'Crecimiento y decaimiento exponencial' },
      generated: [
        { template: 'linear_vs_exponential', tier: 'modified', count: 6 },
        { template: 'exponential_growth_decay', tier: 'standard', count: 8 },
        { template: 'exponential_growth_decay', tier: 'challenge', count: 5 },
      ],
    },
  ],
};
