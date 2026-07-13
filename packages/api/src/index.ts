import { router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { calculatorRouter } from './routers/calculator.js';
import { curriculumRouter } from './routers/curriculum.js';
import { practiceRouter } from './routers/practice.js';
import { progressRouter } from './routers/progress.js';
import { regentsRouter } from './routers/regents.js';
import { tutorRouter } from './routers/tutor.js';

export const appRouter = router({
  auth: authRouter,
  calculator: calculatorRouter,
  curriculum: curriculumRouter,
  practice: practiceRouter,
  progress: progressRouter,
  regents: regentsRouter,
  tutor: tutorRouter,
});

export type AppRouter = typeof appRouter;

export { createContext, type Context } from './trpc.js';
export type { AuthUser, Role, Locale } from './auth.js';
