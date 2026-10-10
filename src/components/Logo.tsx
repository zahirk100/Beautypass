/** BeautyPass monogram: an italic serif "B" on a pass with two ticket notches. */
export function LogoMark({ inverted = false }: { inverted?: boolean }) {
  const tile = inverted ? "#e3c79f" : "#3a1828";
  const letter = inverted ? "#3a1828" : "#e3c79f";
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <mask id="bp-notch">
          <rect width="64" height="64" fill="#fff" />
          <circle cx="0" cy="32" r="6.5" fill="#000" />
          <circle cx="64" cy="32" r="6.5" fill="#000" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="16" fill={tile} mask="url(#bp-notch)" />
      <text x="32.5" y="45" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight={600} fontSize="40" fill={letter}>B</text>
    </svg>
  );
}

export function Logo({ light, sub, href = "/" }: { light?: boolean; sub?: string; href?: string }) {
  return (
    <a href={href} className={`logo${light ? " light" : ""}`} aria-label="BeautyPass">
      <LogoMark inverted={light} />
      <span>
        Beauty<i>Pass</i>
        {sub && <small>{sub}</small>}
      </span>
    </a>
  );
}
