import type { Dream } from './dream';
import { sigilSvg } from './sigil';

const W = 1600;
const H = 2000;

function coverDraw(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number) {
  const scale = Math.max(W / iw, H / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Composite the live WebGL frame, type and palette into a printable poster.
 * Returns a PNG blob the browser can download.
 */
export async function renderPoster(
  source: HTMLCanvasElement | null,
  dream: Dream,
): Promise<Blob> {
  if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
    try {
      await (document as any).fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  // base
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, H);

  if (source && source.width > 0) {
    ctx.save();
    ctx.globalAlpha = 1;
    coverDraw(ctx, source, source.width, source.height);
    ctx.restore();
  }

  // cinematic grade
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(5,6,10,0.72)');
  g.addColorStop(0.28, 'rgba(5,6,10,0.18)');
  g.addColorStop(0.62, 'rgba(5,6,10,0.38)');
  g.addColorStop(1, 'rgba(5,6,10,0.94)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const accent = dream.palette.swatches[1]?.hex ?? '#b98cff';
  const pad = 110;

  // frame
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad * 0.55, pad * 0.55, W - pad * 1.1, H - pad * 1.1);

  // wordmark
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '500 30px "Grotesk", system-ui, sans-serif';
  ctx.letterSpacing = '10px';
  ctx.fillText('AETHER', pad, pad + 20);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '400 22px "Mono Meta", monospace';
  ctx.letterSpacing = '4px';
  ctx.fillText('LATENT DREAM ENGINE', pad, pad + 62);

  // prompt (top right)
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '400 20px "Mono Meta", monospace';
  ctx.letterSpacing = '3px';
  ctx.fillText('PROMPT', W - pad, pad + 20);
  ctx.font = '400 30px "Serif Display", Georgia, serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.letterSpacing = '0px';
  const promptLines = wrap(ctx, `“${dream.prompt}”`, 620).slice(0, 3);
  promptLines.forEach((l, i) => ctx.fillText(l, W - pad, pad + 72 + i * 42));
  ctx.textAlign = 'left';

  // sigil (top-left, under wordmark)
  const svg = sigilSvg(dream.sigil, 'rgba(255,255,255,0.55)', accent);
  const img = new Image();
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((res) => {
    img.onload = () => res();
    img.onerror = () => res();
    img.src = svgUrl;
  });
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.drawImage(img, pad, pad + 120, 230, 230);
  ctx.restore();

  // title block
  let y = H - pad - 250;
  ctx.fillStyle = accent;
  ctx.font = '400 22px "Mono Meta", monospace';
  ctx.letterSpacing = '5px';
  ctx.fillText(dream.moodLabel.toUpperCase(), pad, y);

  y += 96;
  ctx.fillStyle = '#ffffff';
  ctx.font = '400 132px "Serif Display", Georgia, serif';
  ctx.letterSpacing = '0px';
  const titleLines = wrap(ctx, dream.title, W - pad * 2).slice(0, 2);
  titleLines.forEach((l) => {
    ctx.fillText(l, pad, y);
    y += 132;
  });

  y += 18;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = 'italic 400 46px "Serif Display", Georgia, serif';
  ctx.fillText(dream.subtitle, pad, y);

  // poem excerpt
  y += 96;
  ctx.font = '400 34px "Serif Display", Georgia, serif';
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  for (const mv of dream.movements) {
    const line = mv.lines[0];
    for (const l of wrap(ctx, line, W - pad * 2).slice(0, 1)) {
      ctx.fillText(l, pad, y);
      y += 48;
    }
  }

  // palette strip
  const sw = 190;
  const sh = 16;
  dream.palette.swatches.forEach((s, i) => {
    ctx.fillStyle = s.hex;
    ctx.fillRect(pad + i * sw, H - pad - 44, sw - 10, sh);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '400 18px "Mono Meta", monospace';
    ctx.letterSpacing = '2px';
    ctx.fillText(s.hex.toUpperCase(), pad + i * sw, H - pad - 12);
  });

  // seed
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '400 20px "Mono Meta", monospace';
  ctx.letterSpacing = '3px';
  ctx.fillText(`SEED ${dream.seedHex}`, W - pad, H - pad - 12);
  ctx.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
