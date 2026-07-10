import { describe, expect, it } from 'vitest';
import { parseOpenAiSseLine } from './providers.js';

describe('OpenAI-compatible SSE parsing', () => {
  it('extracts a content delta', () => {
    const line = 'data: {"choices":[{"delta":{"content":"Let"}}]}';
    expect(parseOpenAiSseLine(line)).toBe('Let');
  });

  it('handles the completions-style {text} shape (some HF/vLLM servers)', () => {
    const line = 'data: {"choices":[{"text":" us"}]}';
    expect(parseOpenAiSseLine(line)).toBe(' us');
  });

  it('recognizes the terminal marker', () => {
    expect(parseOpenAiSseLine('data: [DONE]')).toBe('done');
  });

  it('ignores role-only openers, empty deltas, keep-alives, and comments', () => {
    expect(parseOpenAiSseLine('data: {"choices":[{"delta":{"role":"assistant"}}]}')).toBeNull();
    expect(parseOpenAiSseLine('data: {"choices":[{"delta":{"content":""}}]}')).toBeNull();
    expect(parseOpenAiSseLine(': keep-alive')).toBeNull();
    expect(parseOpenAiSseLine('')).toBeNull();
    expect(parseOpenAiSseLine('event: message')).toBeNull();
  });

  it('does not throw on malformed JSON', () => {
    expect(parseOpenAiSseLine('data: {not json')).toBeNull();
  });

  it('reassembles a full streamed reply', () => {
    const stream = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}',
      'data: {"choices":[{"delta":{"content":"STEP 1"}}]}',
      'data: {"choices":[{"delta":{"content":": substitute"}}]}',
      ': keep-alive',
      'data: {"choices":[{"delta":{"content":" −4 for x."}}]}',
      'data: [DONE]',
    ];
    let out = '';
    for (const line of stream) {
      const parsed = parseOpenAiSseLine(line);
      if (parsed === 'done') break;
      if (parsed) out += parsed;
    }
    expect(out).toBe('STEP 1: substitute −4 for x.');
  });
});
