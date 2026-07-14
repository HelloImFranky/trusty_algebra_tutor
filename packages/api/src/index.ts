import { router } from './trpc.js';
import { adminRouter } from './routers/admin.js';
import { authRouter } from './routers/auth.js';
import { calculatorRouter } from './routers/calculator.js';
import { curriculumRouter } from './routers/curriculum.js';
import { practiceRouter } from './routers/practice.js';
import { progressRouter } from './routers/progress.js';
import { regentsRouter } from './routers/regents.js';
import { teacherRouter } from './routers/teacher.js';
import { tutorRouter } from './routers/tutor.js';

export const appRouter = router({
  admin: adminRouter,
  auth: authRouter,
  calculator: calculatorRouter,
  curriculum: curriculumRouter,
  practice: practiceRouter,
  progress: progressRouter,
  regents: regentsRouter,
  teacher: teacherRouter,
  tutor: tutorRouter,
});

export type AppRouter = typeof appRouter;

export { createContext, type Context } from './trpc.js';
export type { AuthUser, Role, Locale, AccountStatus } from './auth.js';
