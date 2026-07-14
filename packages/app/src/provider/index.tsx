/** Root provider shared by the Next.js and Expo apps. */
import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TamaguiProvider, type TamaguiProviderProps } from 'tamagui';
import { config } from '../tamagui.config';
import { I18nProvider } from '../lib/i18n';
import { trpc, trpcClientOptions, silentBootRefresh } from '../lib/trpc';
import { hydrateAuth, isWeb, useAuth } from '../lib/auth';
import { flushQueue } from '../lib/offline';
import { Loading } from '../components/ui';

export function AppProvider({
  children,
  ...rest
}: { children: ReactNode } & Omit<TamaguiProviderProps, 'config'>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  const [trpcClient] = useState(() => trpc.createClient(trpcClientOptions));
  const hydrated = useAuth((s) => s.hydrated);

  useEffect(() => {
    // Web restores the session from the httpOnly refresh cookie; native reads
    // persisted tokens. Either way, flush the offline queue once ready.
    const boot = isWeb ? silentBootRefresh() : hydrateAuth();
    void boot.then(() => flushQueue().catch(() => {}));
  }, []);

  return (
    <TamaguiProvider config={config} defaultTheme="light" {...rest}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>{hydrated ? children : <Loading />}</I18nProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </TamaguiProvider>
  );
}
