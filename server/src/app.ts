import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { curriculumRouter } from './routes/curriculum.js';
import { practiceRouter } from './routes/practice.js';
import { progressRouter } from './routes/progress.js';
import { tutorRouter } from './routes/tutor.js';

export function createApp(): express.Express {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api', curriculumRouter);
  app.use('/api', practiceRouter);
  app.use('/api', progressRouter);
  app.use('/api', tutorRouter);

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'validation', details: err.issues });
        return;
      }
      console.error(err);
      res.status(500).json({ error: 'internal error' });
    },
  );
  return app;
}
