import type { Sigil } from './dream';

const C = 100;

function pt(a: number, r: number) {
  return `${(C + Math.cos(a) * r).toFixed(2)} ${(C + Math.sin(a) * r).toFixed(2)}`;
}

export function arcPath(r: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${pt(a0, r)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${pt(a1, r)}`;
}

/** Build the SVG markup for a sigil once, so it can be rendered *and* downloaded. */
export function sigilSvg(s: Sigil, stroke = 'currentColor', accent = '#b98cff'): string {
  const parts: string[] = [];

  for (const r of s.rings) {
    parts.push(
      `<circle cx="${C}" cy="${C}" r="${r.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="0.8" opacity="0.45"/>`,
    );
  }

  for (let i = 0; i < s.spokes; i++) {
    const a = (i / s.spokes) * Math.PI * 2;
    const [l0, l1] = s.spokeLen;
    parts.push(
      `<line x1="${(C + Math.cos(a) * s.rings[0] * l0).toFixed(2)}" y1="${(C + Math.sin(a) * s.rings[0] * l0).toFixed(2)}" x2="${(C + Math.cos(a) * s.rings[0] * l1).toFixed(2)}" y2="${(C + Math.sin(a) * s.rings[0] * l1).toFixed(2)}" stroke="${stroke}" stroke-width="1.1" opacity="0.8" stroke-linecap="round"/>`,
    );
  }

  for (const a of s.arcs) {
    parts.push(
      `<path d="${arcPath(a.r, a.a0, a.a1)}" fill="none" stroke="${accent}" stroke-width="${a.w.toFixed(2)}" opacity="0.85" stroke-linecap="round"/>`,
    );
  }

  for (const [x1, y1, x2, y2] of s.chords) {
    parts.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="0.9" opacity="0.5"/>`,
    );
  }

  for (const d of s.dots) {
    parts.push(`<circle cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="${d.r.toFixed(2)}" fill="${accent}" opacity="0.9"/>`);
  }

  parts.push(`<circle cx="${C}" cy="${C}" r="${s.core.toFixed(2)}" fill="none" stroke="${accent}" stroke-width="1.4"/>`);
  parts.push(`<circle cx="${C}" cy="${C}" r="1.8" fill="${accent}"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%" fill="none"><g transform="rotate(${s.rotation.toFixed(2)} ${C} ${C})">${parts.join('')}</g></svg>`;
}
