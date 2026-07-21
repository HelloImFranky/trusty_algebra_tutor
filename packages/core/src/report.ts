/**
 * Downloadable statistics reports (docs/statistics-plan.md, Phase 3). Every
 * stats page builds one report — a flat list of blocks (headings, stat rows,
 * tables, bar/stacked charts, color grids) — and the user picks the format:
 *
 *   - PDF  (app's reportPdf.ts, pdfmake): tables + charts as vector rects;
 *   - Word (.doc): the same blocks as Word-compatible HTML — Word opens
 *     HTML documents natively, and bars/grids survive as colored table
 *     cells, so the formatted layout is preserved;
 *   - CSV: data only, charts flattened to their numbers.
 *
 * Blocks carry their own display colors (fixed light palette, not the live
 * app theme) because a report is a document — it must look the same on
 * every export, whatever accent/dark-mode the user picked.
 */

export interface ReportMeta {
  title: string;
  subtitle?: string;
  /** e.g. "Generated 2026-07-21 · Algebra Tutor" */
  stamp: string;
}

export interface GridCell {
  color: string;
  /** Data value for CSV export (e.g. the mastery label or band name). */
  value: string;
}

export type ReportBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'stats'; items: { label: string; value: string }[] }
  | { kind: 'table'; title?: string; columns: string[]; rows: string[][] }
  | {
      kind: 'bars';
      title?: string;
      /** Horizontal bars; values on a shared 0..max scale. */
      items: { label: string; value: number; display: string }[];
      max?: number;
      color?: string;
    }
  | {
      kind: 'stacked';
      title?: string;
      legend: { label: string; color: string }[];
      /** segments[i] pairs with legend[i]. */
      rows: { label: string; segments: number[] }[];
    }
  | {
      kind: 'grid';
      title?: string;
      columns: string[];
      legend: { label: string; color: string }[];
      rows: { label: string; cells: GridCell[] }[];
    };

export interface Report {
  meta: ReportMeta;
  blocks: ReportBlock[];
}

export const REPORT_BAR_COLOR = '#1e88e5';

/** Fixed report palette: mastery ladder + readiness bands. Matches the
 * app's light-mode semantics but never follows the live theme. */
