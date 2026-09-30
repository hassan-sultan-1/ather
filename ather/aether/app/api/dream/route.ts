import { NextResponse } from 'next/server';
import { isMood, makeDream } from '@/lib/dream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function build(body: any, sp?: URLSearchParams) {
  const rawPrompt =
    (typeof body?.prompt === 'string' ? body.prompt : sp?.get('p')) ?? 'an unnamed dream';
  const rawMood = (typeof body?.mood === 'string' ? body.mood : sp?.get('m')) ?? 'cosmic';
  const prompt = String(rawPrompt).slice(0, 300);
  const mood = isMood(rawMood) ? rawMood : 'cosmic';
  return makeDream(prompt, mood);
}

export async function POST(request: Request) {
  const started = Date.now();
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }
  const dream = build(body);

  // a beat of latency so the decode feels like inference rather than arithmetic
  await new Promise((r) => setTimeout(r, 280));

  return NextResponse.json({
    dream,
    meta: {
      engine: 'aether-latent-1',
      dimensions: 48,
      ms: Date.now() - started,
      deterministic: true,
    },
  });
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const dream = build(null, sp);
  return NextResponse.json({ dream, meta: { engine: 'aether-latent-1', dimensions: 48 } });
}
