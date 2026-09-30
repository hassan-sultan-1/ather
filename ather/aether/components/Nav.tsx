import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="brand" aria-label="AETHER home">
        <span className="brand__mark">
          <span>Æ</span>
        </span>
        Aether
      </Link>
      <div className="nav__links">
        <span className="mono" style={{ marginRight: '0.4rem' }}>
          latent engine v1
        </span>
        <Link href="/studio" className="btn btn--sm">
          Enter the engine
        </Link>
      </div>
    </nav>
  );
}
