import { defaultConfig } from '@tamagui/config/v4';
import { Platform } from 'react-native';
import { createFont, createTamagui } from 'tamagui';

/**
 * Archivo, loaded per-platform: web gets one CSS family with real font-weight
 * switching (see apps/web/app/layout.tsx's next/font/local); native can't
 * fake weights on one family, so each weight is its own registered family
 * name (see apps/native/app/_layout.tsx's useFonts + @expo-google-fonts).
 */
const archivoFace = {
  400: { normal: 'Archivo_400Regular' },
  600: { normal: 'Archivo_600SemiBold' },
  800: { normal: 'Archivo_800ExtraBold' },
} as const;

const archivo = createFont({
  ...defaultConfig.fonts.body,
  family: Platform.OS === 'web' ? 'Archivo, system-ui, sans-serif' : 'Archivo_400Regular',
  face: archivoFace,
});

const archivoHeading = createFont({
  ...defaultConfig.fonts.heading,
  family: Platform.OS === 'web' ? 'Archivo, system-ui, sans-serif' : 'Archivo_800ExtraBold',
  face: archivoFace,
});

/**
 * Tamagui theme for the tutor: "Modernist / rounded & friendly" — warm
 * neutral surfaces, near-black ink, a themeable accent (see ../lib/theme.tsx)
 * and Archivo throughout (design doc: Claude Design project
 * 937947b2-2ad0-4187-ba61-c2e54cc33dd6, variant 3).
 */
export const config = createTamagui({
  ...defaultConfig,
  fonts: {
    ...defaultConfig.fonts,
    body: archivo,
    heading: archivoHeading,
  },
  settings: {
    ...defaultConfig.settings,
    onlyAllowShorthands: false,
  },
});

export type AppConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
