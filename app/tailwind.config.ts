import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pc: {
          bg: '#0b1220',
          surface: '#111827',
          surface2: '#172033',
          border: '#334155',
          text: '#e5e7eb',
          muted: '#94a3b8',
          gold: '#facc15',
          amber: '#f59e0b',
          blue: '#60a5fa',
          cyan: '#22d3ee',
          success: '#22c55e',
          danger: '#ef4444',
        },
      },
      boxShadow: {
        panel: '0 18px 40px rgba(2, 6, 23, 0.38)',
      },
    },
  },
  plugins: [],
} satisfies Config;
