import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pc: {
          bg: '#111827',
          surface: '#1f2937',
          surface2: '#263244',
          border: '#6D8196',
          text: '#f8fafc',
          muted: '#c7d2df',
          gold: '#82C8E5',
          amber: '#6D8196',
          blue: '#0047AB',
          navy: '#000080',
          cyan: '#82C8E5',
          success: '#82C8E5',
          danger: '#ef6f7b',
        },
      },
      boxShadow: {
        panel: '0 24px 70px rgba(0, 0, 128, 0.26)',
      },
    },
  },
  plugins: [],
} satisfies Config;
