/**
 * The Calculator feature shell: Calculate / Graph / Table tabs over one
 * shared store. Sessions persist offline-first — local storage immediately,
 * and the backend (calculator_sessions) when signed in — so work survives
 * reloads and follows the student across devices.
 */
import { useEffect, useRef } from 'react';
import { Button, XStack, YStack } from 'tamagui';
import { parseCalculatorState } from '@tutor/core';
import { useI18n, type I18nKey } from '../../lib/i18n';
import { getAuth } from '../../lib/auth';
import { storage } from '../../lib/storage';
import { trpc } from '../../lib/trpc';
import { AppCard, BRAND } from '../ui';
import { CalcView } from './CalcView';
import { GraphView } from './GraphView';
import { TableView } from './TableView';
import { useCalculatorStore, type CalcTab } from './store';

const STORAGE_KEY = 'tutor.calculator';
const TABS: { id: CalcTab; label: I18nKey }[] = [
  { id: 'calc', label: 'calcTab' },
  { id: 'graph', label: 'graphTab' },
  { id: 'table', label: 'tableTab' },
];

export function Calculator({ compact = false }: { compact?: boolean } = {}) {
  const { t } = useI18n();
  const tab = useCalculatorStore((s) => s.tab);
  const setTab = useCalculatorStore((s) => s.setTab);
  useSessionSync();

  return (
    // Compact drops AppCard's outer padding so a chrome-sheet render
    // gets its own padding from the wrapper instead of double-padding.
    <AppCard gap={compact ? 8 : 12} padding={compact ? 10 : 16}>
      <XStack gap={4} backgroundColor="#f1f3f9" borderRadius={12} padding={3}>
        {TABS.map(({ id, label }) => (
          <Button
            key={id}
            flex={1}
            size={compact ? '$2' : '$3'}
            borderRadius={10}
            backgroundColor={tab === id ? '#fff' : 'transparent'}
            color={tab === id ? BRAND : '#6b7280'}
            fontWeight="700"
            elevation={tab === id ? 1 : 0}
            onPress={() => setTab(id)}
            aria-label={t(label)}
          >
            {t(label)}
          </Button>
        ))}
      </XStack>
      <YStack display={tab === 'calc' ? 'flex' : 'none'}>
        <CalcView compact={compact} />
      </YStack>
      {tab === 'graph' && <GraphView compact={compact} />}
      {tab === 'table' && <TableView />}
    </AppCard>
  );
}

/**
 * Hydrate once (server state wins over local when signed in), then autosave
 * snapshots — debounced — to local storage and, when signed in, the backend.
 */
function useSessionSync() {
  const authed = !!getAuth();
  const server = trpc.calculator.get.useQuery(undefined, {
    enabled: authed,
    staleTime: Infinity,
    retry: 1,
  });
  const save = trpc.calculator.save.useMutation();
  const saveRef = useRef(save);
  saveRef.current = save;

  const serverReady = !authed || server.isSuccess || server.isError;

  useEffect(() => {
    if (!serverReady || useCalculatorStore.getState().hydrated) return;
    void (async () => {
      let raw: unknown = server.data?.state ?? null;
      if (raw == null) {
        try {
          const local = await storage.get(STORAGE_KEY);
          if (local) raw = JSON.parse(local);
        } catch {
          /* corrupted local state — start fresh */
        }
      }
      if (!useCalculatorStore.getState().hydrated) {
        useCalculatorStore.getState().hydrate(parseCalculatorState(raw));
      }
    })();
  }, [serverReady, server.data]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useCalculatorStore.subscribe((state, prev) => {
      if (!state.hydrated || !prev.hydrated) return;
      if (
        state.history === prev.history &&
        state.expressions === prev.expressions &&
        state.window === prev.window &&
        state.angleMode === prev.angleMode &&
        state.variables === prev.variables
      ) {
        return; // only persist durable fields, not keystrokes/tab switches
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const snap = useCalculatorStore.getState().snapshot();
        void storage.set(STORAGE_KEY, JSON.stringify(snap));
        if (getAuth()) saveRef.current.mutate({ state: snap });
      }, 1500);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
