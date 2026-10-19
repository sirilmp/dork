import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { brandingApi } from '../api/admin';
import { Branding } from '../api/types';
import { hexToHslTriplet } from '../lib/color';

const DEFAULT_BRANDING: Branding = {
  productName: 'Open Issue Tracker',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#2563eb',
  accentColor: '#7c3aed',
};

interface ThemeContextValue {
  branding: Branding;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  branding: DEFAULT_BRANDING,
  loading: true,
  refresh: async () => {},
});

/** Converts a hex color like #2563eb to a contrasting black/white foreground. */
function contrastingForeground(hex: string): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return '#ffffff';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
}

// shadcn/ui's foreground tokens, as HSL triplets matching the two hex
// foregrounds contrastingForeground() can return (near-black / near-white),
// so --primary-foreground / --accent-foreground stay in the same HSL-triplet
// format as every other shadcn color token instead of mixing hex and HSL.
const FOREGROUND_HSL_DARK = '222.2 47.4% 11.2%'; // ~ #0f172a
const FOREGROUND_HSL_LIGHT = '210 40% 98%'; // ~ #ffffff / near-white

function applyBranding(branding: Branding) {
  const root = document.documentElement;

  // Legacy hex vars — kept for the few spots (inline SVG) that read a
  // literal color rather than a Tailwind utility class.
  root.style.setProperty('--color-primary', branding.primaryColor);
  root.style.setProperty('--color-primary-foreground', contrastingForeground(branding.primaryColor));
  root.style.setProperty('--color-accent', branding.accentColor);
  root.style.setProperty('--color-accent-foreground', contrastingForeground(branding.accentColor));

  // Bridge to shadcn/ui's expected CSS variables: Tailwind's `primary` /
  // `accent` / `ring` tokens resolve via `hsl(var(--primary))` etc. (see
  // tailwind.config.js), so every shadcn component (Button, focus rings,
  // selected Select/Tabs states, ...) re-themes automatically whenever
  // admin branding changes, with no per-component changes needed.
  const primaryHsl = hexToHslTriplet(branding.primaryColor);
  const accentHsl = hexToHslTriplet(branding.accentColor);
  root.style.setProperty('--primary', primaryHsl);
  root.style.setProperty(
    '--primary-foreground',
    contrastingForeground(branding.primaryColor) === '#ffffff' ? FOREGROUND_HSL_LIGHT : FOREGROUND_HSL_DARK
  );
  root.style.setProperty('--accent', accentHsl);
  root.style.setProperty(
    '--accent-foreground',
    contrastingForeground(branding.accentColor) === '#ffffff' ? FOREGROUND_HSL_LIGHT : FOREGROUND_HSL_DARK
  );
  // Focus rings (shadcn's `ring-ring` / default focus-visible styles) follow
  // the brand's primary color too.
  root.style.setProperty('--ring', primaryHsl);

  document.title = branding.productName;

  if (branding.faviconUrl) {
    const link = document.getElementById('favicon') as HTMLLinkElement | null;
    if (link) link.href = branding.faviconUrl;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const result = await brandingApi.getPublic();
      setBranding(result);
      applyBranding(result);
    } catch {
      // Fall back to defaults if the API isn't reachable yet (e.g. first paint).
      applyBranding(DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyBranding(DEFAULT_BRANDING);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ThemeContext.Provider value={{ branding, loading, refresh }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
