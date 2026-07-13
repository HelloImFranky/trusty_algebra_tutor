export { AppProvider } from './provider/index';
export { config as tamaguiConfig } from './tamagui.config';
export { useAuth, getAuth, setAuth, hydrateAuth } from './lib/auth';
export { useI18n, I18nProvider, type Locale } from './lib/i18n';
export { trpc, client, getBaseUrl } from './lib/trpc';
export { attemptOrQueue, flushQueue } from './lib/offline';

export { AuthScreen } from './screens/auth';
export { CurriculumScreen } from './screens/curriculum';
export { LessonScreen } from './screens/lesson';
export { PracticeScreen } from './screens/practice';
export { SprintScreen } from './screens/sprint';
export { ReviewScreen } from './screens/review';
export { ProgressScreen } from './screens/progress';
export { CalculatorScreen } from './screens/calculator';
export { ExamplesScreen } from './screens/examples';
export { AnimatedEquation } from './components/stepanim/AnimatedEquation';
export { demoScripts, type EqScript, type EqStep, type EqToken } from './components/stepanim/model';
export { AppChrome } from './components/AppChrome';
