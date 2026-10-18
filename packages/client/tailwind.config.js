/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // These resolve to CSS custom properties set at runtime by
        // ThemeProvider from /api/branding, so admin-configured colors flow
        // through Tailwind utility classes like `bg-primary` / `text-accent`.
        primary: 'var(--color-primary)',
        'primary-foreground': 'var(--color-primary-foreground)',
        accent: 'var(--color-accent)',
        'accent-foreground': 'var(--color-accent-foreground)',
      },
    },
  },
  plugins: [],
};
