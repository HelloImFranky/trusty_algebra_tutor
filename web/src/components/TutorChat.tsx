/**
 * LLM tutor chat (design doc §4.2 step 4): the escalation path after the
 * deterministic hint ladder. Streams SSE from the backend proxy.
 */
import { useEffect, useRef, useState } from 'react';
import { api, getAuth } from '../api';
import { MathText } from './Katex';
import { useI18n } from '../i18n';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export function TutorChat({
  lessonId,
  problemId,
  stepReached,
}: {
  lessonId?: number;
  problemId?: number;
  stepReached?: number;
}) {
  const { t } = useI18n();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ sessionId: number }>('/api/tutor/sessions', {
      method: 'POST',
      body: JSON.stringify({ lessonId, problemId }),
    })
      .then((r) => setSessionId(r.sessionId))
      .catch(() => {});
  }, [lessonId, problemId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !sessionId || busy) return;
    const text = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setBusy(true);
    try {
      const auth = getAuth();
      const res = await fetch(`/api/tutor/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        },
        body: JSON.stringify({ message: text, stepReached }),
      });
      if (!res.ok || !res.body) throw new Error('tutor unavailable');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const ev of events) {
          const data = ev.replace(/^data: /, '').trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data) as { delta?: string };
            if (parsed.delta) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: copy[copy.length - 1].content + parsed.delta,
                };
                return copy;
              });
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: copy[copy.length - 1].content || '⚠️ Tutor unavailable — try the hints!',
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>🤖 {t('askTutor')}</h2>
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <MathText text={m.content || '…'} />
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #d1d5db' }}
          value={input}
          placeholder={t('tutorPlaceholder')}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={busy}
        />
        <button className="btn" onClick={send} disabled={busy || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}
