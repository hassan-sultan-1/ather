/**
 * AETHER — Latent Engine
 * ---------------------------------------------------------------------------
 * A tiny, deterministic "model" that maps any string of text onto a point in a
 * 48-dimensional latent space, then decodes that point into an artwork:
 * a GLSL field, a colour palette, a poem, a sigil and a set of readings.
 *
 * It is not a neural network — it is a hash-embedding with hand-tuned decoding
 * heads. The important property is that it is *stable*: the same prompt always
 * produces the same dream, on the server or in the browser, so every dream has
 * a shareable URL.
 */

export type MoodId =
  | 'serene'
  | 'feral'
  | 'cosmic'
  | 'melancholy'
  | 'euphoric'
  | 'ancient'
  | 'void';

export interface MoodSpec {
  id: MoodId;
  label: string;
  glyph: string;
  blurb: string;
  /** hue window in degrees, may wrap past 360 */
  hue: [number, number];
  /** how far the ramp is allowed to travel, in degrees */
  span: number;
  sat: [number, number];
  light: [number, number];
  base: {
    chaos: number;
    warp: number;
    glow: number;
    zoom: number;
    speed: number;
  };
}

export const MOODS: MoodSpec[] = [
  {
    id: 'serene',
    label: 'Serene',
    glyph: '≈',
    blurb: 'Still water, long horizons, nothing in a hurry.',
    hue: [168, 222],
    span: 58,
    sat: [0.42, 0.68],
    light: [0.56, 0.74],
    base: { chaos: 0.34, warp: 2.1, glow: 0.34, zoom: 1.65, speed: 0.45 },
  },
  {
    id: 'feral',
    label: 'Feral',
    glyph: '⌁',
    blurb: 'Teeth, weather, blood-warm light. It bites back.',
    hue: [350, 34],
    span: 48,
    sat: [0.68, 0.95],
    light: [0.44, 0.62],
    base: { chaos: 1.05, warp: 3.7, glow: 0.72, zoom: 1.05, speed: 1.15 },
  },
  {
    id: 'cosmic',
    label: 'Cosmic',
    glyph: '✦',
    blurb: 'Deep field. You are very small and it is fine.',
    hue: [248, 318],
    span: 82,
    sat: [0.6, 0.9],
    light: [0.44, 0.66],
    base: { chaos: 0.72, warp: 3.0, glow: 0.9, zoom: 1.3, speed: 0.68 },
  },
  {
    id: 'melancholy',
    label: 'Melancholy',
    glyph: '◞',
    blurb: 'Beautiful, and slightly further away than yesterday.',
    hue: [196, 246],
    span: 38,
    sat: [0.18, 0.42],
    light: [0.34, 0.56],
    base: { chaos: 0.24, warp: 1.75, glow: 0.24, zoom: 2.0, speed: 0.33 },
  },
  {
    id: 'euphoric',
    label: 'Euphoric',
    glyph: '❋',
    blurb: 'Too much light. Say yes anyway.',
    hue: [318, 62],
    span: 110,
    sat: [0.7, 0.98],
    light: [0.58, 0.78],
    base: { chaos: 0.86, warp: 3.3, glow: 0.78, zoom: 1.15, speed: 1.0 },
  },
  {
    id: 'ancient',
    label: 'Ancient',
    glyph: '❖',
    blurb: 'Amber, dust, and something that outlived its name.',
    hue: [22, 52],
    span: 42,
    sat: [0.34, 0.62],
    light: [0.46, 0.7],
    base: { chaos: 0.45, warp: 2.6, glow: 0.5, zoom: 1.8, speed: 0.42 },
  },
  {
    id: 'void',
    label: 'Void',
    glyph: '○',
    blurb: 'Almost nothing. Look longer.',
    hue: [202, 268],
    span: 16,
    sat: [0.04, 0.2],
    light: [0.46, 0.72],
    base: { chaos: 0.55, warp: 2.45, glow: 0.3, zoom: 1.5, speed: 0.55 },
  },
];

export const MOOD_MAP: Record<string, MoodSpec> = Object.fromEntries(
  MOODS.map((m) => [m.id, m]),
);

export function isMood(x: unknown): x is MoodId {
  return typeof x === 'string' && x in MOOD_MAP;
}

/* -------------------------------------------------------------------------- */
/*  primitives                                                                 */
/* -------------------------------------------------------------------------- */

