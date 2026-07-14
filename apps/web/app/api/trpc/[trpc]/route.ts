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
    // Emit any Set-Cookie strings the auth mutations collected on the context
    // (the httpOnly refresh cookie on web). `tutor.sendMessage` is the only
    // streamed procedure and never sets cookies, so this can't collide with it.
    responseMeta({ ctx }) {
      const cookies = ctx?.cookies ?? [];
      if (cookies.length === 0) return {};
      const headers = new Headers();
      for (const cookie of cookies) headers.append('set-cookie', cookie);
      return { headers };
    },
    onError({ error, path }) {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`trpc error on ${path}:`, error);
      }
    },
  });

export { handler as GET, handler as POST };
