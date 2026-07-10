/**
 * LLM tutor chat (design doc §4.2 step 4): the escalation path after the
 * deterministic hint ladder. Consumes the tRPC async-generator mutation —
 * token-by-token on runtimes with streaming fetch, buffered elsewhere.
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { Input, Text, XStack, YStack } from 'tamagui';
import { client } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { MathText } from './MathText';
import { AppCard, PrimaryButton, SubTitle, COLORS } from './ui';

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
  const { t, locale } = useI18n();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    client.tutor.createSession
      .mutate({ lessonId, problemId })
      .then((r) => setSessionId(r.sessionId))
      .catch(() => {});
  }, [lessonId, problemId]);

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !sessionId || busy) return;
    const text = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setBusy(true);
    try {
      const stream = await client.tutor.sendMessage.mutate({
        sessionId,
        message: text,
        stepReached,
        locale,
      });
      for await (const chunk of stream) {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: 'assistant',
            content: copy[copy.length - 1].content + chunk,
          };
          return copy;
        });
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
    <AppCard>
      <SubTitle>🤖 {t('askTutor')}</SubTitle>
      <ScrollView ref={scroll} style={{ maxHeight: 280 }}>
        <YStack gap={8} paddingVertical={8}>
          {messages.map((m, i) => (
            <XStack
              key={i}
              alignSelf={m.role === 'user' ? 'flex-end' : 'flex-start'}
              backgroundColor={m.role === 'user' ? '#eef1fd' : '#f8f9fa'}
              borderRadius={12}
              padding={10}
              maxWidth="88%"
            >
              <MathText text={m.content || '…'} size={14} />
            </XStack>
          ))}
        </YStack>
      </ScrollView>
      <XStack gap={8} marginTop={6}>
        <Input
          flex={1}
          value={input}
          placeholder={t('tutorPlaceholder')}
          onChangeText={setInput}
          onSubmitEditing={send}
          editable={!busy}
          borderColor={COLORS.border}
          backgroundColor="#fff"
        />
        <PrimaryButton onPress={send} disabled={busy || !input.trim()}>
          ➤
        </PrimaryButton>
      </XStack>
      {!busy && messages.length === 0 && (
        <Text fontSize={12} color={COLORS.muted} marginTop={6}>
          {t('tutorPlaceholder')}
        </Text>
      )}
    </AppCard>
  );
}
