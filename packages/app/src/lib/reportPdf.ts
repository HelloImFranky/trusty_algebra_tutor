/**
 * PDF renderer for statistics reports (docs/statistics-plan.md, Phase 3).
 * Separate module so pdfmake (+ embedded fonts, ~1 MB) only loads when the
 * user actually clicks "PDF". Charts render as vector rectangles, so bars,
 * stacked distributions, and heatmap grids survive as real graphics.
 */
/// <reference path="../types/pdfmake.d.ts" />
import { REPORT_BAR_COLOR, type Report, type ReportBlock } from '@tutor/core';

const INK = '#201e1d';
const MUTED = '#6f6b68';
const BORDER = '#d8d4d0';
const HEADER_BG = '#f2efec';

const BAR_WIDTH = 240;
const BAR_HEIGHT = 9;

type Content = Record<string, unknown> | Record<string, unknown>[];

function tableDef(columns: string[], rows: (Content | string)[][], widths?: (string | number)[]) {
  return {
    margin: [0, 2, 0, 8] as number[],
    table: {
      headerRows: 1,
      widths: widths ?? columns.map(() => 'auto'),
      body: [
        columns.map((c) => ({ text: c, bold: true, fillColor: HEADER_BG, fontSize: 8.5 })),
        ...rows.map((r) =>
          r.map((cell) => (typeof cell === 'string' ? { text: cell, fontSize: 8.5 } : cell)),
        ),
      ],
    },
    layout: {
      hLineColor: () => BORDER,
      vLineColor: () => BORDER,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
  };
}

function barCanvas(ratio: number, color: string) {
  return {
    canvas: [
      { type: 'rect', x: 0, y: 1, w: BAR_WIDTH, h: BAR_HEIGHT, color: '#efedeb' },
      ...(ratio > 0
        ? [{ type: 'rect', x: 0, y: 1, w: Math.max(1, ratio * BAR_WIDTH), h: BAR_HEIGHT, color }]
        : []),
    ],
  };
}

function stackedCanvas(segments: number[], colors: string[]) {
  const total = segments.reduce((sum, s) => sum + s, 0);
  const rects: Record<string, unknown>[] = [
    { type: 'rect', x: 0, y: 1, w: BAR_WIDTH, h: BAR_HEIGHT, color: '#efedeb' },
  ];
  let x = 0;
  segments.forEach((v, i) => {
    if (v <= 0 || total === 0) return;
    const w = (v / total) * BAR_WIDTH;
    rects.push({ type: 'rect', x, y: 1, w, h: BAR_HEIGHT, color: colors[i] });
    x += w;
  });
  return { canvas: rects };
}

function legendRow(legend: { label: string; color: string }[]) {
  return {
    columns: legend.map((l) => ({
      width: 'auto',
      margin: [0, 0, 10, 2] as number[],
      columns: [
        { width: 8, canvas: [{ type: 'rect', x: 0, y: 1, w: 7, h: 7, color: l.color }] },
        { width: 'auto', text: ` ${l.label}`, fontSize: 8, color: MUTED },
      ],
    })),
  };
}

function blockContent(b: ReportBlock): Content[] {
  switch (b.kind) {
    case 'heading':
      return [{ text: b.text, fontSize: 13, bold: true, margin: [0, 12, 0, 4] }];
    case 'note':
      return [{ text: b.text, fontSize: 8, color: MUTED, margin: [0, 0, 0, 6] }];
    case 'stats':
      return [
        tableDef(
          b.items.map((s) => s.label),
          [b.items.map((s) => ({ text: s.value, bold: true, fontSize: 11 }))],
        ),
      ];
    case 'table': {
      const out: Content[] = [];
      if (b.title) out.push({ text: b.title, fontSize: 13, bold: true, margin: [0, 12, 0, 4] });
      out.push(tableDef(b.columns, b.rows));
      return out;
    }
    case 'bars': {
      const out: Content[] = [];
      if (b.title) out.push({ text: b.title, fontSize: 13, bold: true, margin: [0, 12, 0, 4] });
      const max = b.max ?? Math.max(1, ...b.items.map((i) => i.value));
      const color = b.color ?? REPORT_BAR_COLOR;
      for (const item of b.items) {
        out.push({
          margin: [0, 1, 0, 1],
          columns: [
            { width: 130, text: item.label, fontSize: 8.5, color: INK },
            { width: BAR_WIDTH, ...barCanvas(item.value / max, color) },
            { width: 'auto', text: ` ${item.display}`, fontSize: 8.5, color: MUTED },
          ],
        });
      }
      return out;
    }
    case 'stacked': {
      const out: Content[] = [];
      if (b.title) out.push({ text: b.title, fontSize: 13, bold: true, margin: [0, 12, 0, 4] });
      out.push(legendRow(b.legend));
      const colors = b.legend.map((l) => l.color);
      for (const row of b.rows) {
        out.push({
          margin: [0, 1, 0, 1],
          columns: [
            { width: 130, text: row.label, fontSize: 8.5, color: INK },
            { width: BAR_WIDTH, ...stackedCanvas(row.segments, colors) },
            { width: 'auto', text: ` ${row.segments.join(' / ')}`, fontSize: 8.5, color: MUTED },
          ],
        });
      }
      return out;
    }
    case 'grid': {
      const out: Content[] = [];
      if (b.title) out.push({ text: b.title, fontSize: 13, bold: true, margin: [0, 12, 0, 4] });
      out.push(legendRow(b.legend));
      out.push(
        tableDef(
          ['', ...b.columns],
          b.rows.map((row) => [
            { text: row.label, fontSize: 8.5 },
            ...row.cells.map(() => ''),
          ]),
        ),
      );
      // Replace the placeholder body with color-filled cells (kept simple:
      // rebuild the body rows with fillColor per cell).
      const grid = out[out.length - 1] as { table: { body: Record<string, unknown>[][] } };
      grid.table.body = [
        ['', ...b.columns].map((c) => ({
          text: c,
          bold: true,
          fillColor: HEADER_BG,
          fontSize: 7.5,
        })),
        ...b.rows.map((row) => [
          { text: row.label, fontSize: 8.5 },
          ...row.cells.map((cell) => ({ text: ' ', fillColor: cell.color, fontSize: 8.5 })),
        ]),
      ];
      return out;
    }
  }
}

export async function renderReportPdf(report: Report, filenameBase: string): Promise<void> {
  const [{ default: pdfMakeModule }, vfsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  // Interop: depending on the bundler the module may or may not be wrapped
  // in `default`; the font vfs is the module's own export map.
  const pdfMake = (pdfMakeModule ?? {}) as unknown as {
    addVirtualFileSystem: (vfs: unknown) => void;
    createPdf: (def: unknown) => { download: (name: string) => void };
  };
  pdfMake.addVirtualFileSystem(vfsModule);
  const content: Content[] = [
    { text: report.meta.title, fontSize: 18, bold: true },
    ...(report.meta.subtitle
      ? [{ text: report.meta.subtitle, fontSize: 12, color: MUTED, margin: [0, 2, 0, 0] }]
      : []),
    { text: report.meta.stamp, fontSize: 8, color: MUTED, margin: [0, 4, 0, 10] },
    ...report.blocks.flatMap(blockContent),
  ];
  pdfMake
    .createPdf({
      pageSize: 'LETTER',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { color: INK },
      content,
    })
    .download(`${filenameBase}.pdf`);
}
