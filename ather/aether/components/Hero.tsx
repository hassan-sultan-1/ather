'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AuroraCanvas from './AuroraCanvas';
import { makeDream, type MoodId } from '@/lib/dream';

const HERO: { prompt: string; mood: MoodId }[] = [
  { prompt: 'a city that only exists when you are asleep in it', mood: 'cosmic' },
  { prompt: 'a machine built to remember rain', mood: 'ancient' },
  { prompt: 'the last blue hour of a very long summer', mood: 'melancholy' },
  { prompt: 'a cathedral grown from a single held breath', mood: 'serene' },
];

export default function Hero() {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');

  const dreams = useMemo(() => HERO.map((h) => makeDream(h.prompt, h.mood)), []);
  const dream = dreams[idx];

  useEffect(() => {
    const id = window.setInterval(() => setIdx((v) => (v + 1) % HERO.length), 11000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const target = HERO[idx].prompt;
    let i = 0;
    setTyped('');
    const id = window.setInterval(() => {
      i += 1;
      setTyped(target.slice(0, i));
      if (i >= target.length) window.clearInterval(id);
    }, 26);
    return () => window.clearInterval(id);
  }, [idx]);

  const accent = dream.palette.swatches[1]?.hex ?? '#b98cff';

  return (
    <header className="hero">
      <div className="hero__canvas">
        <AuroraCanvas
          key="hero"
          palette={dream.palette}
          params={dream.params}
          scale={0.72}
          interactive
        />
      </div>
      <div className="hero__veil" />

      <div className="hero__inner">
        <div className="hero__kicker">
          <span className="hero__dot" />
          deterministic · offline · yours
        </div>

        <h1 className="hero__title">
          Dreams,
          <br />
          <em>rendered</em>
        </h1>

        <p className="hero__sub">
          <b>AETHER</b> turns a sentence into a place. Every word is folded into a 48-dimensional
          latent vector, then decoded into a living field of light, a palette, a poem and a sigil —
          none of which will ever exist again unless you type the same thing twice.
        </p>

        <div className="hero__cta">
          <Link
            href="/studio"
            className="btn btn--primary"
            style={{ ['--acc' as string]: accent, ['--acc-2' as string]: dream.palette.swatches[3]?.hex }}
          >
            Enter the engine →
          </Link>
          <Link href="#how" className="btn">
            How it works
          </Link>
        </div>

        <div className="hero__typed">
          aether.decode(&quot;
          <span>{typed}</span>
          <i className="caret" />
          &quot;)
        </div>
      </div>

      <div className="scroll-hint">
        <span>scroll</span>
        <i />
      </div>
    </header>
  );
}
