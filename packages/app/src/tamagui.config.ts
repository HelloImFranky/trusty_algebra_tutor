import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui } from 'tamagui';

/**
 * Tamagui theme for the tutor: friendly rounded look, high-contrast text for
 * classroom projectors, and the brand indigo carried over from the PWA.
 */
export const config = createTamagui({
  ...defaultConfig,
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
