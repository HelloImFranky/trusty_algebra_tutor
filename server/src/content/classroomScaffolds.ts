/**
 * The actual classroom scaffolds from the "Algebra Scaffolds__891" document
 * in the Algebra 891 Google Drive folder, transcribed section by section and
 * attached to the lesson each section teaches. Text is kept faithful to the
 * original (same steps, same wording, same hints); math is normalized to
 * $...$ LaTeX so it renders, and layout tables are flattened to lines.
 */
export interface ScaffoldSection {
  title: string;
  body: string;
}

export const classroomScaffolds: Record<string, ScaffoldSection[]> = {
  '1.1': [
    {
      title: 'Square Roots & Cube Roots',
      body:
        '**Perfect Square:** A perfect square is the square of a whole number. Squaring a number means to multiply it by itself twice. *Ex: 25 is a perfect square because $5 \\times 5 = 25$.*\n\n' +
        '**Square Root:** There are two square roots for a positive number. *Ex: The square roots of 25 are both −5 and 5.*\n\n' +
        '**Perfect Cube:** A perfect cube is the cube of a whole number. Cubing a number means to multiply it by itself three times. *Ex: 125 is a perfect cube because $5 \\times 5 \\times 5 = 125$.*\n\n' +
        '**Cube Root:** There is one cube root for a positive number. *Ex: The cube root of 125 is just 5.*',
    },
  ],
  '1.5': [
    {
      title: 'Converting Measurements',
      body:
        '**Dimensional Analysis** is a great method we can use to convert units. When using the method, you must use ratios of two equivalent measurements called **conversion factors**.\n\n' +
        '**STEPS FOR CONVERTING MEASUREMENTS**\n\n' +
        '**STEP 1:** Write the given unit as a fraction. Put the "given unit" in the numerator and "1" in the denominator.\n' +
        '**STEP 2:** Choose conversion factor and set up so the units cancel. *You can find the conversion factor in the Algebra Regents Reference Table.*\n' +
        '**STEP 3:** Multiply fractions (straight across).\n' +
        '**STEP 4:** Divide.\n\n' +
        '**EXAMPLE #1:** How many kilometers are in 10 miles?',
    },
    {
      title: 'Converting Rates',
      body:
        '• When working with rates such as "*miles per hour*" we sometimes want to convert that to "*feet per second*" instead. This means we need **TWO** conversion factors:\n' +
        '  • one conversion factor to go from miles to feet.\n' +
        '  • a second conversion factor to go from hour to seconds.\n\n' +
        '**EXAMPLE 1:** A car travels at 55 miles per hour. Use dimensional analysis to convert the car\'s speed in feet per second. Round your answer to the nearest tenth.',
    },
  ],
  '1.6': [
    {
      title: 'Properties of Real Numbers',
      body:
        '**Commutative Property of Addition:** $2+5+6 = 6+5+2$\n' +
        '**Commutative Property of Multiplication:** $2 \\cdot 5 \\cdot 6 = 6 \\cdot 5 \\cdot 2$\n' +
        '**Associative Property of Addition:** $56+(45+81) = (56+45)+81$\n' +
        '**Associative Property of Multiplication:** $56(45 \\cdot 81) = (56 \\cdot 45)81$\n' +
        '**Additive Identity:** $65+0=65$\n' +
        '**Multiplicative Identity:** $65 \\cdot 1=65$\n' +
        '**Additive Inverse:** $45+(-45)=0$\n' +
        '**Multiplicative Inverse:** $45 \\cdot \\frac{1}{45} = 1$\n' +
        '**Distributive Property:** $6(2a+3)=12a+18$\n\n' +
        '**\\*HINTS\\***\n' +
        '*Commutative — the order of the numbers change/numbers move.*\n' +
        '*Associative — only the parenthesis move; the numbers stay the same.*\n' +
        '*Identity — the "identity" of the number does not change.*\n' +
        '*Inverse — means the opposite.*\n' +
        '*Distributive — means to multiply.*',
    },
    {
      title: 'Properties of Equality',
      body:
        '• Addition Property of Equality\n' +
        '• Subtraction Property of Equality\n' +
        '• Multiplication Property of Equality\n' +
        '• Division Property of Equality\n\n' +
        '*Whatever you do to one side of an equation, do to the other — the equation stays balanced.*',
    },
  ],
  '2.1': [
    {
      title: 'Evaluating Polynomials & Expressions',
      body:
        'When evaluating expressions, first **SUBSTITUTE** then **SIMPLIFY**!!!\n\n' +
        '**Example:** *Evaluate the following expression when* **x = −4**\n\n' +
        '**STEP 1:** Substitute −4 for x *(wherever you see an "x" replace it with a −4)*\n' +
        '**STEP 2:** Simplify using **PEMDAS**',
    },
  ],
  '2.2': [
    {
      title: 'Simplifying Expressions & Polynomials, Standard Form',
      body:
        'How do I simplify an expression by **COMBINING LIKE-TERMS** and writing my final answer in **STANDARD FORM**?\n\n' +
        '**Example 1:** $2x+5-3y-5x^2-x+100-19y$\n\n' +
        '**STEP 1: IDENTIFY and COMBINE the like-terms.** ***TIP: Use different shapes or colors when identifying the like-terms.***\n' +
        '**STEP 2: Write your answer in standard form.** ***HINT:*** *Determine the* ***degree of each term*** *then order from* ***highest degree to lowest degree.***',
    },
    {
      title: 'Multi-Step Simplifying Polynomials',
      body:
        '• Multi-step simplifying polynomials requires **two steps**:\n' +
        '  • First, using the **distributive property** to get rid of the parenthesis.\n' +
        '  • The distributive property tells us to give a number out using multiplication to each term INSIDE the parentheses.\n' +
        '  • Secondly, **combining like-terms** (terms with the same variable and same exponent).\n\n' +
        '**EXAMPLE 1:** Simplify the following expression: $7-2(x^2+3)-2x^2$\n\n' +
        'First, we distribute −2 to each term in the parenthesis. Next, we combine like-terms: $-2x^2$ and $-2x^2$, then $7$ and $-6$.',
    },
  ],
  '2.3': [
    {
      title: 'Multiplying Monomials and Polynomials',
      body:
        '**Monomial × Monomial** — ***REMEMBER:*** *Multiply coefficients. Add exponents that have the same variable.*\n\n' +
        '**Monomial × Polynomial** — ***REMEMBER:*** *Distribute the monomial to each term inside parenthesis. Multiply coefficients. Add exponents that have the same variable.*',
    },
    {
      title: 'Multiplying Binomials',
      body:
        'When we multiply two binomials, we want to **DISTRIBUTE 4 TIMES**. A fun and easy way to remember the order is by using the **FOIL method**.\n\n' +
        '**Example 1:** $(x+5)(x-6)$\n' +
        '**STEP 1:** USE FOIL\n' +
        '**STEP 2:** Combine Like-Terms\n\n' +
        '**EXAMPLE 2:** $(x-2)^2$\n' +
        '**STEP 1:** Write binomial TWICE.\n' +
        '**STEP 2:** USE FOIL\n' +
        '**STEP 3:** Combine Like-Terms',
    },
    {
      title: 'Multiplying Polynomials',
      body:
        '**Example:** $(x+2)(x^2-5x+4)$\n\n' +
        '**STEP 1:** Distribute 6 times. *\\*We cannot use FOIL because we are not multiplying two binomials.\\**\n' +
        '**STEP 2:** Combine like-terms.',
    },
  ],
  '3.1': [
    {
      title: 'Solving Multi-Step Equations',
      body:
        '**BEFORE solving multi-step equations, ALWAYS ask yourself:**\n' +
        '**Do I need to distribute?**\n' +
        '**Do I need to combine like-terms?**',
    },
  ],
  '3.2': [
    {
      title: 'Solving Equations with Variables on Both Sides',
      body: '**EXAMPLE:** Solve the following equation for n: $-6n-18=12+4n$\n\n*Use inverse operations to move the variables to one side, then solve the two-step equation that remains.*',
    },
    {
      title: 'Literal Equations',
      body:
        '• **Literal Equations** are equations that consist of more than one variable.\n' +
        '• Solving literal equations means to isolate a specific variable.\n' +
        '• We can use inverse operations to isolate the variable.\n\n' +
        '**EXAMPLE 1:** The formula for the area of a circle is $A=\\pi r^2$. Solve the equation for r.\n' +
        '**EXAMPLE 2:** The formula for Celsius is $C=\\frac{5}{9}(F-32)$. To convert temperature in degrees of Celsius to Fahrenheit, solve for F.',
    },
  ],
  '3.3': [
    {
      title: 'Solving Inequalities Review (two-step inequalities)',
      body:
        '**EXAMPLE:** $12-5x>72$\n\n' +
        '***\\*The steps are the SAME as solving an equation\\****\n\n' +
        '***How do I graph my final answer?*** *Open circle for < or >; closed circle for ≤ or ≥; shade toward the solutions.*',
    },
    {
      title: 'Solving Inequalities with Variables on Both Sides',
      body:
        '• Solving inequalities is the same as solving an equation.\n' +
        '• When we have variables on BOTH sides, we use inverse operations to move the variables to one side.\n' +
        '• If you are dividing or multiplying by a negative number, don\'t forget to flip the inequality symbol!',
    },
    {
      title: 'Real-world inequalities',
      body:
        '**≥** — greater than or equal to: *at least, no less than, a minimum of*\n' +
        '**≤** — less than or equal to: *at most, no more than, a maximum of*\n' +
        '**>** — greater than: *more than*\n' +
        '**<** — less than: *fewer than*\n\n' +
        '**x** (or any given variable): *each, per, every*',
    },
  ],
  '4.1': [
    {
      title: 'Understanding Functions',
      body:
        '• A relation is a function when an INPUT has **one** OUTPUT.\n' +
        '• A function is like a machine: when we input a number into the machine, only one output comes out!\n\n' +
        '**ORDERED PAIRS** — FUNCTION: $(2,3)\\ (3,4)\\ (4,5)\\ (5,6)$ — each input has one output. NOT A FUNCTION: $(2,3)\\ (2,4)\\ (4,5)\\ (5,6)$ — 2 has more than one output: 3 and 4.\n\n' +
        '**TABLE OF VALUES / MAPPING DIAGRAM** — check whether any input repeats with a different output.\n\n' +
        '**GRAPH** — the graph is a function when it passes the **vertical line test**: each vertical line touches the graph one time. It is NOT a function if the line touches the graph more than one time.',
    },
  ],
  '4.2': [
    {
      title: 'Input/Output — Evaluating Functions',
      body:
        'Evaluating Functions requires you to INPUT your x-value into the given function (or machine) and use order of operations to determine the OUTPUT.\n\n' +
        '**EXAMPLE 1:** If $f(x)=4x^2+5$, what is the value for $f(-6)$?',
    },
    {
      title: 'Equality of Functions',
      body:
        'Equality of Functions means to…\n' +
        '1) Set your two given functions EQUAL to each other.\n' +
        '2) Use inverse operations to solve for x.\n\n' +
        '*\\*Your answer will tell you which value of x will give you the SAME OUTPUT from both functions.*\n\n' +
        'When we input "2" into our two given functions, we get the SAME output of 8.',
    },
    {
      title: 'Adding, Subtracting & Multiplying Functions',
      body:
        '**EXAMPLE:** Given $f(x)=3x+4$ and $g(x)=-x+2$\n\n' +
        '• If there is a "+" sign in between the functions, we must **add**! Distribute "+1", then combine like-terms.\n' +
        '• If there is a "−" sign in between the functions, we must **subtract**! Distribute "−1", then combine like-terms.\n' +
        '• If there is a "×" sign in between the functions, we must **MULTIPLY**! Use the **Distributive Property** by multiplying the constant term to each term in the parenthesis.',
    },
    {
      title: 'Domain & Range',
      body:
        '**Domain:** all of the x-values of a function.\n' +
        '**Range:** all of the y-values of a function.',
    },
    {
      title: 'Interpreting Graphs',
      body:
        'When determining the intervals when a graph is always INCREASING, DECREASING, or remaining CONSTANT you want to focus on the **x-axis**.\n\n' +
        '**INCREASING:** Ask yourself: Between which two numbers on the x-axis is my graph always going up? *Example: increasing from $x=0$ to $x=2$ → interval notation $0 \\le x \\le 2$.*\n\n' +
        '**DECREASING:** Between which two numbers on the x-axis is my graph always going down? *Example: decreasing from $-\\infty$ to $0$ → $-\\infty \\le x \\le 0$.*\n\n' +
        '**CONSTANT:** Between which two numbers on the x-axis is my graph horizontal (or flat)? *Example: flat from $x=4$ to $x=6$ → $4 \\le x \\le 6$.*',
    },
  ],
  '5.1': [
    {
      title: 'Identifying Linear Functions — EQUATIONS',
      body:
        'REMEMBER:\n' +
        '• **ALL** linear equations can be written in **STANDARD FORM** ($Ax+By=C$).\n' +
        '• **ALL** linear equations *must* follow each one of these 3 RULES.\n\n' +
        '**RULE #1: x and y must have an exponent of 1.** *(the exponent of 1 is invisible)* — EXAMPLES: $y=2x+5$, $-3x+2y=5$. NON-EXAMPLES: $y=x^2$, $x^3+5=y$, $y^2=x$.\n\n' +
        '**RULE #2: x and y cannot be multiplied together** — NON-EXAMPLE: $xy=2$.\n\n' +
        '**RULE #3: x and y DO NOT appear in denominators, exponents, or radicands** — EXAMPLES: $y=\\frac{1}{2}x+2$, $y=x$. NON-EXAMPLES: $y=\\frac{2}{x}$, $y=5^x$, $y=\\sqrt{x-5}$.',
    },
    {
      title: 'Identifying Linear Functions — Tables & Word Problems',
      body:
        '**TABLE:** When looking at a table, your x-values and y-values must have **constant additive/subtractive change**. *Example: x-values with a constant additive of 1 and y-values with a constant additive of 5 → linear. If the y-values do NOT have a constant additive → not linear.*\n\n' +
        '**WORD PROBLEM:** Focus on ***keywords*** and ***phrases*** that illustrate a **constant additive/subtractive change**.\n' +
        '*Example of a constant additive change: "Juan receives \\$20 every month." (+\\$20, +\\$20, +\\$20)*\n' +
        '*Example of a constant subtractive change: "Mrs. Sonnick will deduct 10 points each day the assignment is late." (−10pts, −10pts, −10pts)*\n\n' +
        '**NONLINEAR KEYWORDS AND PHRASES:** if something **doubles** (Ex: 3, 6, 12, 24…), if something **triples** (Ex: 3, 9, 27…), if there is a **percent increase or decrease**.',
    },
  ],
  '5.2': [
    {
      title: 'Finding Slope and Intercepts from a graph',
      body:
        '**INTERCEPTS**\n' +
        '**x-intercept:** when the graph touches the x-axis — **(some #, 0)**.\n' +
        '**y-intercept:** when the graph touches the y-axis — **(0, some #)**.\n\n' +
        '**SLOPE**\n' +
        '• The slope is a number that measures the ***steepness*** of a line.\n' +
        '• On a graph, we calculate the **RISE/RUN** using **ANY two points** to determine the slope.\n' +
        '**RISE (UP or DOWN)** — difference in y-values. **RUN (LEFT or RIGHT)** — difference in x-values.',
    },
    {
      title: 'Finding Slope and Intercepts from a table',
      body:
        '**Y-intercept:** When identifying the y-intercept from a table of values, look for the point where x is 0.\n\n' +
        '**Slope:** When finding the slope from a table of values, use the **slope formula**!\n' +
        '**Step 1:** Identify **ANY TWO** points.\n' +
        '**Step 2:** **Label** the points.\n' +
        '**Step 3:** **Substitute** the values into the formula $m=\\frac{y_2-y_1}{x_2-x_1}$.\n' +
        '**Step 4:** **Simplify**!',
    },
    {
      title: 'Rate of Change',
      body:
        '**Rate of change…**\n' +
        '• measures how quickly or slowly something changes over a period of time.\n' +
        '• it describes how the *x* changes in relation to the *y*. You can think of the rate of change as the **slope** of a line!\n' +
        '• We use the *slope formula* to find the average rate of change!',
    },
  ],
  '5.3': [
    {
      title: 'Slope-Intercept Form',
      body:
        '**Slope-intercept form** is written as **y = mx + b** where the "**m**" represents **slope** and the "**b**" represents the **y-intercept**.\n\n' +
        'Examples: $y=-2x+5$ → slope $-2$, y-intercept $(0,5)$. $y=x-2$ → slope $1$, y-intercept $(0,-2)$. $y=\\frac{1}{2}x+3$ → slope $\\frac{1}{2}$, y-intercept $(0,3)$.\n\n' +
        '**Q: What if the equation is NOT written in slope-intercept form?**\n' +
        '**A: Use inverse operations to isolate the "y" variable!**\n\n' +
        '*Example 1: $6x+2y=12$ → slope $-3$, y-intercept $(0,6)$. Example 2: $-2y=x+6$ → slope $-\\frac{1}{2}$, y-intercept $(0,-3)$.*',
    },
    {
      title: 'Graphing y = mx + b',
      body:
        'When given a linear function in slope-intercept form **(y=mx+b)** all you need is the **y-intercept** and the **slope** to plot the points! You don\'t even need to use a graphing calculator, cool right? :)\n\n' +
        '**Example:** Identify the slope and y-intercept, then graph: $f(x)=2x+3$ — **Slope:** 2 or 2/1. **Y-intercept:** (0,3).\n\n' +
        '**STEP 1:** Plot the y-intercept first.\n' +
        '**STEP 2:** Use the slope to plot the next point. *In this example, the slope is 2/1, so you need to count 2 units **up** and 1 unit to the **right** to plot the next point. Continue this pattern to plot more points.*\n' +
        '**STEP 3:** Connect the points!',
    },
    {
      title: 'Writing Linear Functions',
      body:
        '**1) Writing an equation from a graph**\n' +
        '**STEP 1:** Identify the y-intercept ("b").\n' +
        '**STEP 2:** Identify the slope by counting the rise/run or using the slope formula ("m").\n' +
        '**STEP 3:** Substitute the "m" value and "b" value into the equation: y=mx+b.\n\n' +
        '**2) Writing an equation from a table**\n' +
        '**STEP 1:** Calculate the slope using the formula.\n' +
        '**STEP 2:** Substitute the slope and **ANY** point from the table into "y=mx+b".\n' +
        '**STEP 3:** Solve for b!\n' +
        '**STEP 4:** Substitute the "m" value and "b" value into the equation: y=mx+b.',
    },
    {
      title: 'Linear Regression & Correlation Coefficient',
      body:
        '**Linear Regression**\n' +
        '• When given a set of data, the points will look scattered on a coordinate plane.\n' +
        '• Since the points are scattered, we must perform a linear regression to find the "line of best fit".\n' +
        '• The line of best fit will help us determine the slope and y-intercept.\n' +
        '• To calculate the line of best fit, we use the graphing calculator!\n' +
        '1. Click **STAT** > **EDIT**\n' +
        '2. Enter the first set of data into L1 (**x-values**). Enter the second set of data into L2 (**y-values**).\n' +
        '3. Click **STAT** > **CALC** > **4: LinReg (ax+b)** > **ENTER**\n' +
        '4. Hit ENTER 5 times (or 1 TIME on the Calculate84 app)\n\n' +
        '**Correlation Coefficient:** The "r" value represents the correlation coefficient. It tells you how strong or weak the correlation between two variables are.',
    },
  ],
  '5.4': [
    {
      title: 'Solving Systems of Linear Equations by Graphing',
      body:
        '• **"Systems"** means 2 or more equations.\n' +
        '• We **solve** a system of linear equations by finding the **point of intersection**. Point of intersection is where the ***two lines touch***.\n\n' +
        '**Example:** Solve the system by graphing: $x+y=-3$ and $-2x+y=-3$\n\n' +
        '**STEP 1:** Write both equations in slope-intercept form (**y=mx+b**) if needed.\n' +
        '**STEP 2:** Graph both equations. Feel free to copy down the table for both equations as well!\n' +
        '**STEP 3:** LOOK FOR POINT OF INTERSECTION!\n' +
        '**STEP 4:** *\\*OPTIONAL\\** Check your work by substituting the point into both equations. The point MUST satisfy both equations.\n\n' +
        '*Solution: (0,−3) — \\*solution is the answer\\**',
    },
    {
      title: 'Solving Systems of Linear Equations by Substitution',
      body:
        '• Recall that "systems" means ***two or more*** equations.\n' +
        '• When solving a system of equations, we want to find the **point of intersection**, known as the SOLUTION.\n' +
        '• The **substitution method** is another way we can find the solution of a system.\n\n' +
        'The substitution method requires THREE STEPS.\n\n' +
        '**Example:** Solve the system by substitution: $-3x+y=1$ and $4x+y=8$ — *the solution is (1,4)*.',
    },
  ],
  '5.5': [
    {
      title: 'Solving Systems of Linear Equations by Elimination',
      body:
        '**EXAMPLE #1:** $3x+8y=7$ and $2x-2y=-10$\n\n' +
        '**1)** First thing you want to ask yourself: *Are BOTH my equations in standard form? ($Ax+By=C$)* **Yes they are! Let\'s move on.**\n' +
        '**2)** Next, ask yourself: Do I see opposite coefficients? If not, multiply one or both equations by a constant to create opposite coefficients. *I didn\'t see opposite coefficients, so I multiplied the second equation by 4: $8x-8y=-40$. This will allow me to ELIMINATE the $8y$ and $-8y$.*\n' +
        '**3)** Add your new equations together and solve for the remaining variable!\n' +
        '**4)** Take the value you found in the previous step and substitute it into EITHER original equation! *Solution: (−3, 2)*\n\n' +
        '**EXAMPLE #2:** $-3x+9y=-3$ and $4x-13y=5$\n\n' +
        '**STEP 1:** Choose a variable you want to eliminate and find the LCM of their coefficients. *Since 12 is the LCM, we want our system to have $-12x$ and $12x$.*\n' +
        '**STEP 2:** Multiply the first equation by 4. Multiply the second equation by 3.\n' +
        '**STEP 3:** Add the **new equations** and solve for the variable.\n' +
        '**STEP 4:** Substitute the value from the previous step into any of the original equations, then solve! *SOLUTION: (−2, −1)*',
    },
    {
      title: 'Systems — Cumulative Review (choosing a method)',
      body:
        'Recall that there are three methods we can use to solve a system of linear equations: **1. Graphing 2. Substitution 3. Elimination**\n\n' +
        'It does not matter which method we use! However, some methods are easier to use than others, depending on the system you are given.\n\n' +
        '**GRAPHING** — easier when ***BOTH*** equations are written in **slope-intercept form** (y=mx+b). *Example: $y=2x+5$, $y=-x+3$*\n' +
        '**SUBSTITUTION** — easier when at least *one* of the **variables** is already **isolated**. *Example: $x=-2y+6$, $2x+3y=5$*\n' +
        '**ELIMINATION** — easier when ***BOTH*** equations are written in **standard form** (Ax+By=C). *Example: $3x+6y=9$, $2x-6y=1$*',
    },
    {
      title: 'Graphing Linear Inequalities & Systems of Inequalities',
      body:
        'When graphing linear inequalities:\n' +
        '1. Make sure the inequality is written in **slope-intercept form**. If it\'s not, rewrite the inequality into mx+b form!\n' +
        '2. **Graph** the inequality in your calculator and **plot** the points.\n' +
        '3. Ask yourself **TWO** questions: Is my line going to be DASHED or SOLID? Am I going to shade below or above the line?\n\n' +
        '• **Solutions** to an inequality are ordered pairs located in the **shaded region** of the graph.\n' +
        '• Ordered pairs on a **solid line** are also **solutions** to an inequality.\n' +
        '• Ordered pairs on a **dashed line** are ***NOT* solutions** to an inequality.\n\n' +
        'When graphing a **system of inequalities**:\n' +
        '• Make sure that **BOTH** inequalities are written in slope-intercept form.\n' +
        '• Graph each inequality on a coordinate plane. Label both lines.\n' +
        '• **Label** where the two shadings **overlap** with an "**S**" for the solution set.\n\n' +
        'REMEMBER: If a point is located on a **dashed line**, the point is **NOT** a part of the solution set. If the point is located on a **solid line**, the point **IS** a part of the solution set.',
    },
  ],
  '6.1': [
    {
      title: 'Graphing Exponential Functions',
      body:
        '• Graphing exponential functions is like graphing linear functions:\n' +
        '1. Type the expression into Desmos.\n' +
        '2. Go to the table of values to find some points.\n' +
        '3. Plot and connect the points.\n\n' +
        '• While linear functions form a straight line, ALL **exponential functions** form a **curve**.\n\n' +
        '**EXAMPLE 1:** Make a table of values for the function $f(x)=3^x$ and graph the function.\n' +
        '*Remember… the graph should be a curve, should get close to, but not touch, the x-axis, and has arrows on both ends.*',
    },
    {
      title: 'Writing Exponential Functions',
      body:
        '• Exponential functions can be written in the form of $f(x)=ab^x$ where "**a**" represents the original value (y-intercept) and the "**b**" represents the constant ratio. *You can think of the constant ratio as like the slope.*\n\n' +
        '**WORD PROBLEM EXAMPLE:** The number of a certain bacteria doubles in a lab culture every hour. Suppose there are 500 bacteria to start an experiment.\n' +
        '1. **Write an equation** for the number of bacteria f(x), as a function of the number of hours, x.\n' +
        '2. Use the function to determine the number of bacteria in **5 hours**.',
    },
  ],
  '6.2': [
    {
      title: 'Exponential Growth vs Decay',
      body:
        '• The **original** exponential formula that we\'ve learned so far is $y=ab^x$ where "**a**" represents the **original amount** and "**b**" represents the **constant ratio** (*how much something changes over time*). This formula works best when something decreases by a half, or when something doubles or triples over time.\n' +
        '• But when something grows or decreases by a ***constant percentage***, we use the **exponential growth** or **exponential decay** formula!\n\n' +
        '**EXPONENTIAL GROWTH:** The number of COVID cases in Jamaica Queens increases at a rate of 2.5% every week. The original amount of COVID cases was 25. a) Write an exponential function to model this situation. b) Find the number of COVID cases in 5 weeks.\n\n' +
        '**EXPONENTIAL DECAY:** The value of the iPhone 11 Pro Max will decrease at a rate of 20% each year. When the iPhone 11 Pro Max first came out, it had a value of \\$1,100. a) Write an exponential function to model this situation. b) Find the value of the iPhone 11 Pro Max in 3 years.',
    },
    {
      title: 'Linear vs Exponential',
      body:
        '**LINEAR**\n' +
        '• Forms a straight line on a graph.\n' +
        '• Increases or decreases at a constant rate of addition or subtraction.\n' +
        '• Linear functions can be written in y=mx+b (slope-intercept form) or Ax+By=C (standard form).\n' +
        '• In a word problem, look for a constant adding or subtracting change.\n\n' +
        '**EXPONENTIAL**\n' +
        '• Forms a curve on a graph.\n' +
        '• Increases or decreases at a constant rate of multiplication.\n' +
        '• Exponential functions are written in the form of $y=ab^x$ or $y=a(1 \\pm r)^t$.\n' +
        '• In a word problem, look for double, triple, or percent.',
    },
  ],
  '7.1': [
    {
      title: 'Greatest Common Factor (GCF) of Monomials',
      body:
        '• **Recall:** A monomial is an expression that consists of one term. The coefficient of a monomial is the number in front of the variable.\n\n' +
        '**How can we find the GCF of monomials?**\n' +
        '**Step 1:** Find the GCF of the coefficients.\n' +
        '**Step 2:** Determine the greatest number of the **same variables** they have in common.\n\n' +
        '**EXAMPLE 1:** Find the GCF of the monomials $6x^2$ and $9x^3$.\n' +
        '***The GCF of the coefficients is 3. Both monomials have at least two x\'s. So the GCF is $3x^2$.***',
    },
    {
      title: 'Factoring Polynomials by using GCF',
      body:
        '**How do I factor a polynomial?**\n\n' +
        '**STEP 1:** Find the GCF of each term.\n' +
        '**STEP 2:** Divide each term by that GCF.\n' +
        '• *\\*HINT 1: Divide the coefficients.\\**\n' +
        '• *\\*HINT 2: Subtract the exponents.\\**\n\n' +
        '**EXAMPLE 1:** Factor the polynomial $12x^4-6x^3+3x^2$\n\n' +
        '**CHECK YOUR WORK \\*OPTIONAL\\*:** Distribute the GCF to each term in the parenthesis to check if you end up with the original polynomial.',
    },
  ],
  '7.2': [
    {
      title: 'Factoring Trinomials when a=1',
      body:
        'When you need to factor a polynomial written in the form $x^2+bx+c$ you want to do the following things:\n\n' +
        '**1)** Identify the ***a-value, b-value, c-value***.\n' +
        '**2)** List out the **factors** of "**c**" then ask yourself: "what **multiplies** to "c" and **adds** to "b"?"\n' +
        '**3)** Set up your binomial factors with those two integers. *In this example, the two integers were −10 and +3.*\n' +
        '**\\*OPTIONAL\\*** Use FOIL to check if you factored correctly!',
    },
    {
      title: 'Factoring a Difference of Squares (DOTS METHOD)',
      body:
        '• When using the DOTS method…\n' +
        '  • Make sure that **both** terms are **PERFECT SQUARES!!!**\n' +
        '  • There is a **subtraction sign** in between the two perfect squares.\n' +
        '• Examples: $4x^2-9$, $16x^4-9y^4$, $x^2-64$\n\n' +
        '**Example of factoring a difference of two squares:**\n' +
        '**1)** Is there a GCF besides 1? If so, factor it out!\n' +
        '**2)** Factor each perfect square term.\n' +
        '**3)** Set up the two binomials: make sure one has a **"+" sign** and the other has a **"−" sign**.\n' +
        '**4)** OPTIONAL: Check work by FOILing!',
    },
    {
      title: 'Factoring Polynomials: Mixed Practice',
      body:
        '• Always ask yourself: "Is there a GCF besides 1?"\n' +
        '  • **DOTS method**: if the expression has 2 terms (two perfect squares being subtracted).\n' +
        '  • **Trinomial when a=1** ($x^2+bx+c$): Find the factors of "**c**" then determine "what multiplies to "c" and adds to "b"?"',
    },
  ],
  '8.1': [
    {
      title: 'Solving ax²−c=0 using Square Roots',
      body:
        'You can use the **square roots method** when solving a quadratic equation in this form: $ax^2-c=0$\n\n' +
        'The square root method involves the following steps:\n' +
        '1. **Add/subtract** the constant (or c-value) on both sides.\n' +
        '2. **Divide** both sides by the coefficient (a-value).\n' +
        '3. **Square root** both sides!\n\n' +
        '**EXAMPLE 1:** First, we add both sides by 4. Secondly, we square root both sides.\n' +
        '**EXAMPLE 2:** First, we add 100 on both sides. Secondly, we divide both sides by 4. Finally, we square root both sides!',
    },
    {
      title: 'Solving a(x+b)²=c using Square Roots',
      body:
        'You can use the **square roots method** when solving a quadratic equation in this form: $a(x+b)^2=c$\n\n' +
        '**EXAMPLE 1:** Solve $(x-7)^2=64$ for all values of x.\n' +
        '**1)** We **square root** both sides to help us get rid of the exponent and the parenthesis!\n' +
        '**2)** We create two separate equations: one equation will **equal to 8** and the other equation will **equal to −8**.\n' +
        '**3)** For each equation, **add 7** on both sides! You will end up with **two different solutions**!\n\n' +
        '**EXAMPLE 2:** Solve $3(x-5)^2=18$ for all values of x.\n' +
        '**1) Divide** both sides by 3. **2) Square root** both sides. **3)** Create two separate equations: one equal to $\\sqrt{6}$ and the other equal to $-\\sqrt{6}$. **In each equation, add 5 to both sides.**',
    },
  ],
  '8.2': [
    {
      title: 'Solving Quadratic Equations by Factoring (a=1)',
      body:
        'When solving a quadratic equation by factoring…\n\n' +
        '1. Make sure the equation is written in **standard form**. If not, use inverse operations to re-write it in $ax^2+bx+c=0$ form.\n' +
        '2. If **a=1**, ask yourself: What **multiplies** to "**c**" but **adds** to "**b**"?\n' +
        '3. Set up your binomials then use the **Zero Product Property** to solve for x!\n\n' +
        '**EXAMPLE 1:** Solve the equation for all values of x by factoring: $x^2-9x=-14$\n\n' +
        '**Example 2:** Find the zeros of the function by factoring: $f(x)=x^2+3x-4$ — *"Find the zeros" means to determine the value of "x" when f(x)=0.*',
    },
    {
      title: 'Solving Quadratics by Completing the Square',
      body:
        '**What is completing the square?**\n' +
        '• Completing the square is another method to solve quadratic equations.\n' +
        '• This method is useful when you encounter a quadratic equation that is not factorable.\n\n' +
        '**How do we use the method of completing the square?**\n' +
        '1. **Isolate** the terms that have an "x" on the left side of the equation.\n' +
        '2. Take half of the "b" term, then square it. Add that number to both sides of the equation. (**Half–Square–Share**)\n' +
        '3. **Factor** the left side. **Simplify** the right side.\n' +
        '4. Take the **square root** of both sides.\n' +
        '5. **Solve** for x.\n\n' +
        '*\\*\\*This method can only be used when a=1. If "a" does not equal 1, divide each term by the "a" value and then proceed with completing the square.\\*\\**\n\n' +
        '**EXAMPLE:** Solve the following quadratic equation $x^2+14x-15=0$ by **completing the square**.',
    },
    {
      title: 'Solving Quadratics using the Quadratic Formula',
      body:
        '• Using the quadratic formula to solve quadratics is a method that **ALWAYS** works!\n' +
        '• In order to use the formula…\n' +
        '  **1)** Make sure that your equation is in **standard form**.\n' +
        '  **2)** Identify the **a**, **b**, and **c-value**.\n' +
        '  **3)** **Substitute** those values into the formula $x=\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$.\n' +
        '  **4)** **Simplify**!\n\n' +
        '**EXAMPLE 1:** Solve the equation $2x^2+3x-5=0$ using the **quadratic formula**.\n' +
        '**EXAMPLE 2:** Solve the equation $2x=x^2-4$ using the **quadratic formula**.',
    },
  ],
  '8.3': [
    {
      title: 'Graphing Quadratic Functions',
      body:
        '• When graphing a quadratic equation, your function will ALWAYS form a U-shaped curve. This shape is called a **PARABOLA**.\n' +
        '  • Sometimes the parabola will open **UPWARDS** or open **DOWNWARDS**.\n' +
        '• The turning point of your parabola is called the **VERTEX**.\n\n' +
        '**EXAMPLES:** Graph $f(x)=x^2+1$ — *the parabola opens upwards; the vertex is (0,1).* Graph $f(x)=-x^2-4x-1$ — *the parabola opens downwards; the vertex is (−2,3).*',
    },
    {
      title: 'Identifying the VERTEX (graph, table, vertex-form)',
      body:
        '**Graph:** Look for the lowest or highest point.\n\n' +
        '**Table:** Look for the smallest or highest y-value. The y-values around the vertex are symmetrical.\n\n' +
        '**Vertex-Form Equation:** Vertex-form equations are written in $y=a(x-h)^2+k$ where **(h,k)** represents the vertex.',
    },
    {
      title: 'Completing the Square to Identify the Vertex',
      body:
        '• Recall that it\'s SUPER EASY to identify the **vertex** when our equation is written in **vertex-form**: $y=a(x-h)^2+k$ where **(h,k)** is the vertex.\n' +
        '• If our quadratic equation is ***NOT*** in **vertex-form**, we can use the "**completing the square**" method to help us!\n\n' +
        '**EXAMPLE:** Determine and state the vertex of $f(x)=x^2-2x-8$ using the method of completing the square.',
    },
    {
      title: 'Minimum vs Maximum',
      body:
        '• Every parabola has either a **highest point** or a **lowest point** (**VERTEX**).\n' +
        '• The y-value of the vertex is the **MINIMUM VALUE** or **MAXIMUM VALUE**.\n\n' +
        'If the a-value is positive, the parabola opens upwards (minimum). If the a-value is negative, the parabola opens downwards (maximum).\n\n' +
        '*\\*Don\'t forget that you can always graph the equation on the calculator to determine if your parabola opens upwards or downwards.\\**',
    },
    {
      title: 'Axis of Symmetry',
      body:
        'The axis of symmetry is:\n' +
        '• a vertical line that splits your parabola in half.\n' +
        '• the vertical line passes through the vertex.\n' +
        '• there are three ways you can find the axis of symmetry.\n\n' +
        '**METHOD 1: Line of Symmetry** — When given a graph, you can draw a vertical line through the vertex. The x-value of your vertex is the axis of symmetry. *Example: the axis of symmetry is x = 3.*\n\n' +
        '**METHOD 2: Average of Roots/X-intercepts/Zeros** — If your parabola touches the x-axis two times, you can find the average of those two x-values. The points where the parabola touches the x-axis are called the *roots*, the *x-intercepts*, or the *zeros*.\n\n' +
        '**METHOD 3: If you\'re given an equation in Standard Form…** — Use the formula $x=\\frac{-b}{2a}$ by substituting the "b" and "a" value and simplifying!',
    },
    {
      title: 'Identifying the Zeros/X-intercepts/Roots',
      body:
        '• The point where the parabola touches the x-axis are called the *roots*, the *x-intercepts*, or the *zeros*.\n' +
        '• A quadratic function (parabola) can either have one, two, or no zeros!\n\n' +
        '*Examples: $y=x^2-x-2$ → **TWO ZEROS**. $y=-2x^2+4x-2$ → **ONE ZERO**. $y=\\frac{1}{4}x^2+1$ → **NO ZEROS**.*',
    },
  ],
  '8.4': [
    {
      title: 'Examples of Real-World Quadratics',
      body:
        '**Tips when solving real-world quadratics:**\n\n' +
        '**Tip 1:** The zeros/roots/x-intercepts is usually when the object is on the ground. The height or y-value is 0.\n' +
        '**Tip 2:** The vertex is when the object reaches its maximum height above the ground.\n' +
        '**Tip 3:** Inputting the quadratic equation into the graphing calculator & going to the table of values is a great method to help you solve real world quadratic problems!\n\n' +
        '**Example of a real-world problem!** A ball is thrown into the air from the ground. The height h(t), of the ball above the ground t seconds after it is thrown can be modeled by $h(t)=-16t^2+64t$. How many seconds after being thrown will the ball hit the ground?\n\n' +
        '**It will take the ball 4 seconds to hit the ground.**',
    },
    {
      title: 'System of Linear & Quadratic Equations',
      body:
        '**How do I use my graphing calculator to find the points of intersection?**\n\n' +
        '**STEP 1:** Type in the two expressions.\n' +
        '**STEP 2:** Go to the table of values. To find the points of intersection, you want to find where the y-values for both functions are the same.\n\n' +
        '*In this example, the points of intersection are (−2,−8) and (1,−2).*',
    },
  ],
  '9.1': [
    {
      title: 'Transforming Functions',
      body:
        '**Quadratics:** $y=x^2$ → $y=a(x-h)^2+k$\n' +
        '**Absolute Value:** $y=|x|$ → $y=a|x-h|+k$\n' +
        '**Square Roots:** $y=\\sqrt{x}$ → $y=a\\sqrt{x-h}+k$\n\n' +
        'For all three families:\n' +
        '• **−a** → flips upside down (parabola/v-shape/curve).\n' +
        '• **a > 1** → narrower (vertical stretch).\n' +
        '• **0 < a < 1** → wider (vertical compression).\n' +
        '• **(x−h)** → shift right. **(x+h)** → shift left.\n' +
        '• **+k** → shift up. **−k** → shift down.',
    },
  ],
  '9.2': [
    {
      title: 'Identifying Quadratic vs Exponential vs Linear Functions',
      body:
        '**QUADRATIC:** ALL quadratic functions can be written in the form $y=ax^2+bx+c$. ALL quadratic functions have an **x variable** with an **exponent of 2** (highest power of x is 2). *Examples: $y=x^2+6x+12$, $y=2x^2-8$.*\n\n' +
        '**EXPONENTIAL:** ALL exponential functions can be written in the form $y=ab^x$. ALL exponential functions have an **exponent of x**. *Examples: $y=2^x$, $y=100(3)^x+2$, $y=50(\\frac{1}{2})^x$.*\n\n' +
        '**LINEAR:** ALL linear functions can be written in the form y=mx+b or $Ax+By=C$. ALL linear functions have an **x variable** with an **exponent of 1** (highest power of x is 1). *Examples: $y=x+5$, $y=\\frac{1}{3}x-6$, $2x+3y=8$.*',
    },
    {
      title: 'Piecewise Functions',
      body:
        '**Piecewise Functions:** a **function** made up of pieces of different **functions** over different intervals.\n\n' +
        '*Example:*\n' +
        '$y=x+2$ for $x<1$ — *the first point at (1,3) has an **open** circle. The rest of the points consist of x-values that are less than 1.*\n\n' +
        '$y=(x-1)^2$ for $x \\ge 1$ — *the first point at (1,0) has a **closed** circle. The rest of the points consist of x-values greater than 1.*',
    },
  ],
};
