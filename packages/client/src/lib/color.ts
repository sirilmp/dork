/**
 * Converts a hex color (e.g. "#2563eb") to an HSL triplet string in the
 * exact format shadcn/ui's CSS variables expect: "H S% L%" (no commas, no
 * hsl() wrapper), e.g. "217.2 91.2% 59.8%", so it can be set directly as
 * `--primary` and consumed by Tailwind's `hsl(var(--primary))` color tokens.
 */
export function hexToHslTriplet(hex: string): string {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return '217.2 91.2% 59.8%';

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const hRounded = Math.round(h * 10) / 10;
  const sPct = Math.round(s * 1000) / 10;
  const lPct = Math.round(l * 1000) / 10;
  return `${hRounded} ${sPct}% ${lPct}%`;
}