export const LATENT_DIM = 48;

/** FNV-1a, 32-bit. Fast, well-distributed, deterministic across engines. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small, fast, seedable PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/* -------------------------------------------------------------------------- */
/*  text → latent vector                                                       */
/* -------------------------------------------------------------------------- */

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Hashed bag-of-tokens + character-bigram embedding.
 * Two prompts that share words (or even just letter shapes) land near each
 * other in the latent space, which is what makes the gallery feel coherent.
 */
export function embed(text: string): number[] {
  const v = new Array<number>(LATENT_DIM).fill(0);
  const tokens = tokenize(text);
  const source = tokens.length ? tokens : ['silence'];

  for (const tok of source) {
    const h = fnv1a(tok);
    const weight = 1 / Math.sqrt(tok.length);
    for (let k = 0; k < 3; k++) {
      const idx = ((h >>> (k * 6)) ^ Math.imul(h, k + 7)) % LATENT_DIM;
      const sign = ((h >>> (k * 2 + 3)) & 1) === 0 ? 1 : -1;
      const mag = (((h >>> (k * 5 + 1)) & 255) / 255) * 0.8 + 0.2;
      v[idx] += sign * mag * weight;
    }
    // character trigrams keep near-miss words related
    const padded = `^${tok}$`;
    for (let i = 0; i + 3 <= padded.length; i++) {
      const g = fnv1a(padded.slice(i, i + 3));
      v[g % LATENT_DIM] += (((g >>> 9) & 255) / 255 - 0.5) * 0.35;
    }
  }

  let max = 0;
  for (const x of v) max = Math.max(max, Math.abs(x));
  if (max > 0) for (let i = 0; i < v.length; i++) v[i] /= max;
  return v;
}

/* -------------------------------------------------------------------------- */
/*  readings                                                                   */
/* -------------------------------------------------------------------------- */

export interface Feature {
  key: string;
  name: string;
  desc: string;
  value: number;
}

const FEATURE_DEFS: { key: string; name: string; desc: string }[] = [
  { key: 'luminance', name: 'Luminance', desc: 'how much light the dream keeps' },
  { key: 'entropy', name: 'Entropy', desc: 'how freely it disobeys' },
  { key: 'density', name: 'Density', desc: 'how crowded its interior is' },
  { key: 'drift', name: 'Drift', desc: 'how far it travels while you watch' },
  { key: 'asymmetry', name: 'Asymmetry', desc: 'how unevenly it breathes' },
  { key: 'turbulence', name: 'Turbulence', desc: 'how violently it folds' },
  { key: 'warmth', name: 'Warmth', desc: 'how close it sits to a fire' },
  { key: 'silence', name: 'Silence', desc: 'how much it refuses to say' },
];

function sliceMean(v: number[], from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += v[i];
  return s / (to - from);
}

export function featuresFrom(
  emb: number[],
  tokens: string[],
  mood: MoodSpec,
  rng: () => number,
): Feature[] {
  const uniq = new Set(tokens).size;
  const len = Math.max(1, tokens.length);
  const avgLen = tokens.reduce((a, t) => a + t.length, 0) / len;
  const warmthMood = mood.hue[0] > 300 || mood.hue[1] < 70 ? 1 : mood.id === 'cosmic' ? 0.3 : 0.5;

  const raw: Record<string, number> = {
    luminance: 0.5 + sliceMean(emb, 0, 6) * 0.55 + (mood.light[0] - 0.5) * 0.8,
    entropy: clamp01(uniq / len) * 0.7 + Math.abs(sliceMean(emb, 6, 12)) * 0.6,
    density: clamp01(avgLen / 11) * 0.75 + Math.abs(sliceMean(emb, 12, 18)) * 0.5,
    drift: 0.35 + Math.abs(sliceMean(emb, 18, 24)) * 0.9 + (mood.base.speed - 0.5) * 0.35,
    asymmetry: Math.abs(sliceMean(emb, 24, 30)) * 1.1 + 0.12,
    turbulence: clamp01(Math.abs(sliceMean(emb, 30, 36)) * 1.2 + (mood.base.warp - 2) * 0.22),
    warmth: clamp01(warmthMood * 0.65 + sliceMean(emb, 36, 42) * 0.5),
    silence: clamp01(0.85 - Math.abs(sliceMean(emb, 42, 48)) * 0.9 - clamp01(len / 40) * 0.4),
  };

  return FEATURE_DEFS.map((d) => ({
    ...d,
    value: clamp01(raw[d.key] * 0.88 + rng() * 0.12),
  }));
}

