/**
 * Built-in graphing calculator (design doc §4.1): the syllabus points
 * students to a graphing calculator app — this embeds one so they don't
 * context-switch. Plots y = f(x) via function-plot (web).
 */
import { useEffect, useRef, useState } from 'react';
import functionPlot from 'function-plot';
import { Input, Text, XStack, YStack } from 'tamagui';
import { AppCard, Feedback, GhostButton, SecondaryButton } from './ui';

export function GraphCalculator({ initial = 'x^2' }: { initial?: string }) {
  const target = useRef<HTMLDivElement>(null);
  const [fns, setFns] = useState<string[]>([initial]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!target.current) return;
    try {
      target.current.innerHTML = '';
      functionPlot({
        target: target.current,
        width: Math.min(640, target.current.clientWidth || 640),
        height: 380,
        grid: true,
        xAxis: { domain: [-10, 10] },
        yAxis: { domain: [-10, 10] },
        data: fns
          .filter((f) => f.trim())
          .map((fn, i) => ({
            fn: fn.replace(/y\s*=/, '').trim(),
            color: ['#3b5bdb', '#e8590c', '#0ca678'][i % 3],
          })),
      });
      setError('');
    } catch {
      setError('Could not plot — check the expression (example: 2x+3, x^2-4)');
    }
  }, [fns]);

  return (
    <AppCard gap={8}>
      {fns.map((fn, i) => (
        <XStack key={i} alignItems="center" gap={8}>
          <Text fontWeight="700" width={38}>
            y{i + 1} =
          </Text>
          <Input
            flex={1}
            value={fn}
            onChangeText={(v) => setFns(fns.map((f, j) => (j === i ? v : f)))}
            placeholder="2x + 3"
            backgroundColor="#fff"
          />
        </XStack>
      ))}
      <XStack gap={8}>
        {fns.length < 3 && (
          <SecondaryButton size="$2" onPress={() => setFns([...fns, ''])}>
            + y{fns.length + 1}
          </SecondaryButton>
        )}
        {fns.length > 1 && (
          <GhostButton size="$2" onPress={() => setFns(fns.slice(0, -1))}>
            −
          </GhostButton>
        )}
      </XStack>
      {error ? <Feedback kind="warn">{error}</Feedback> : null}
      <YStack>
        <div ref={target} style={{ overflowX: 'auto' }} />
      </YStack>
    </AppCard>
  );
}
