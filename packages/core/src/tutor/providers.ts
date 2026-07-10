/**
 * Tutor LLM providers (design doc §4.2, §5). The tutor is provider-agnostic:
 * the scaffold-constrained system prompt, PII scrubbing, rate limits, turn
 * caps, and EN/ES all live in the service layer and are built the same way for
 * every provider. A provider only has to turn (system prompt + messages) into
 * a stream of text chunks.
 *
 * Providers:
 *   - 'openai'    OpenAI-compatible chat completions. Covers Hugging Face
 *                 Inference (free open models like Qwen2.5-Math), a self-hosted
 *                 model (Ollama / vLLM / TGI / LM Studio — free and private),
 *                 OpenAI, OpenRouter, etc.
 *   - 'anthropic' Claude via the Anthropic SDK.
 *   - none        No provider configured -> the service falls back to the
 *                 deterministic hint ladder (always works, no LLM needed).
 */
import Anthropic from '@anthropic-ai/sdk';
import { tutorConfig as config } from './config.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorProvider {
  name: 'anthropic' | 'openai';
  /** Human-readable model label for logs/health. */
  model: string;
  streamChat(system: string, messages: ChatMessage[]): AsyncGenerator<string>;
}

/* ------------------------------------------------------------------ */
/* Anthropic (Claude)                                                  */
/* ------------------------------------------------------------------ */

function anthropicProvider(): TutorProvider {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  return {
    name: 'anthropic',
    model: config.anthropicModel,
    async *streamChat(system, messages) {
      const stream = client.messages.stream({
        model: config.anthropicModel,
        max_tokens: 1024,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        // surfaced as a gentle redirect by the caller's guardrails
        throw new Error('refusal');
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* OpenAI-compatible (Hugging Face / Ollama / vLLM / OpenAI / ...)      */
/* ------------------------------------------------------------------ */

/**
 * Parse one SSE line from an OpenAI-compatible stream. Returns the text delta,
 * 'done' at the terminal marker, or null for keep-alives / non-data lines.
 * Pure + synchronous so it can be unit-tested without a network.
 */
export function parseOpenAiSseLine(line: string): string | 'done' | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const data = trimmed.slice(5).trim();
  if (!data) return null;
  if (data === '[DONE]') return 'done';
  try {
    const json = JSON.parse(data) as {
      choices?: { delta?: { content?: string }; text?: string }[];
    };
    const choice = json.choices?.[0];
    const delta = choice?.delta?.content ?? choice?.text ?? '';
    return delta || null;
  } catch {
    return null; // partial/keep-alive frame
  }
}

function openAiProvider(): TutorProvider {
  return {
    name: 'openai',
    model: config.tutorModel,
    async *streamChat(system, messages) {
      const res = await fetch(`${config.tutorBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.tutorApiKey ? { Authorization: `Bearer ${config.tutorApiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.tutorModel,
          messages: [{ role: 'system', content: system }, ...messages],
          stream: true,
          max_tokens: 1024,
          temperature: 0.3,
        }),
      });
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '');
        throw new Error(`tutor endpoint HTTP ${res.status}: ${detail.slice(0, 300)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          const parsed = parseOpenAiSseLine(line);
          if (parsed === 'done') return;
          if (parsed) yield parsed;
        }
      }
      // flush any trailing line
      const parsed = parseOpenAiSseLine(buffer);
      if (parsed && parsed !== 'done') yield parsed;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

function openAiConfigured(): boolean {
  return (
    config.tutorProvider === 'openai' ||
    Boolean(config.tutorApiKey) ||
    config.tutorBaseUrlSet
  );
}

/** The active tutor provider, or null when none is configured. */
export function getTutorProvider(): TutorProvider | null {
  const explicit = config.tutorProvider;
  if (explicit === 'none') return null;
  if (explicit === 'anthropic') {
    return config.anthropicApiKey ? anthropicProvider() : null;
  }
  if (explicit === 'openai') return openAiProvider();

  // auto-detect
  if (config.anthropicApiKey) return anthropicProvider();
  if (openAiConfigured()) return openAiProvider();
  return null;
}
