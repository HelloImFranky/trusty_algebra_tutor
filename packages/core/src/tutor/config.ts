/**
 * Tutor LLM provider configuration, from environment only (no filesystem):
 * 'anthropic' | 'openai' | 'none', or empty = auto-detect (Anthropic if its
 * key is set, else an OpenAI-compatible endpoint if one is configured, else
 * the built-in hint ladder). 'openai' covers any OpenAI-compatible chat API:
 * Hugging Face Inference (free), self-hosted Ollama / vLLM / TGI / LM Studio,
 * OpenAI, OpenRouter, etc.
 */
export const tutorConfig = {
  tutorProvider: (process.env.TUTOR_PROVIDER ?? '').trim().toLowerCase(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  // Haiku 4.5 is the tutor default: fast + cheap, and plenty for guiding a
  // student through a hint (grading stays in the deterministic math engine).
  // Override with ANTHROPIC_MODEL to run a larger model. See
  // docs/tutor-anthropic-haiku-plan.md.
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5',
  // OpenAI-compatible endpoint. Defaults to the Hugging Face router; point it
  // at http://localhost:11434/v1 for a self-hosted Ollama model, etc.
  tutorBaseUrl: (process.env.TUTOR_BASE_URL ?? 'https://router.huggingface.co/v1').replace(/\/+$/, ''),
  tutorBaseUrlSet: Boolean(process.env.TUTOR_BASE_URL),
  tutorModel: process.env.TUTOR_MODEL ?? 'Qwen/Qwen2.5-7B-Instruct',
  // Any of these serve as the bearer token for the OpenAI-compatible endpoint.
  tutorApiKey:
    process.env.TUTOR_API_KEY ??
    process.env.HF_TOKEN ??
    process.env.HUGGINGFACE_API_KEY ??
    process.env.OPENAI_API_KEY ??
    '',
  tutorMaxTurns: Number(process.env.TUTOR_MAX_TURNS ?? 12),
};
