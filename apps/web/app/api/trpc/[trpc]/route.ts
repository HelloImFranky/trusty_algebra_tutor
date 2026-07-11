/** tRPC over Next.js route handlers — the whole API lives on one URL. */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from '@tutor/api';

// On Vercel, give streaming tutor-chat responses room beyond the default
// function timeout (60s is within every plan's allowance).
export const maxDuration = 60;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ headers: req.headers }),
    onError({ error, path }) {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`trpc error on ${path}:`, error);
      }
    },
  });

export { handler as GET, handler as POST };
