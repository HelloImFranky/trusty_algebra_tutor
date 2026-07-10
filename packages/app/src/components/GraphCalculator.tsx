/**
 * Native graphing calculator: renders function-plot inside a WebView (one
 * WebView for the whole graph — cheap, and pinch-zoom comes free).
 */
import { useMemo, useState } from 'react';
import { WebView } from 'react-native-webview';
import { Input, Text, XStack, YStack } from 'tamagui';
import { AppCard, GhostButton, SecondaryButton } from './ui';

const html = (fns: string[]) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://unpkg.com/function-plot/dist/function-plot.js"></script>
<style>body{margin:0;display:flex;justify-content:center}</style></head>
<body><div id="p"></div><script>
try {
  functionPlot({
    target: '#p', width: window.innerWidth, height: 380, grid: true,
    xAxis: { domain: [-10, 10] }, yAxis: { domain: [-10, 10] },
    data: ${JSON.stringify(
      fns.filter((f) => f.trim()).map((fn, i) => ({
        fn: fn.replace(/y\s*=/, '').trim(),
        color: ['#3b5bdb', '#e8590c', '#0ca678'][i % 3],
      })),
    )}
  });
} catch (e) { document.body.innerHTML = '<p style="font-family:sans-serif;padding:12px">Could not plot — check the expression (example: 2x+3, x^2-4)</p>'; }
</script></body></html>`;

export function GraphCalculator({ initial = 'x^2' }: { initial?: string }) {
  const [fns, setFns] = useState<string[]>([initial]);
  const source = useMemo(() => ({ html: html(fns) }), [fns]);

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
      <YStack height={390} borderRadius={10} overflow="hidden">
        <WebView source={source} javaScriptEnabled originWhitelist={['*']} />
      </YStack>
    </AppCard>
  );
}
