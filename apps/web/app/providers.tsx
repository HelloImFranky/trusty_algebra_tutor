'use client';

import { useServerInsertedHTML } from 'next/navigation';
import { AppProvider, AppChrome, tamaguiConfig } from '@tutor/app';
import { StyleSheet } from 'react-native';

export function Providers({ children }: { children: React.ReactNode }) {
  useServerInsertedHTML(() => {
    // react-native-web + tamagui SSR styles (getSheet is a react-native-web
    // extension that the react-native type surface doesn't know about)
    const sheet = (StyleSheet as unknown as { getSheet(): { textContent: string; id: string } }).getSheet();
    return (
      <>
        <style id={sheet.id} dangerouslySetInnerHTML={{ __html: sheet.textContent }} />
        <style
          dangerouslySetInnerHTML={{ __html: tamaguiConfig.getCSS() }}
        />
      </>
    );
  });

  return (
    <AppProvider>
      <AppChrome>{children}</AppChrome>
    </AppProvider>
  );
}