/* -------------------------------------------------------------------------- */
/*  colour                                                                     */
/* -------------------------------------------------------------------------- */

export type Vec3 = [number, number, number];

export interface Palette {
  swatches: { hex: string; name: string }[];
  /** the exact RGB values the shader ramps between */
  colors: Vec3[];
}

/** Reinhard + gentle gamma — must stay in sync with the fragment shader. */
export function tonemap(x: number): number {
  const v = Math.max(0, x);
  const t = v / (1 + v);
  return Math.pow(t, 0.9);
}

export function hex(r: number, g: number, b: number): string {
  const to = (x: number) =>
    Math.round(clamp01(x) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** The shader's grade, approximated on the CPU so swatches match the canvas. */
export function grade(c: Vec3): Vec3 {
  const exposed = [tonemap(c[0] * 1.35), tonemap(c[1] * 1.35), tonemap(c[2] * 1.35)];
  const contrasted = exposed.map((v) => clamp01((v - 0.46) * 1.34 + 0.46));
  const l = 0.2126 * contrasted[0] + 0.7152 * contrasted[1] + 0.0722 * contrasted[2];
  return contrasted.map((v) => clamp01(l + (v - l) * 1.18)) as Vec3;
}

export function hslToRgb(hDeg: number, s: number, l: number): Vec3 {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  if (s <= 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

const SWATCH_NAMES = [
  'veil',
  'ember',
  'tide',
  'ash',
  'bloom',
  'signal',
  'dust',
  'halo',
  'marrow',
  'static',
  'pollen',
  'glass',
];

/**
 * The five stops of every dream ramp: a deep shadow, two mid tones, a bright
 * highlight and a dark accent. Hue travel is bounded by the mood so a "feral"
 * dream never comes back pastel blue.
 */
const RAMP = [
  { dh: -0.3, dl: 0.28, ds: 1.05 },
  { dh: 0.08, dl: 0.72, ds: 1.05 },
  { dh: 0.42, dl: 1.18, ds: 0.85 },
  { dh: 0.72, dl: 0.92, ds: 0.98 },
  { dh: 1.0, dl: 0.44, ds: 1.15 },
];

export function makePalette(seed: number, mood: MoodSpec): Palette {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const hSpan = (mood.hue[1] - mood.hue[0] + 360) % 360 || 360;
  const hStart = mood.hue[0] + rng() * hSpan;
  const sat = lerp(mood.sat[0], mood.sat[1], rng());
  const light = lerp(mood.light[0], mood.light[1], rng()) * 1.12;
  const dir = rng() < 0.5 ? -1 : 1;
  const span = mood.span * (0.65 + rng() * 0.7);
  const wobble = (rng() - 0.5) * 9;

  const colors = RAMP.map((st) =>
    hslToRgb(hStart + dir * span * st.dh + wobble, clamp01(sat * st.ds), clamp01(light * st.dl)),
  );

  const used = new Set<string>();
  const swatches = colors.map((c) => {
    let name = pick(rng, SWATCH_NAMES);
    let guard = 0;
    while (used.has(name) && guard++ < 20) name = pick(rng, SWATCH_NAMES);
    used.add(name);
    // approximate what survives the shader's grade, so the chips match the frame
    const g = grade(c);
    return { hex: hex(g[0], g[1], g[2]), name };
  });

  return { swatches, colors };
}

/* -------------------------------------------------------------------------- */
/*  shader parameters                                                          */
/* -------------------------------------------------------------------------- */

export interface Params {
  chaos: number;
  warp: number;
  glow: number;
  zoom: number;
  speed: number;
  grain: number;
  vignette: number;
  swirl: number;
  ridge: number;
}

export function makeParams(seed: number, mood: MoodSpec, feats: Feature[]): Params {
  const rng = mulberry32(seed ^ 0x51ed270b);
  const f = Object.fromEntries(feats.map((x) => [x.key, x.value])) as Record<string, number>;
  const jitter = (amt: number) => 1 + (rng() - 0.5) * amt;

  return {
    chaos: mood.base.chaos * jitter(0.5) + f.entropy * 0.35,
    warp: mood.base.warp * jitter(0.3) + f.turbulence * 1.1,
    glow: clamp01(mood.base.glow * jitter(0.4) + f.luminance * 0.3),
    zoom: Math.max(0.6, mood.base.zoom * jitter(0.35) - f.density * 0.35),
    speed: Math.max(0.12, mood.base.speed * jitter(0.4) + f.drift * 0.25),
    grain: 0.015 + rng() * 0.035,
    vignette: 0.35 + f.silence * 0.45,
    swirl: 0.5 + f.asymmetry * 1.4,
    ridge: 0.3 + f.turbulence * 0.9,
  };
}

/* -------------------------------------------------------------------------- */
/*  sigil                                                                      */
/* -------------------------------------------------------------------------- */

export interface Sigil {
  rotation: number;
  rings: number[];
  spokes: number;
  spokeLen: [number, number];
  arcs: { r: number; a0: number; a1: number; w: number }[];
  chords: [number, number, number, number][];
  dots: { x: number; y: number; r: number }[];
  core: number;
}

export function makeSigil(seed: number): Sigil {
  const rng = mulberry32(seed ^ 0x2545f491);
  const rings = [96, 78 + rng() * 12, 56 + rng() * 16, 30 + rng() * 14].sort((a, b) => b - a);
  const spokes = 3 + Math.floor(rng() * 7);
  const arcCount = 2 + Math.floor(rng() * 4);
  const arcs = Array.from({ length: arcCount }, () => {
    const r = 24 + rng() * 74;
    const a0 = rng() * Math.PI * 2;
    const len = (0.25 + rng() * 1.5) * Math.PI;
    return { r, a0, a1: a0 + len, w: 0.7 + rng() * 1.9 };
  });
  const chordCount = 3 + Math.floor(rng() * 6);
  const chords = Array.from({ length: chordCount }, () => {
    const p = () => {
      const a = rng() * Math.PI * 2;
      const r = 20 + rng() * 78;
      return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r] as const;
    };
    const s = p();
    const e = p();
    return [s[0], s[1], e[0], e[1]] as [number, number, number, number];
  });
  const dots = Array.from({ length: 5 + Math.floor(rng() * 9) }, () => {
    const a = rng() * Math.PI * 2;
    const r = 14 + rng() * 86;
    return { x: 100 + Math.cos(a) * r, y: 100 + Math.sin(a) * r, r: 0.9 + rng() * 2.6 };
  });

  return {
    rotation: rng() * 360,
    rings,
    spokes,
    spokeLen: [0.35 + rng() * 0.3, 0.7 + rng() * 0.28],
    arcs,
    chords,
    dots,
    core: 4 + rng() * 10,
  };
}

/* -------------------------------------------------------------------------- */
/*  language                                                                   */
/* -------------------------------------------------------------------------- */

const ADJ = [
  'luminous', 'feral', 'paper-thin', 'salt-bitten', 'unfinished', 'tidal',
  'electric', 'mossy', 'cathedral', 'obsidian', 'humming', 'buried',
  'weightless', 'brine-dark', 'gilded', 'mother-of-pearl', 'hollow',
  'inherited', 'slow', 'glass', 'threshold', 'nine-tongued', 'quartz',
  'drowned', 'iron', 'sunken', 'unspooled',
];

const NOUN = [
  'lantern', 'tide', 'cathedral', 'machine', 'moth', 'oracle', 'river',
  'currency', 'ghost', 'orchard', 'engine', 'mirror', 'ember', 'archive',
  'signal', 'bone', 'hourglass', 'throat', 'map', 'key', 'weather',
  'harvest', 'antenna', 'lullaby', 'vessel', 'horse', 'contract', 'sea',
  'window', 'needle', 'altar', 'understudy',
];

const VERB = [
  'unspools', 'remembers', 'dissolves', 'devours', 'hums', 'fractures',
  'blooms', 'drowns', 'sharpens', 'forgets', 'inherits', 'orbits',
  'unlearns', 'ferments', 'listens', 'gathers', 'erodes', 'bends',
  'confesses', 'ripens',
];

const TITLE_ADJ = [
  'Glass', 'Second', 'Hollow', 'Bright', 'Slow', 'Buried', 'Salt',
  'Feral', 'Quiet', 'Endless', 'Nine', 'Fading', 'Wild', 'Amber',
];

const TITLE_NOUN = [
  'Orchard', 'Machine', 'Cathedral', 'Tide', 'Lantern', 'Archive',
  'Signal', 'Weather', 'Mirror', 'Harvest', 'Orbit', 'Throat',
  'Understudy', 'Hourglass', 'Antenna',
];

const SUBTITLES = [
  'after the long water',
  'for the ones who left early',
  'a field recording',
  'second attempt at morning',
  'as told by the machine',
  'unedited',
  'no longer a request',
  'in three movements',
  'found under the floorboard',
  'translated badly, on purpose',
];

const MOVEMENTS = ['I · The Signal', 'II · The Descent', 'III · The Vow'];

/** infinitives — used wherever grammar needs a bare verb */
const VERB_BASE = [
  'unspool', 'remember', 'dissolve', 'devour', 'hum', 'fracture',
  'bloom', 'drown', 'sharpen', 'forget', 'inherit', 'orbit',
  'unlearn', 'ferment', 'listen', 'gather', 'erode', 'bend',
  'confess', 'ripen',
];

/** filler words are useless inside a poem */
const STOPWORDS = new Set([
  'the', 'and', 'but', 'for', 'with', 'that', 'this', 'was', 'were', 'are',
  'have', 'has', 'had', 'not', 'you', 'your', 'yours', 'from', 'into',
  'about', 'would', 'could', 'should', 'there', 'their', 'they', 'them',
  'been', 'being', 'what', 'when', 'where', 'which', 'while', 'will',
  'just', 'like', 'only', 'very', 'much', 'more', 'most', 'some', 'than',
]);

/** verbs that comfortably take an object */
const VERB_TRANS = [
  'unspool', 'remember', 'dissolve', 'devour', 'inherit', 'forget',
  'gather', 'bend', 'confess', 'fracture', 'erode', 'drown', 'keep',
];

/** prompt words are dropped into singular noun slots, so calm the plurals down */
function singularize(w: string): string {
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) {
    return w.slice(0, -1);
  }
  return w;
}

function article(noun: string): string {
  return `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;
}

export interface Poem {
  title: string;
  subtitle: string;
  movements: { label: string; lines: string[] }[];
  omens: string[];
}

export function makePoem(seed: number, tokens: string[], mood: MoodSpec): Poem {
  const rng = mulberry32(seed ^ 0x1b873593);
  const content = tokens.filter(
    (t) => t.length > 2 && !STOPWORDS.has(t) && !t.endsWith("'s"),
  );
  const word = (i: number) =>
    content.length
      ? singularize(content[(Math.floor(rng() * content.length) + i) % content.length])
      : null;
  const w0 = word(0);
  const w1 = word(1);
  const w2 = word(2);

  const A = () => pick(rng, ADJ);
  const N = () => pick(rng, NOUN);
  const V = () => pick(rng, VERB);
  const VB = () => pick(rng, VERB_BASE);
  const AN = () => article(N());

  const L1 = [
    `A ${A()} ${N()} ${V()} at the edge of ${w0 ?? 'the dark'},`,
    `Something ${A()} ${V()} underneath the ${w0 ?? 'floor'},`,
    `First there is only ${w0 ?? 'light'}, and then there is too much of it,`,
    `It arrives wearing the shape of ${AN()}, and answers to ${w0 ?? 'no one'}.`,
  ];
  const L2 = [
    `and every ${N()} leans closer to listen.`,
    `and the ${N()} forgets what it was holding.`,
    `and the room grows a second ${N()}.`,
    `and the ${w1 ?? 'air'} learns to ${VB()}.`,
  ];
  const L3 = [
    `You called it ${w1 ?? 'almost'}; it had already named you.`,
    `You have been here before, in the ${A()} version.`,
    `Nothing asks permission. That is the whole instruction.`,
    `Say ${w1 ?? 'it'} once more and it becomes ${AN()}.`,
  ];

  const M1 = [
    `Below, the ${A()} ${N()} ${V()} without sound,`,
    `Underneath: ${AN()} still ${V()} where you left it,`,
    `The descent is only ${AN()} pretending to be ${AN()},`,
    `Down here the ${w2 ?? 'water'} keeps its own accounts,`,
  ];
  const M2 = [
    `trading ${N()} for ${N()}, ${N()} for light.`,
    `and the ${A()} dark ${V()} like an animal.`,
    `Every ${N()} you lost is filed and glowing.`,
    `It costs one ${N()} to look directly at it.`,
  ];
  const M3 = [
    `Nothing here is lost — only rearranged.`,
    `You are allowed to ${VB()}. That is the toll.`,
    `The ${N()} is a door if you stop arguing.`,
    `Keep walking. The floor is mostly ${A()}.`,
  ];

  const V1 = [
    `Carry this ${N()} back across the ${A()} water.`,
    `When you wake, put the ${N()} somewhere ordinary.`,
    `Take only the ${A()} ${N()}. Leave the rest burning.`,
  ];
  const V2 = [
    `When it ${V()}, do not ${VB()} — ${VB()} instead.`,
    `If anyone asks, it was always ${AN()}.`,
    `Do not ${VB()} the ${N()}. It is doing its best.`,
  ];
  const V3 = [
    `The dream has already decided to keep you.`,
    `It will ${VB()} in your hands by morning.`,
    `${mood.label}: this is the part you were promised.`,
    `Return whenever the ${N()} gets loud.`,
  ];

  const movements = [
    { label: MOVEMENTS[0], lines: [pick(rng, L1), pick(rng, L2), pick(rng, L3)] },
    { label: MOVEMENTS[1], lines: [pick(rng, M1), pick(rng, M2), pick(rng, M3)] },
    { label: MOVEMENTS[2], lines: [pick(rng, V1), pick(rng, V2), pick(rng, V3)] },
  ];

  const omenBank = [
    () => `${cap(AN())} arrives within ${3 + Math.floor(rng() * 9)} days.`,
    () => `Do not trust the ${A()} ${N()}. It is ${AN()} in disguise.`,
    () => `You will ${pick(rng, VERB_TRANS)} something you meant to keep.`,
    () => `The ${N()} ${V()} at ${1 + Math.floor(rng() * 11)}. Write it down.`,
    () => `Someone is saying your name into ${AN()}.`,
  ];

  const omens: string[] = [];
  const pool = [...omenBank];
  for (let i = 0; i < 3 && pool.length; i++) {
    omens.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]());
  }

  return {
    title: `The ${pick(rng, TITLE_ADJ)} ${pick(rng, TITLE_NOUN)}`,
    subtitle: pick(rng, SUBTITLES),
    movements,
    omens,
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* -------------------------------------------------------------------------- */
/*  the dream                                                                  */
/* -------------------------------------------------------------------------- */

export interface Dream {
  prompt: string;
  mood: MoodId;
  seed: number;
  seedHex: string;
  title: string;
  subtitle: string;
  movements: { label: string; lines: string[] }[];
  omens: string[];
  palette: Palette;
  params: Params;
  sigil: Sigil;
  features: Feature[];
  embedding: number[];
  resonance: number;
  moodLabel: string;
  moodBlurb: string;
}

export function makeDream(rawPrompt: string, moodId: MoodId = 'cosmic'): Dream {
  const mood = MOOD_MAP[moodId] ?? MOOD_MAP.cosmic;
  const prompt = normalizeText(rawPrompt) || 'an unnamed dream';
  const seed = fnv1a(`${moodId}|${prompt.toLowerCase()}`);
  const rng = mulberry32(seed);
  const tokens = tokenize(prompt);
  const embedding = embed(prompt);
  const features = featuresFrom(embedding, tokens, mood, rng);
  const palette = makePalette(seed, mood);
  const params = makeParams(seed, mood, features);
  const sigil = makeSigil(seed);
  const poem = makePoem(seed, tokens, mood);

  const resonance = clamp01(
    features.reduce((a, f) => a + f.value, 0) / features.length + (tokens.length > 0 ? 0.08 : 0),
  );

  return {
    prompt,
    mood: mood.id,
    seed,
    seedHex: seed.toString(16).toUpperCase().padStart(8, '0'),
    title: poem.title,
    subtitle: poem.subtitle,
    movements: poem.movements,
    omens: poem.omens,
    palette,
    params,
    sigil,
    features,
    embedding,
    resonance,
    moodLabel: mood.label,
    moodBlurb: mood.blurb,
  };
}

export const SEED_PROMPTS = [
  'a city that only exists when you are asleep in it',
  'the last blue hour of a very long summer',
  'my grandmother\'s house, but the sea is inside it',
  'a machine built to remember rain',
  'calling a number that rings in a year you survived',
  'animals made of static, watching politely',
  'the moment before a kiss, stretched into a landscape',
  'everything I meant to say, organized by weather',
  'a cathedral grown from a single held breath',
  'being followed home by your own childhood',
];
