export function LogoMark() {
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="10" fill="#3a1828" />
      <path d="M17 6C17.7 13.4 20.6 16.3 28 17C20.6 17.7 17.7 20.6 17 28C16.3 20.6 13.4 17.7 6 17C13.4 16.3 16.3 13.4 17 6Z" fill="#e3c79f" />
    </svg>
  );
}

export function Logo({ light, sub, href = "/" }: { light?: boolean; sub?: string; href?: string }) {
  return (
    <a href={href} className={`logo${light ? " light" : ""}`} aria-label="BeautyPass">
      <LogoMark />
      <span>
        Beauty<i>Pass</i>
        {sub && <small>{sub}</small>}
      </span>
    </a>
  );
}
