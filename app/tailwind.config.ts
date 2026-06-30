import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pc: {
          bg: '#FFFFFF',
          surface: '#FFFFFF',
          surface2: '#D5F3D8',
          border: '#F2C7C7',
          text: '#1f2937',
          muted: '#6b7280',
          gold: '#FFB7C5',
          amber: '#F2C7C7',
          blue: '#D5F3D8',
          cyan: '#D5F3D8',
          success: '#D5F3D8',
          danger: '#fb7185',
        },
      },
      boxShadow: {
        panel: '0 24px 70px rgba(242, 199, 199, 0.42)',
      },
    },
  },
  plugins: [],
} satisfies Config;
