/**
 * Structured math input (design doc §6): middle-school-tuned toolbar
 * (fraction, exponent, radical, ≤/≥, π) over a text field that accepts the
 * typed shortcuts the doc calls out (x^2, sqrt(), <=), with a live KaTeX
 * preview so students see their math rendered as they type. Grading always
 * normalizes through the CAS server-side — never string equality.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import { Katex } from './Katex';
import { useI18n } from '../i18n';

const BUTTONS: { label: string; insert: string; caret?: number }[] = [
  { label: 'x²', insert: '^2' },
  { label: 'xⁿ', insert: '^', caret: 1 },
  { label: '√', insert: 'sqrt()', caret: 5 },
  { label: 'a/b', insert: '()/()', caret: 1 },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
  { label: 'π', insert: 'pi' },
  { label: '≤', insert: '<=' },
  { label: '≥', insert: '>=' },
  { label: '±', insert: ',' },
  { label: '=', insert: '=' },
];

/** Best-effort preview conversion of shortcut syntax to LaTeX. */
export function toPreviewTex(input: string): string {
  let s = input;
  for (let i = 0; i < 6 && /sqrt\(/.test(s); i++) {
    s = s.replace(/sqrt\(([^()]*)\)/g, '\\sqrt{$1}');
  }
  s = s.replace(/<=/g, '\\le ').replace(/>=/g, '\\ge ');
  s = s.replace(/\bpi\b/g, '\\pi ');
  s = s.replace(/\^(\d{2,}|\w)/g, '^{$1}');
  s = s.replace(/\*/g, '\\cdot ');
  return s;
}

export function MathInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const insert = (text: string, caretOffset?: number) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + (caretOffset ?? text.length);
      el.setSelectionRange(pos, pos);
    });
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="math-input-wrap">
      <div className="math-toolbar" role="toolbar" aria-label="math symbols">
        {BUTTONS.map((b) => (
          <button
            key={b.label}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(b.insert, b.caret)}
            aria-label={b.label}
          >
            {b.label}
          </button>
        ))}
      </div>
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? t('typeMath')}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={t('yourAnswer')}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
      />
      <div className="math-preview" aria-live="polite">
        {value ? <Katex tex={toPreviewTex(value)} /> : focused ? ' ' : ''}
      </div>
    </div>
  );
}
