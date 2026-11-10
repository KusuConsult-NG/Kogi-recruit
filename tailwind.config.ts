import type { Config } from 'tailwindcss';

/**
 * The Commission's design system.
 *
 * The portal is a public record system, not a consumer product: the palette is
 * restrained, the type pairs an editorial serif for headings with a neutral
 * civic sans for text and data, rules are hairlines rather than drop shadows,
 * and corners are square-ish so tables and forms read as official documents.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep Kogi forest green — the Commission's primary colour.
        kogi: {
          50: '#f0f7f3', 100: '#dcebe2', 200: '#bbd8c7', 300: '#8fbda4',
          400: '#5f9b7e', 500: '#3e7d61', 600: '#2b644c', 700: '#21503e',
          800: '#1b4033', 900: '#16342a', 950: '#0b1d17',
        },
        // Muted ceremonial gold, for seals, accents and the state crest.
        gold: {
          50: '#fbf8ef', 100: '#f5eed6', 200: '#eadcab', 300: '#dcc277',
          400: '#cfa84f', 500: '#c0913a', 600: '#a4722f', 700: '#845629',
          800: '#6e4728', 900: '#5d3c25', 950: '#351f12',
        },
        // Warm neutral "ink on paper" scale used for all text and chrome.
        ink: {
          50: '#f8f8f6', 100: '#f1f0ec', 150: '#eae8e1', 200: '#e3e1da', 300: '#cbc8be',
          400: '#a8a39a', 500: '#87827a', 600: '#6c6861', 700: '#57544f',
          800: '#403e3a', 900: '#2a2927', 950: '#1a1918',
        },
        // Officially sanctioned status colours, deliberately desaturated.
        signal: {
          info: '#1f5b86', infoBg: '#eef5fa',
          warn: '#8a5a11', warnBg: '#fdf6e8',
          danger: '#9a2c20', dangerBg: '#fcefed',
          ok: '#2b644c', okBg: '#eef5f1',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'Segoe UI', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        none: '0', sm: '2px', DEFAULT: '3px', md: '4px', lg: '6px', xl: '8px',
      },
      boxShadow: {
        hairline: '0 0 0 1px rgb(26 25 24 / 0.07)',
        raised: '0 1px 2px rgb(26 25 24 / 0.06), 0 0 0 1px rgb(26 25 24 / 0.05)',
        panel: '0 2px 10px -4px rgb(26 25 24 / 0.14), 0 0 0 1px rgb(26 25 24 / 0.06)',
        crest: 'inset 0 0 0 1px rgb(207 168 79 / 0.6)',
      },
      letterSpacing: {
        label: '0.08em',
        seal: '0.22em',
      },
      maxWidth: {
        measure: '68ch',
      },
      backgroundImage: {
        'kogi-weave':
          'linear-gradient(135deg, rgb(255 255 255 / 0.04) 25%, transparent 25%, transparent 50%, rgb(255 255 255 / 0.04) 50%, rgb(255 255 255 / 0.04) 75%, transparent 75%, transparent)',
      },
      backgroundSize: {
        weave: '8px 8px',
      },
    },
  },
  plugins: [],
};
export default config;
