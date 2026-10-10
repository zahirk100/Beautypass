export const instagramUrl = (handle: string) => `https://www.instagram.com/${encodeURIComponent(handle)}/`;
export const tiktokUrl = (handle: string) => `https://www.tiktok.com/@${encodeURIComponent(handle)}`;

/** Accepts "@name", "name" or a full profile URL and returns just the handle. */
export function handleFrom(input: string): string {
  const s = input.trim().replace(/\/+$/, "");
  const fromUrl = s.match(/(?:instagram\.com|tiktok\.com)\/@?([A-Za-z0-9._]+)/i);
  return (fromUrl ? fromUrl[1] : s.replace(/^@/, "")).replace(/[^A-Za-z0-9._]/g, "").slice(0, 60);
}

export function websiteFrom(input: string): string {
  const s = input.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/** Placeholder look for salons without a photo: a soft gradient based on the name. */
export function placeholderStyle(name: string): React.CSSProperties {
  const hues = [[340, 30], [15, 35], [300, 22], [355, 40], [25, 28]];
  const [h, s] = hues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length];
  return { background: `linear-gradient(135deg, hsl(${h} ${s}% 88%), hsl(${h} ${s}% 72%))` };
}
