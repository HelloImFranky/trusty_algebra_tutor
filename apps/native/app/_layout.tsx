import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Archivo_400Regular, Archivo_600SemiBold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo';
import { AppProvider, AppChrome } from '@tutor/app';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Archivo_400Regular, Archivo_600SemiBold, Archivo_800ExtraBold });
  // Tamagui's font config names these exact families (see tamagui.config.ts)
  // — render nothing until they're registered so no screen briefly flashes
  // the system font.
  if (!fontsLoaded) return null;

  return (
    <AppProvider>
      <AppChrome>
        <Stack screenOptions={{ headerShown: false }} />
      </AppChrome>
      <StatusBar style="light" />
    </AppProvider>
  );
}
