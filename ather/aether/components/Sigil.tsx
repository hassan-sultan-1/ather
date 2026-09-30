import { useMemo } from 'react';
import { sigilSvg } from '@/lib/sigil';
import type { Sigil as SigilData } from '@/lib/dream';

export default function SigilMark({
  sigil,
  accent = '#b98cff',
  className,
  spin = true,
}: {
  sigil: SigilData;
  accent?: string;
  className?: string;
  spin?: boolean;
}) {
  const html = useMemo(
    () => sigilSvg(sigil, 'rgba(255,255,255,0.65)', accent),
    [sigil, accent],
  );
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        animation: spin ? undefined : 'none',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
