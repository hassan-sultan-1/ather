import StudioClient from '@/components/StudioClient';
import { isMood, makeDream, type MoodId } from '@/lib/dream';

export const metadata = {
  title: 'AETHER · Studio',
  description: 'Describe a dream. AETHER decodes it into a living field of light.',
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const prompt = (sp.p ?? 'a city that only exists when you are asleep in it').slice(0, 300);
  const mood: MoodId = isMood(sp.m) ? sp.m : 'cosmic';

  // the same pure function runs on the server, so a shared link rehydrates
  // the exact dream without any client-side work
  const initial = makeDream(prompt, mood);

  return <StudioClient initial={initial} />;
}
