import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, AppChrome } from '@tutor/app';

export default function RootLayout() {
  return (
    <AppProvider>
      <AppChrome>
        <Stack screenOptions={{ headerShown: false }} />
      </AppChrome>
      <StatusBar style="light" />
    </AppProvider>
  );
}