export const REPORT_COLORS = {
  mastered: '#1e88e5',
  proficient: '#78b6ec',
  practicing: '#c3ddf7',
  struggling: '#ae1800',
  notStarted: '#e8e5e2',
  ready: '#0ca678',
  developing: '#c98a00',
  needsWork: '#ae1800',
  noData: '#e8e5e2',
} as const;

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvEscape(cell: string): string {
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function reportToCsv(report: Report): string {
  const lines: string[][] = [[report.meta.title], [report.meta.stamp], []];
  for (const b of report.blocks) {
    switch (b.kind) {
      case 'heading':
        lines.push([], [b.text]);
        break;
      case 'note':
        break; // prose doesn't belong in a CSV
      case 'stats':
        for (const s of b.items) lines.push([s.label, s.value]);
        break;
      case 'table':
        if (b.title) lines.push([b.title]);
        lines.push(b.columns, ...b.rows);
        break;
      case 'bars':
        if (b.title) lines.push([b.title]);
        for (const item of b.items) lines.push([item.label, item.display]);
        break;
      case 'stacked':
        if (b.title) lines.push([b.title]);
        lines.push(['', ...b.legend.map((l) => l.label)]);
        for (const row of b.rows) lines.push([row.label, ...row.segments.map(String)]);
        break;
      case 'grid':
        if (b.title) lines.push([b.title]);
        lines.push(['', ...b.columns]);
        for (const row of b.rows) lines.push([row.label, ...row.cells.map((c) => c.value)]);
        break;
    }
  }
  return lines.map((row) => row.map(csvEscape).join(',')).join('\n');
}

// ---------------------------------------------------------------------------
// Word (.doc as Word-compatible HTML)
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const DOC_CSS = `
  body { font-family: Calibri, Arial, sans-serif; color: #201e1d; font-size: 11pt; }
  h1 { font-size: 18pt; margin: 0 0 2pt; }
  h2 { font-size: 13pt; margin: 14pt 0 4pt; }
  p.stamp { color: #6f6b68; font-size: 9pt; margin: 0 0 10pt; }
  p.note { color: #6f6b68; font-size: 9pt; margin: 3pt 0 8pt; }
  table { border-collapse: collapse; margin: 4pt 0 8pt; }
  th, td { border: 1pt solid #d8d4d0; padding: 3pt 6pt; font-size: 10pt; text-align: left; }
  th { background: #f2efec; }
  td.bar-track { border: none; padding: 1pt 0; }
  table.chart td { border: none; }
  td.swatch { border: 1pt solid #d8d4d0; width: 14pt; }
`;

function legendHtml(legend: { label: string; color: string }[]): string {
  return `<p class="note">${legend
    .map(
      (l) =>
        `<span style="background:${l.color};color:#ffffff;padding:1pt 4pt;">&nbsp;</span> ${esc(l.label)}`,
    )
    .join(' &nbsp; ')}</p>`;
}

export function reportToDocHtml(report: Report): string {
  const parts: string[] = [
    `<h1>${esc(report.meta.title)}</h1>`,
    report.meta.subtitle ? `<h2 style="margin-top:0">${esc(report.meta.subtitle)}</h2>` : '',
    `<p class="stamp">${esc(report.meta.stamp)}</p>`,
  ];
  for (const b of report.blocks) {
    switch (b.kind) {
      case 'heading':
        parts.push(`<h2>${esc(b.text)}</h2>`);
        break;
      case 'note':
        parts.push(`<p class="note">${esc(b.text)}</p>`);
        break;
      case 'stats':
        parts.push(
          `<table><tr>${b.items.map((s) => `<th>${esc(s.label)}</th>`).join('')}</tr>` +
            `<tr>${b.items.map((s) => `<td><b>${esc(s.value)}</b></td>`).join('')}</tr></table>`,
        );
        break;
      case 'table':
        if (b.title) parts.push(`<h2>${esc(b.title)}</h2>`);
        parts.push(
          `<table><tr>${b.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>` +
            b.rows
              .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
              .join('') +
            `</table>`,
        );
        break;
      case 'bars': {
        if (b.title) parts.push(`<h2>${esc(b.title)}</h2>`);
        const max = b.max ?? Math.max(1, ...b.items.map((i) => i.value));
        const color = b.color ?? REPORT_BAR_COLOR;
        // Bars as a nested fixed-width table — Word has no flexbox, but it
        // renders proportional table cells faithfully.
        parts.push(
          `<table class="chart">` +
            b.items
              .map((item) => {
                const pct = Math.round((item.value / max) * 100);
                return (
                  `<tr><td style="width:140pt">${esc(item.label)}</td>` +
                  `<td class="bar-track" style="width:220pt">` +
                  `<table style="width:100%;margin:0"><tr>` +
                  (pct > 0
                    ? `<td style="background:${color};width:${pct}%;border:none">&nbsp;</td>`
                    : '') +
                  `<td style="border:none">&nbsp;</td></tr></table></td>` +
                  `<td style="border:none">${esc(item.display)}</td></tr>`
                );
              })
              .join('') +
            `</table>`,
        );
        break;
      }
      case 'stacked': {
        if (b.title) parts.push(`<h2>${esc(b.title)}</h2>`);
        parts.push(legendHtml(b.legend));
        parts.push(
          `<table class="chart">` +
            b.rows
              .map((row) => {
                const total = row.segments.reduce((sum, s) => sum + s, 0);
                const cells = row.segments
                  .map((v, i) =>
                    v > 0 && total > 0
                      ? `<td style="background:${b.legend[i]!.color};width:${Math.round((v / total) * 100)}%;border:none">&nbsp;</td>`
                      : '',
                  )
                  .join('');
                return (
                  `<tr><td style="width:140pt">${esc(row.label)}</td>` +
                  `<td class="bar-track" style="width:220pt"><table style="width:100%;margin:0"><tr>${
                    cells || '<td style="border:none">&nbsp;</td>'
                  }</tr></table></td>` +
                  `<td style="border:none">${row.segments.join(' / ')}</td></tr>`
                );
              })
              .join('') +
            `</table>`,
        );
        break;
      }
      case 'grid': {
        if (b.title) parts.push(`<h2>${esc(b.title)}</h2>`);
        parts.push(legendHtml(b.legend));
        parts.push(
          `<table><tr><th></th>${b.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>` +
            b.rows
              .map(
                (row) =>
                  `<tr><td>${esc(row.label)}</td>${row.cells
                    .map((c) => `<td class="swatch" style="background:${c.color}">&nbsp;</td>`)
                    .join('')}</tr>`,
              )
              .join('') +
            `</table>`,
        );
        break;
      }
    }
  }
  return (
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">` +
    `<head><meta charset="utf-8"><title>${esc(report.meta.title)}</title>` +
    `<style>${DOC_CSS}</style></head><body>${parts.join('\n')}</body></html>`
  );
}

/**
 * Flatten authored prompt markup ($math$, **bold**, light LaTeX) to plain
 * text for report tables — a PDF/Word/CSV cell can't run KaTeX.
 */
export function plainMath(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\\(le|leq)\b/g, '≤')
    .replace(/\\(ge|geq)\b/g, '≥')
    .replace(/\\ne\b/g, '≠')
    .replace(/\\cdot ?/g, '·')
    .replace(/\\times ?/g, '×')
    .replace(/\\div ?/g, '÷')
    .replace(/\\sqrt/g, '√')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\\$/g, '\u0001') // protect escaped currency dollars…
    .replace(/\$/g, '') // …strip math delimiters…
    .replace(/\u0001/g, '$') // …restore the literals
    .replace(/[{}]/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

