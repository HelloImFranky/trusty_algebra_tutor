/**
 * Native graph viewport: the engine samples on the RN side, renderGraphSvg
 * builds the same markup as the web, and a WebView just displays it. Pan and
 * zoom come from the toolbar buttons in GraphView (windows regenerate the
 * SVG); pinch inside the WebView gives a free magnifier on top.
 */
import { useMemo, useState } from 'react';
import { WebView } from 'react-native-webview';
import { YStack } from 'tamagui';
import { renderGraphSvg } from './graphSvg';
import type { GraphPlotProps } from './GraphPlot.web';

export function GraphPlot({ fns, window: win, markers, height = 380 }: GraphPlotProps) {
  const [width, setWidth] = useState(360);

  const html = useMemo(() => {
    const svg = renderGraphSvg({ fns, window: win, width, height, markers });
    return (
      '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<style>body{margin:0;background:#fff}</style></head><body>' +
      svg +
      '</body></html>'
    );
  }, [fns, win, width, height, markers]);

  return (
    <YStack
      height={height}
      borderRadius={10}
      overflow="hidden"
      borderWidth={1}
      borderColor="#e5e7eb"
      onLayout={(e) => setWidth(Math.max(240, Math.round(e.nativeEvent.layout.width)))}
    >
      <WebView source={{ html }} originWhitelist={['*']} javaScriptEnabled={false} />
    </YStack>
  );
}
