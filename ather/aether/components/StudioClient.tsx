'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AuroraCanvas from './AuroraCanvas';
import SigilMark from './Sigil';
import { downloadBlob, renderPoster } from '@/lib/poster';
import { sigilSvg } from '@/lib/sigil';
import {
  MOODS,
  SEED_PROMPTS,
  isMood,
  makeDream,
  type Dream,
  type MoodId,
} from '@/lib/dream';

const RECENT_KEY = 'aether.recent.v1';

export default function StudioClient({ initial }: { initial: Dream }) {
  const [prompt, setPrompt] = useState(initial.prompt);
  const [mood, setMood] = useState<MoodId>(initial.mood);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [recent, setRecent] = useState<{ p: string; m: MoodId }[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // the dream is *derived* — it is a pure function of (prompt, mood)
  const dream = useMemo(() => makeDream(prompt, mood), [prompt, mood]);
  const accent = dream.palette.swatches[1]?.hex ?? '#b98cff';

  /* ---------------------------------------------------------------- toast */
  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2200);
  }, []);

  /* ------------------------------------------------------------ url sync */
  useEffect(() => {
    const id = window.setTimeout(() => {
      const q = new URLSearchParams({ p: prompt, m: mood }).toString();
      window.history.replaceState(null, '', `/studio?${q}`);
    }, 450);
    return () => window.clearTimeout(id);
  }, [prompt, mood]);

  /* -------------------------------------------------------- recent dreams */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setRecent((prev) => {
        const next = [
          { p: dream.prompt, m: dream.mood },
          ...prev.filter((r) => r.p !== dream.prompt || r.m !== dream.mood),
        ].slice(0, 8);
        try {
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    }, 900);
    return () => window.clearTimeout(id);
  }, [dream.prompt, dream.mood]);

  /* -------------------------------------------------------- server decode */
  const decode = useCallback(async () => {
    setBusy(true);
    setSynced(null);
    try {
      const res = await fetch('/api/dream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, mood }),
      });
      const json = (await res.json()) as { dream: Dream };
      setSynced(json.dream?.seed === dream.seed);
      say(
        json.dream?.seed === dream.seed
          ? 'decoded · browser and server agree'
          : 'decoded · check the seed',
      );
    } catch {
      setSynced(false);
      say('offline decode · still deterministic');
    } finally {
      setBusy(false);
    }
  }, [prompt, mood, dream.seed, say]);

  /* ------------------------------------------------------------- actions */
  const randomize = useCallback(() => {
    setPrompt(SEED_PROMPTS[Math.floor(Math.random() * SEED_PROMPTS.length)]);
    setMood(MOODS[Math.floor(Math.random() * MOODS.length)].id);
    setSynced(null);
  }, []);

  const savePoster = useCallback(async () => {
    try {
      say('composing poster…');
      const blob = await renderPoster(canvasRef.current, dream);
      downloadBlob(blob, `aether-${dream.seedHex}.png`);
      say('poster saved');
    } catch {
      say('poster failed — try again');
    }
  }, [dream, say]);

  const saveSigil = useCallback(() => {
    const svg = sigilSvg(dream.sigil, '#ffffff', accent);
    downloadBlob(
      new Blob([svg], { type: 'image/svg+xml' }),
      `aether-sigil-${dream.seedHex}.svg`,
    );
    say('sigil saved as svg');
  }, [dream, accent, say]);

  const copyLink = useCallback(async () => {
    const url = `${window.location.origin}/studio?${new URLSearchParams({ p: prompt, m: mood })}`;
    try {
      await navigator.clipboard.writeText(url);
      say('link copied');
    } catch {
      say(url);
    }
  }, [prompt, mood, say]);

  const copyPalette = useCallback(async () => {
    const text = dream.palette.swatches.map((s) => `${s.name} ${s.hex}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      say('palette copied');
    } catch {
      say(text);
    }
  }, [dream, say]);

  const fullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  const restore = (r: { p: string; m: MoodId }) => {
    setPrompt(r.p);
    setMood(isMood(r.m) ? r.m : 'cosmic');
  };

  return (
    <main
      className="studio"
      style={{ ['--acc' as string]: accent, ['--acc-2' as string]: dream.palette.swatches[3]?.hex }}
    >
      <div className="wrap" style={{ paddingBottom: '5rem' }}>
        <div className="studio__grid">
          {/* ------------------------------------------------------- stage */}
          <div>
            <div className="stage" ref={stageRef}>
              <div className="stage__canvas">
                <AuroraCanvas
                  palette={dream.palette}
                  params={dream.params}
                  paused={paused}
                  scale={0.85}
                  canvasRef={canvasRef}
                  interactive
                />
              </div>
              <div className="stage__overlay" />

              <div className="stage__hud">
                <span>aether · latent field · 48d</span>
                <span style={{ color: synced === true ? '#6ee7b7' : undefined }}>
                  {busy
                    ? 'decoding…'
                    : synced === true
                      ? 'server parity ✓'
                      : synced === false
                        ? 'local decode'
                        : `seed ${dream.seedHex}`}
                </span>
              </div>

              <div className="stage__tools">
                <button
                  className="icon-btn"
                  onClick={() => setPaused((v) => !v)}
                  title={paused ? 'resume' : 'freeze the field'}
                >
                  {paused ? '▶' : '❚❚'}
                </button>
                <button className="icon-btn" onClick={fullscreen} title="fullscreen">
                  ⛶
                </button>
                <button className="icon-btn" onClick={savePoster} title="download poster">
                  ⤓
                </button>
              </div>

              <div className="stage__caption">
                <div>
                  <h1 className="stage__title" key={`t-${dream.seed}`}>
                    {dream.title}
                  </h1>
                  <div className="stage__sub">{dream.subtitle}</div>
                </div>
                <div className="stage__seed">
                  {dream.moodLabel.toUpperCase()}
                  <br />
                  {dream.seedHex}
                  <br />
                  res {Math.round(dream.resonance * 100)}
                </div>
              </div>
            </div>

            {/* --------------------------------------------------- composer */}
            <div className="panel composer">
              <div className="composer__row">
                <textarea
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setSynced(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void decode();
                    }
                  }}
                  placeholder="describe a dream you can't quite remember…"
                  spellCheck={false}
                  rows={2}
                />
                <div className="composer__side">
                  <button className="btn btn--primary" onClick={decode} disabled={busy}>
                    {busy ? 'decoding…' : 'Decode ⏎'}
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={randomize}>
                    ⟳ Surprise me
                  </button>
                </div>
              </div>

              <div className="composer__meta">
                <div className="moods">
                  {MOODS.map((m) => (
                    <button
                      key={m.id}
                      className="mood"
                      data-active={m.id === mood}
                      onClick={() => {
                        setMood(m.id);
                        setSynced(null);
                      }}
                      title={m.blurb}
                    >
                      <i>{m.glyph}</i>
                      {m.label}
                    </button>
                  ))}
                </div>
                <span className="mono">{dream.moodBlurb}</span>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------- side */}
          <aside className="side">
            <section className="panel block">
              <div className="block__head">
                <h2 className="block__title">The dream, in words</h2>
                <span className="mono">{dream.movements.length * 3} lines</span>
              </div>
              <div key={dream.seed}>
                {dream.movements.map((mv) => (
                  <div className="poem__movement" key={mv.label}>
                    <span className="poem__label">{mv.label}</span>
                    {mv.lines.map((line, i) => (
                      <p className="poem__line" key={i}>
                        {line}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              <ul className="omens">
                {dream.omens.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </section>

            <section className="panel block">
              <div className="block__head">
                <h2 className="block__title">Sigil</h2>
                <span className="mono">{dream.sigil.spokes} spokes</span>
              </div>
              <div className="sigil">
                <SigilMark sigil={dream.sigil} accent={accent} className="sigil-svg" />
                <div className="sigil__meta">
                  <strong>Seal of {dream.seedHex}</strong>
                  Generated from the same vector as the field above. It is yours alone — download it
                  as vector art.
                </div>
              </div>
            </section>

            <section className="panel block">
              <div className="block__head">
                <h2 className="block__title">Palette</h2>
                <button className="mono" onClick={copyPalette} style={{ cursor: 'pointer' }}>
                  copy
                </button>
              </div>
              <div className="swatches">
                {dream.palette.swatches.map((s, i) => (
                  <button
                    className="swatch"
                    key={`${s.hex}-${i}`}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(s.hex);
                        say(`${s.hex} copied`);
                      } catch {
                        say(s.hex);
                      }
                    }}
                  >
                    <div className="swatch__chip" style={{ background: s.hex }} />
                    <div className="swatch__meta">
                      <span className="swatch__name">{s.name}</span>
                      <span className="swatch__hex">{s.hex.toUpperCase()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel block">
              <div className="block__head">
                <h2 className="block__title">Latent readings</h2>
                <span className="mono">48d → 8</span>
              </div>
              <div className="latent">
                {dream.features.map((f) => (
                  <div className="feat" key={f.key} title={f.desc}>
                    <span className="feat__name">{f.name}</span>
                    <span className="feat__bar">
                      <span className="feat__fill" style={{ width: `${f.value * 100}%` }} />
                    </span>
                    <span className="feat__val">{Math.round(f.value * 100)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel block">
              <div className="block__head">
                <h2 className="block__title">Take it with you</h2>
              </div>
              <div className="actions">
                <button className="btn btn--sm" onClick={savePoster}>
                  Poster PNG
                </button>
                <button className="btn btn--sm" onClick={saveSigil}>
                  Sigil SVG
                </button>
                <button className="btn btn--sm" onClick={copyLink}>
                  Copy link
                </button>
                <Link href="/" className="btn btn--sm btn--ghost">
                  Index
                </Link>
              </div>

              {recent.length > 1 && (
                <div style={{ marginTop: '1.3rem' }}>
                  <span className="mono" style={{ display: 'block', marginBottom: '0.7rem' }}>
                    this session
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {recent.slice(0, 8).map((r, i) => {
                      const d = makeDream(r.p, r.m);
                      const grad = d.palette.swatches.map((s) => s.hex).join(', ');
                      return (
                        <button
                          key={`${r.p}-${i}`}
                          onClick={() => restore(r)}
                          title={`${d.title} — ${r.p}`}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            background: `linear-gradient(135deg, ${grad})`,
                            opacity: r.p === prompt && r.m === mood ? 1 : 0.55,
                            transition: 'all .3s var(--ease)',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      <div className="toast" data-show={toast !== null}>
        {toast}
      </div>
    </main>
  );
}
