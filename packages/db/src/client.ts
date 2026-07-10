import { PrismaClient } from '@prisma/client';

const DEFAULT_URL = 'postgres://tutor:tutor@localhost:5432/algebra_tutor';

// Zero-config default for local dev; production sets DATABASE_URL.
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = DEFAULT_URL;

/** One PrismaClient per process (Next.js dev hot-reload safe). */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
