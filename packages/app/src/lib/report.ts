/**
 * Browser download glue for statistics reports (docs/statistics-plan.md,
 * Phase 3). The report model and the pure CSV / Word-HTML renderers live in
 * @tutor/core (report.ts) where they're unit-tested; this module owns the
 * web-only pieces: Blob downloads and the lazily-loaded PDF renderer.
 * Callers gate on Platform.OS === 'web'.
 */
import { reportToCsv, reportToDocHtml, type Report } from '@tutor/core';

export type { Report, ReportBlock, ReportMeta } from '@tutor/core';

export function downloadBlob(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadReportCsv(report: Report, filenameBase: string): void {
  // BOM so Excel opens UTF-8 (accented Spanish labels) correctly.
  downloadBlob(`${filenameBase}.csv`, 'text/csv;charset=utf-8', `﻿${reportToCsv(report)}`);
}

export function downloadReportDoc(report: Report, filenameBase: string): void {
  downloadBlob(`${filenameBase}.doc`, 'application/msword', reportToDocHtml(report));
}

export async function downloadReportPdf(report: Report, filenameBase: string): Promise<void> {
  // pdfmake is web-only and heavy — loaded on demand, never in the native
  // bundle or the initial page load.
  const { renderReportPdf } = await import('./reportPdf');
  await renderReportPdf(report, filenameBase);
}
