import { router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { curriculumRouter } from './routers/curriculum.js';
import { practiceRouter } from './routers/practice.js';
import { progressRouter } from './routers/progress.js';
import { tutorRouter } from './routers/tutor.js';

export const appRouter = router({
  auth: authRouter,
  curriculum: curriculumRouter,
  practice: practiceRouter,
  progress: progressRouter,
  tutor: tutorRouter,
});

export type AppRouter = typeof appRouter;

export { createContext, type Context } from './trpc.js';
export type { AuthUser, Role, Locale } from './auth.js';
