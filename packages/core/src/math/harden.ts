/**
 * Security hardening for the shared mathjs instances (docs/security-review-2.md
 * M4). Grading runs `math.evaluate` / `.compile().evaluate()` on student input
 * SERVER-SIDE (see engine.ts `numericWithin`, reached from practice.attempt),
 * and mathjs exposes matrix/range constructors that allocate memory
 * proportional to their (attacker-chosen) arguments. A submission like
 * `ones(30000,30000)` or `range(1,2e8)` — trivially under the 2000-char input
 * cap — allocates gigabytes and OOM-kills the serverless function, an
 * unauthenticated-cost DoS on an endpoint that isn't rate-limited.
 *
 * mathjs 13 already blocks the classic `constructor` RCE chain in the parser,
 * so this is about resource exhaustion, not code execution. We disable the
 * expression-reachable allocation/creation functions (and the config-mutating
 * `import`/`createUnit`) by importing throwing stubs. This is a denylist of
 * things a middle-school algebra answer never legitimately contains, so it
 * doesn't affect grading. Crucially it does NOT touch the JS-level APIs the
 * engine relies on (`math.parse`, `math.evaluate`, `node.compile`,
 * `math.format`) — only the same-named *functions callable from inside an
 * evaluated expression*.
 */
import type { MathJsInstance } from 'mathjs';

/**
 * Functions that allocate/iterate a structure whose size comes from their
 * arguments, plus the config-mutating ones. Disabling `range` also closes the
 * `a:b` range operator, which compiles to a `range` call.
 */
const DISABLED = [
  // structure constructors (memory ∝ arguments)
  'matrix', 'sparse', 'ones', 'zeros', 'identity', 'range', 'diag', 'kron',
  'concat', 'resize', 'reshape', 'fill', 'flatten', 'rotate',
  // randomness (also cheap to spam, and non-deterministic in grading)
  'random', 'randomInt', 'pickRandom',
  // config / environment mutation — never needed from an expression
  'import', 'createUnit',
] as const;

/**
 * Disable the denylisted functions on an instance by overriding them with a
 * throwing stub. Call AFTER any legitimate `instance.import(...)` setup (e.g.
 * the degree-trig overrides), since it disables `import` too.
 */
export function hardenMathInstance(instance: MathJsInstance): void {
  const stubs: Record<string, () => never> = {};
  for (const name of DISABLED) {
    stubs[name] = () => {
      throw new Error(`"${name}" is disabled`);
    };
  }
  instance.import(stubs, { override: true });
}
