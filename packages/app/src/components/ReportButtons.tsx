/**
 * "Download report" bar (docs/statistics-plan.md, Phase 3): every stats page
 * offers its full contents as PDF or Word (formatted — tables and charts
 * preserved) or CSV (data only). Web-only: file downloads need a browser;
 * the bar renders nothing on native. The report is built lazily on click so
 * pages never pay for a report nobody exports.
 */
import { useState } from 'react';
import { Platform } from 'react-native';
import { Text, XStack } from 'tamagui';
import type { Report } from '@tutor/core';
import { useI18n } from '../lib/i18n';
import { downloadReportCsv, downloadReportDoc, downloadReportPdf } from '../lib/report';
import { Muted, SecondaryButton } from './ui';

export function ReportButtons({
  filenameBase,
  buildReport,
}: {
  filenameBase: string;
  buildReport: () => Report;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  if (Platform.OS !== 'web') return null;

  const exportPdf = async () => {
    setBusy(true);
    try {
      await downloadReportPdf(buildReport(), filenameBase);
    } finally {
      setBusy(false);
    }
  };

  return (
    <XStack gap={8} alignItems="center" flexWrap="wrap">
      <Muted size={12}>⬇️ {t('downloadReport')}:</Muted>
      <SecondaryButton size="$2" disabled={busy} onPress={() => void exportPdf()}>
        <Text fontWeight="700" fontSize={13}>
          PDF
        </Text>
      </SecondaryButton>
      <SecondaryButton size="$2" onPress={() => downloadReportDoc(buildReport(), filenameBase)}>
        <Text fontWeight="700" fontSize={13}>
          Word
        </Text>
      </SecondaryButton>
      <SecondaryButton size="$2" onPress={() => downloadReportCsv(buildReport(), filenameBase)}>
        <Text fontWeight="700" fontSize={13}>
          CSV
        </Text>
      </SecondaryButton>
    </XStack>
  );
}
