'use client';

import { useEffect, useRef } from 'react';
import { FRAG, VERT } from '@/lib/shader';
import type { Palette, Params } from '@/lib/dream';

export interface AuroraCanvasProps {
  palette: Palette;
  params: Params;
  /** react to the pointer */
  interactive?: boolean;
  /** device-pixel-ratio multiplier, lower = faster */
  scale?: number;
  /** freeze time */
  paused?: boolean;
  className?: string;
  canvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
  onFallback?: (colors: string[]) => void;
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn('[aether] shader:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function AuroraCanvas({
  palette,
  params,
  interactive = true,
  scale = 1,
  paused = false,
  className,
  canvasRef,
  onFallback,
}: AuroraCanvasProps) {
  const localRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);

  // keep the latest props in a ref so we never tear down the GL context
  const state = useRef({ palette, params, interactive, paused, scale });
  state.current = { palette, params, interactive, paused, scale };

  useEffect(() => {
    const canvas = localRef.current;
    if (!canvas) return;
    if (canvasRef) canvasRef.current = canvas;

    const gl =
      (canvas.getContext('webgl', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }) as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!gl) {
      const colors = palette.swatches.map((s) => s.hex);
      canvas.style.background = `radial-gradient(120% 120% at 30% 20%, ${colors[1]}, ${colors[3]} 45%, ${colors[4]} 80%)`;
      onFallback?.(colors);
      return;
    }
    glRef.current = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[aether] link:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = {
      res: U('uRes'),
      time: U('uTime'),
      mouse: U('uMouse'),
      mouseOn: U('uMouseOn'),
      c0: U('uC0'),
      c1: U('uC1'),
      c2: U('uC2'),
      c3: U('uC3'),
      c4: U('uC4'),
      chaos: U('uChaos'),
      warp: U('uWarp'),
      glow: U('uGlow'),
      zoom: U('uZoom'),
      speed: U('uSpeed'),
      grain: U('uGrain'),
      vignette: U('uVignette'),
      swirl: U('uSwirl'),
      ridge: U('uRidge'),
    };

    // pointer state, in canvas pixels
    const ptr = { x: 0, y: 0, tx: 0, ty: 0, on: 0, ton: 0 };

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const s = state.current.scale ?? 1;
      const nw = Math.max(1, Math.round(rect.width * dpr * s));
      const nh = Math.max(1, Math.round(rect.height * dpr * s));
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      if (ptr.on === 0) {
        ptr.x = ptr.tx = w * 0.5;
        ptr.y = ptr.ty = h * 0.5;
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const onPointer = (e: PointerEvent) => {
      if (!state.current.interactive) return;
      const rect = canvas.getBoundingClientRect();
      ptr.tx = ((e.clientX - rect.left) / rect.width) * w;
      ptr.ty = (1 - (e.clientY - rect.top) / rect.height) * h; // GL y is flipped
      ptr.ton = 1;
    };
    const onLeave = () => {
      ptr.ton = 0;
    };
    if (interactive) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('pointerdown', onPointer, { passive: true });
      document.addEventListener('pointerleave', onLeave);
    }

    // pause when off-screen or tab hidden
    let visible = true;
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(canvas);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeScale = reduced ? 0.12 : 1;

    let raf = 0;
    let t = Math.random() * 40;
    let last = performance.now();

    // the values actually sent to the GPU — they chase the target so that
    // changing the prompt *morphs* the dream instead of cutting to it
    const flatten = (cols: readonly number[][]) => cols.flatMap((c) => [c[0], c[1], c[2]]);
    const cur = {
      cols: flatten(state.current.palette.colors),
      p: { ...state.current.params } as Record<string, number>,
    };
    const tgt: number[] = [];

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;

      if (!visible || document.hidden) return;
      const st = state.current;
      if (!st.paused) t += dt * timeScale;

      const k = 1 - Math.exp(-dt * 2.6);
      const approach = (from: number[], to: readonly number[]) => {
        for (let i = 0; i < from.length; i++) from[i] += (to[i] - from[i]) * k;
      };
      tgt.length = 0;
      for (const c of st.palette.colors) tgt.push(c[0], c[1], c[2]);
      approach(cur.cols, tgt);
      for (const key of Object.keys(st.params) as (keyof Params)[]) {
        const target = st.params[key];
        cur.p[key] = cur.p[key] === undefined ? target : cur.p[key] + (target - cur.p[key]) * k;
      }

      // ease the pointer so the field feels like it has mass
      ptr.x += (ptr.tx - ptr.x) * 0.06;
      ptr.y += (ptr.ty - ptr.y) * 0.06;
      ptr.on += (ptr.ton - ptr.on) * 0.05;

      const q = cur.p;

      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.time, t);
      gl.uniform2f(u.mouse, ptr.x, ptr.y);
      gl.uniform1f(u.mouseOn, ptr.on);
      gl.uniform3f(u.c0, cur.cols[0], cur.cols[1], cur.cols[2]);
      gl.uniform3f(u.c1, cur.cols[3], cur.cols[4], cur.cols[5]);
      gl.uniform3f(u.c2, cur.cols[6], cur.cols[7], cur.cols[8]);
      gl.uniform3f(u.c3, cur.cols[9], cur.cols[10], cur.cols[11]);
      gl.uniform3f(u.c4, cur.cols[12], cur.cols[13], cur.cols[14]);
      gl.uniform1f(u.chaos, q.chaos);
      gl.uniform1f(u.warp, q.warp);
      gl.uniform1f(u.glow, q.glow);
      gl.uniform1f(u.zoom, q.zoom);
      gl.uniform1f(u.speed, q.speed);
      gl.uniform1f(u.grain, q.grain);
      gl.uniform1f(u.vignette, q.vignette);
      gl.uniform1f(u.swirl, q.swirl);
      gl.uniform1f(u.ridge, q.ridge);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('pointerleave', onLeave);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
      glRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={localRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  );
}
