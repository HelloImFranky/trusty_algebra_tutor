import { describe, expect, it } from 'vitest';
import { plainMath, reportToCsv, reportToDocHtml, type Report } from './report.js';

const sample: Report = {
  meta: { title: 'Period 2 — Class insights', subtitle: 'Ms. Rivera', stamp: 'Generated 2026-07-21' },
  blocks: [
    { kind: 'stats', items: [{ label: 'Active · 7d', value: '12' }, { label: 'Minutes', value: '340' }] },
    { kind: 'heading', text: 'Students to watch' },
    { kind: 'note', text: 'Flags: inactive, struggling.' },
    {
      kind: 'table',
      columns: ['Student', 'Flags, notes'],
      rows: [['Ana "Ace"', 'struggling, hints']],
    },
    {
      kind: 'bars',
      title: 'Practice minutes',
      items: [{ label: 'Ana', value: 30, display: '30 min' }],
    },
    {
      kind: 'stacked',
      title: 'Mastery by unit',
      legend: [
        { label: 'Needs help', color: '#ae1800' },
        { label: 'Mastered', color: '#1e88e5' },
      ],
      rows: [{ label: 'Unit 1', segments: [3, 5] }],
    },
    {
      kind: 'grid',
      title: 'Readiness',
      columns: ['Inequalities'],
      legend: [{ label: 'Ready', color: '#0ca678' }],
      rows: [{ label: 'Ana', cells: [{ color: '#0ca678', value: 'ready' }] }],
    },
  ],
};

describe('reportToCsv', () => {
  it('flattens every block to data rows and escapes commas/quotes', () => {
    const csv = reportToCsv(sample);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Period 2 — Class insights');
    // table cells with quotes/commas survive round-trippable escaping
    expect(csv).toContain('"Ana ""Ace"""');
    expect(csv).toContain('"Flags, notes"');
    // charts flatten to their numbers
    expect(csv).toContain('Ana,30 min');
    expect(csv).toContain('Unit 1,3,5');
    expect(csv).toContain('Ana,ready');
    // prose notes stay out of the data export
    expect(csv).not.toContain('Flags: inactive');
  });
});

describe('reportToDocHtml', () => {
  it('renders a Word-compatible HTML document with charts as colored cells', () => {
    const html = reportToDocHtml(sample);
    expect(html).toContain('urn:schemas-microsoft-com:office:word');
    expect(html).toContain('<h1>Period 2 — Class insights</h1>');
    // quotes are HTML-safe in text nodes and pass through unchanged
    expect(html).toContain('Ana "Ace"');
    // bar chart preserved as a proportional colored cell
    expect(html).toMatch(/background:#1e88e5;width:100%/);
    // stacked chart segments sized by share (3/8 = 38%, 5/8 = 63%)
    expect(html).toMatch(/background:#ae1800;width:38%/);
    expect(html).toMatch(/background:#1e88e5;width:63%/);
    // grid cell carries its band color
    expect(html).toMatch(/class="swatch" style="background:#0ca678"/);
    // notes render as prose
    expect(html).toContain('Flags: inactive, struggling.');
  });

  it('escapes HTML-significant characters in labels', () => {
    const html = reportToDocHtml({
      meta: { title: 'a < b & c', stamp: 's' },
      blocks: [{ kind: 'heading', text: '<script>' }],
    });
    expect(html).toContain('a &lt; b &amp; c');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('plainMath', () => {
  it('flattens math markup to readable text and keeps currency dollars', () => {
    expect(plainMath('What is the solution of $-2x + 6 > 10$?')).toBe(
      'What is the solution of -2x + 6 > 10?',
    );
    expect(plainMath('A gym charges a \\$25 fee, using $25 + 4c \\le 60$?')).toBe(
      'A gym charges a $25 fee, using 25 + 4c ≤ 60?',
    );
    expect(plainMath('the **greatest** value of $\\frac{x}{3}$')).toBe(
      'the greatest value of (x)/(3)',
    );
  });
});
