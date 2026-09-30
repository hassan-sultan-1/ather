import Link from 'next/link';
import Hero from '@/components/Hero';
import Reveal from '@/components/Reveal';
import { makeDream, type MoodId } from '@/lib/dream';

const FEATURED: { src: string; prompt: string; mood: MoodId }[] = [
  { src: '/dreams/dream-01.jpg', prompt: 'a nebula breathing under black water', mood: 'cosmic' },
  { src: '/dreams/dream-02.jpg', prompt: 'the last monolith before the fog', mood: 'ancient' },
  { src: '/dreams/dream-03.jpg', prompt: 'chrome tide at the end of the world', mood: 'euphoric' },
  { src: '/dreams/dream-04.jpg', prompt: 'a library of every prayer ever mislaid', mood: 'melancholy' },
];

const CARDS = [
  {
    n: '01',
    t: 'One sentence in',
    b: 'A prompt, a memory, a shopping list — the engine does not care. It only cares how the words are shaped.',
  },
  {
    n: '02',
    t: '48 dimensions',
    b: 'Your text is hashed into a latent vector. Prompts that share words land near each other, so related dreams look like relatives.',
  },
  {
    n: '03',
    t: 'Four decoding heads',
    b: 'The vector is read four ways at once: as a GLSL noise field, as a palette, as language, and as a sigil.',
  },
  {
    n: '04',
    t: 'It never repeats',
    b: 'Billions of stable states, one per string. Type it again in a year and you get the exact same dream back.',
  },
];

const STEPS = [
  {
    n: 'Fold',
    b: 'Tokens and character trigrams are hashed into a 48-dimensional unit vector. No weights, no network — just arithmetic that behaves like memory.',
  },
  {
    n: 'Decode',
    b: 'Four heads read the same vector: field parameters for the shader, a cosine palette, a seeded grammar for the poem, and a geometry for your sigil.',
  },
  {
    n: 'Render',
    b: 'A domain-warped fractal noise field runs on your GPU at 60fps. Move the cursor and the dream folds around you.',
  },
];

export default function Page() {
  const featured = FEATURED.map((f) => ({ ...f, dream: makeDream(f.prompt, f.mood) }));

  return (
    <main>
      <Hero />

      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {[...featured, ...featured].map((f, i) => (
            <span className="marquee__item" key={i}>
              {f.dream.title} <b>·</b> <span className="mono">{f.dream.seedHex}</span>
            </span>
          ))}
        </div>
      </div>

      <section className="section wrap" id="what">
        <Reveal>
          <div className="section__head">
            <div>
              <p className="mono">What it is</p>
              <h2 className="section__title">
                A dream engine with
                <br />
                <em>no network connection</em>
              </h2>
            </div>
            <p className="section__note">
              AETHER is a small, deliberate machine: a hash function, a palette model, a grammar and
              a shader. Nothing leaves your browser, nothing is random, and nothing is stored unless
              you decide to keep it.
            </p>
          </div>
        </Reveal>

        <div className="cards">
          {CARDS.map((c, i) => (
            <Reveal key={c.n} delay={i * 90}>
              <article className="card" style={{ height: '100%' }}>
                <span className="card__num">{c.n}</span>
                <h3 className="card__title">{c.t}</h3>
                <p className="card__body">{c.b}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section wrap" id="how">
        <Reveal>
          <div className="section__head">
            <div>
              <p className="mono">How it works</p>
              <h2 className="section__title">
                Fold, decode, <em>render</em>
              </h2>
            </div>
            <p className="section__note">
              The whole model is a few hundred lines of deterministic arithmetic. You can read it,
              argue with it, and run it offline.
            </p>
          </div>
        </Reveal>

        <div className="cards">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 110}>
              <article className="card" style={{ height: '100%' }}>
                <span className="card__num">0{i + 1}</span>
                <h3 className="card__title">{s.n}</h3>
                <p className="card__body">{s.b}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section wrap" id="gallery">
        <Reveal>
          <div className="section__head">
            <div>
              <p className="mono">Featured dreams</p>
              <h2 className="section__title">
                Rendered from
                <br />
                <em>four sentences</em>
              </h2>
            </div>
            <p className="section__note">
              Each of these started as a line of text. Click through and try your own — the engine
              is one field away.
            </p>
          </div>
        </Reveal>

        <div className="gallery">
          {featured.map((f, i) => (
            <Reveal key={f.src} delay={i * 80}>
              <Link href={`/studio?p=${encodeURIComponent(f.prompt)}&m=${f.mood}`} className="shot">
                <img src={f.src} alt={f.dream.title} loading="lazy" />
                <div className="shot__meta">
                  <span className="shot__title">{f.dream.title}</span>
                  <span className="shot__seed">{f.dream.seedHex}</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section wrap">
        <Reveal>
          <div
            className="panel"
            style={{
              padding: 'clamp(2.5rem, 6vw, 5rem)',
              textAlign: 'center',
              display: 'grid',
              justifyItems: 'center',
              gap: '1.6rem',
            }}
          >
            <p className="mono">Your turn</p>
            <h2
              className="section__title"
              style={{ fontSize: 'clamp(2.2rem, 6vw, 4.4rem)', margin: 0 }}
            >
              Type something true
              <br />
              <em>and see what it looks like</em>
            </h2>
            <Link href="/studio" className="btn btn--primary">
              Enter the engine →
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="footer">
        <div className="wrap footer__row">
          <span>AETHER · latent dream engine · built with Next.js, WebGL and too much coffee</span>
          <span className="mono">no keys · no telemetry · no repeats</span>
        </div>
      </footer>
    </main>
  );
}
