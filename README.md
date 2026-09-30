[README.md](https://github.com/user-attachments/files/32853051/README.md)
# ÆTHER — Latent Dream Engine

A Next.js app that turns any sentence into a place.

Type a line of text. ÆTHER folds it into a **48-dimensional latent vector**, then decodes that
single vector through four heads at once:

| Head | Output |
| --- | --- |
| **Field** | a live, animated WebGL artwork (domain-warped fractal noise, running on your GPU) |
| **Palette** | five colours, constrained to the mood you chose |
| **Language** | a nine-line poem in three movements, plus three omens |
| **Sigil** | a unique vector mark generated from the same seed |

It is **deterministic**: the same sentence always produces the same dream, on any device, forever.
No API keys, no network calls, no telemetry, no random state.

---

## Run it

```bash
cd aether
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm start   # production
```

---

## What makes it tick

### 1. Fold — `lib/dream.ts` → `embed()`

```
tokens + character trigrams  ──FNV-1a──▶  48-dim vector, L2-clamped
```

Hashing both whole words *and* letter trigrams means similar prompts land near each other in the
latent space, so related dreams look like relatives.

### 2. Decode — four heads, one vector

- **`makeParams()`** — reads the vector + mood into shader uniforms: chaos, warp, glow, zoom,
  speed, grain, vignette, swirl, ridge.
- **`makePalette()`** — an HSL ramp anchored to the mood's hue window (`span` bounds how far it may
  travel, so a *feral* dream never comes back pastel blue).
- **`makePoem()`** — a seeded grammar with adjective/noun/verb banks and your own words woven in.
- **`makeSigil()`** — rings, spokes, arcs, chords and dots, all seeded.

### 3. Render — `lib/shader.ts`

A hand-written GLSL fragment shader (no three.js, no dependencies):

- 2D simplex noise → 5-octave fbm
- two rounds of **domain warping** (Inigo Quilez's technique)
- ridged "veins" for glow, a high-frequency detail term for texture
- cursor gravity: the field folds around your pointer
- exposure → Reinhard → gamma → contrast-about-a-pivot → saturation, then film grain

Palette values are uploaded as five stops and ramped in the shader, so the swatches you see are
exactly the colours on screen.

### 4. Morph

`components/AuroraCanvas.tsx` never rebuilds the GL context when you type. It keeps a set of
current values that *chase* the target every frame (`k = 1 - exp(-dt * 2.6)`), so changing the
prompt melts one dream into the next instead of cutting.

---

## Route map

```
app/
  page.tsx              landing: hero shader, marquee, cards, AI gallery, CTA
  studio/page.tsx       server-renders the dream for a shared link (no flash)
  api/dream/route.ts    POST/GET — the same pure function, over HTTP
components/
  AuroraCanvas.tsx      WebGL canvas: context, uniforms, morphing, pause, fallbacks
  StudioClient.tsx      the studio: composer, moods, poem, sigil, palette, export
  Hero.tsx              cycling typewriter hero
  Sigil.tsx / Reveal.tsx
lib/
  dream.ts              the model (hash → vector → 4 heads)
  shader.ts             GLSL source
  sigil.ts              sigil → SVG string (rendered *and* downloaded)
  poster.ts             canvas compositor: frame + type + palette → 1600×2000 PNG
public/
  fonts/                self-hosted Space Grotesk, Instrument Serif, JetBrains Mono
  dreams/               featured dreamscapes (AI-generated imagery)
```

## API

```bash
curl "http://localhost:3000/api/dream?p=a%20machine%20built%20to%20remember%20rain&m=ancient"
curl -X POST localhost:3000/api/dream \
  -H 'content-type: application/json' \
  -d '{"prompt":"a machine built to remember rain","mood":"ancient"}'
```

Returns the full `Dream` object — palette, params, poem, sigil, features, seed.

## Sharing

`/studio?p=<prompt>&m=<mood>` rehydrates the exact dream server-side, so a link is a complete,
self-contained art piece. There is also a **Poster PNG** (1600×2000) and **Sigil SVG** export in
the studio.

## Notes

- Moods: `serene` `feral` `cosmic` `melancholy` `euphoric` `ancient` `void`.
- The shader auto-pauses when off-screen or when the tab is hidden, and honours
  `prefers-reduced-motion`.
- Everything is self-hosted — the app renders identically with the network unplugged.
