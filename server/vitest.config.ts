import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://tutor:tutor@localhost:5432/algebra_tutor_test',
      JWT_SECRET: 'test-secret',
    },
    // API tests share one database; run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
