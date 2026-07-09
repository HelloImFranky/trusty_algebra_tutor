export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://tutor:tutor@localhost:5432/algebra_tutor',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  accessTokenTtl: '20m',
  refreshTokenTtlDays: 7,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8',
  tutorMaxTurns: Number(process.env.TUTOR_MAX_TURNS ?? 12),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};
