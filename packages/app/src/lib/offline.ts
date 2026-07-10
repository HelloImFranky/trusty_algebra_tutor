/**
 * Offline attempt queue (design doc §6): practice answers submitted while
 * offline are stored locally and replayed when connectivity returns, so a
 * student on a bus doesn't lose work.
 */
import { client } from './trpc';
import { storage } from './storage';

const QUEUE_KEY = 'tutor.offlineQueue';

type AttemptInput = Parameters<typeof client.practice.attempt.mutate>[0];

async function readQueue(): Promise<AttemptInput[]> {
  try {
    const raw = await storage.get(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as AttemptInput[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(q: AttemptInput[]): Promise<void> {
  await storage.set(QUEUE_KEY, JSON.stringify(q));
}

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.message} ${err.cause ?? ''}` : String(err);
  return /fetch failed|network|Failed to fetch|Load failed|ECONNREFUSED/i.test(msg);
}

export type AttemptResult =
  | { queued: true }
  | ({ queued?: undefined } & Awaited<ReturnType<typeof client.practice.attempt.mutate>>);

/** Submit an attempt, queueing it locally if the network is unreachable. */
export async function attemptOrQueue(input: AttemptInput): Promise<AttemptResult> {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline) {
    await writeQueue([...(await readQueue()), input]);
    return { queued: true };
  }
  try {
    return await client.practice.attempt.mutate(input);
  } catch (err) {
    if (isNetworkError(err)) {
      await writeQueue([...(await readQueue()), input]);
      return { queued: true };
    }
    throw err;
  }
}

export async function flushQueue(): Promise<void> {
  const q = await readQueue();
  if (!q.length) return;
  await writeQueue([]);
  for (const item of q) {
    try {
      await client.practice.attempt.mutate(item);
    } catch {
      await writeQueue([...(await readQueue()), item]); // re-queue on failure
    }
  }
}

if (typeof window !== 'undefined' && 'addEventListener' in window) {
  window.addEventListener('online', () => void flushQueue());
}
