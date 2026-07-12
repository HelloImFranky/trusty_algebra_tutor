/**
 * Web graph viewport: renders the engine-sampled SVG and layers direct
 * manipulation on top — drag to pan, wheel/pinch to zoom, hover/touch to
 * trace curve values. All coordinate math is local; the window state lives
 * in the calculator store.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatNumber, type GraphWindow, type Point } from '@tutor/core';
import { renderGraphSvg, type PlottedFunction } from './graphSvg';

export interface GraphPlotProps {
  fns: PlottedFunction[];
  window: GraphWindow;
  onWindowChange: (w: GraphWindow) => void;
  markers?: { point: Point; color: string }[];
  height?: number;
}

export function GraphPlot({ fns, window: win, onWindowChange, markers, height = 380 }: GraphPlotProps) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [trace, setTrace] = useState<{ x: number; values: { color: string; y: number }[] } | null>(
    null,
  );
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const winRef = useRef(win);
  winRef.current = win;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel needs a non-passive listener to preventDefault page scrolling.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY > 0 ? 1.18 : 1 / 1.18;
      onWindowChange(
        zoomAt(winRef.current, factor, {
          fx: (e.clientX - rect.left) / rect.width,
          fy: (e.clientY - rect.top) / rect.height,
        }),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWindowChange]);

  const svg = useMemo(
    () => renderGraphSvg({ fns, window: win, width, height, markers }),
    [fns, win, width, height, markers],
  );

  const updateTrace = (clientX: number) => {
    const el = host.current;
    if (!el || fns.length === 0) return;
    const rect = el.getBoundingClientRect();
    const x = win.xmin + ((clientX - rect.left) / rect.width) * (win.xmax - win.xmin);
    const values = fns
      .filter((f) => f.fn.ok)
      .map((f) => ({ color: f.color, y: f.fn.at(x) }))
      .filter((v) => Number.isFinite(v.y));
    setTrace(values.length ? { x, values } : null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = host.current;
    if (!el) return;
    const prev = pointers.current.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === 'mouse') updateTrace(e.clientX);
      return;
    }
    const rect = el.getBoundingClientRect();
    const pts = pointers.current;
    if (pts.size === 1) {
      const dx = ((e.clientX - prev.x) / rect.width) * (win.xmax - win.xmin);
      const dy = ((e.clientY - prev.y) / rect.height) * (win.ymax - win.ymin);
      onWindowChange({
        xmin: win.xmin - dx,
        xmax: win.xmax - dx,
        ymin: win.ymin + dy,
        ymax: win.ymax + dy,
      });
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      const moved = { x: e.clientX, y: e.clientY };
      const other = [...pts.entries()].find(([id]) => id !== e.pointerId)?.[1] ?? a;
      const after = Math.hypot(moved.x - other.x, moved.y - other.y);
      if (before > 0 && after > 0) {
        const cx = (moved.x + other.x) / 2;
        const cy = (moved.y + other.y) / 2;
        onWindowChange(
          zoomAt(win, before / after, {
            fx: (cx - rect.left) / rect.width,
            fy: (cy - rect.top) / rect.height,
          }),
        );
      }
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    updateTrace(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  return (
    <div>
      <div
        ref={host}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => {
          onPointerUp(e);
          setTrace(null);
        }}
        style={{
          touchAction: 'none',
          cursor: 'grab',
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
          userSelect: 'none',
        }}
        aria-label="graph viewport"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div style={{ minHeight: 22, fontSize: 13, color: '#6b7280', padding: '4px 2px', fontVariantNumeric: 'tabular-nums' }}>
        {trace
          ? `x = ${formatNumber(Number(trace.x.toPrecision(4)))}   ` +
            trace.values
              .map((v) => `y = ${formatNumber(Number(v.y.toPrecision(4)))}`)
              .join('   ')
          : ''}
      </div>
    </div>
  );
}

/** Zoom keeping the point at fractional viewport position (fx, fy) fixed. */
function zoomAt(w: GraphWindow, factor: number, at: { fx: number; fy: number }): GraphWindow {
  const spanX = (w.xmax - w.xmin) * factor;
  const spanY = (w.ymax - w.ymin) * factor;
  if (spanX < 1e-9 || spanY < 1e-9 || spanX > 1e12 || spanY > 1e12) return w;
  const cx = w.xmin + (w.xmax - w.xmin) * at.fx;
  const cy = w.ymax - (w.ymax - w.ymin) * at.fy;
  return {
    xmin: cx - spanX * at.fx,
    xmax: cx + spanX * (1 - at.fx),
    ymin: cy - spanY * (1 - at.fy),
    ymax: cy + spanY * at.fy,
  };
}
