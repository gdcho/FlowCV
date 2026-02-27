import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/content/overleaf/components/**/*.{ts,tsx}',
    './src/content/overleaf/sidebar/**/*.{ts,tsx}',
    './src/popup/**/*.{ts,tsx,html}',
    './src/options/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        'ov': {
          dark:    '#086528',
          DEFAULT: '#398453',
          mid:     '#6ba37e',
          light:   '#9cc1a9',
          pale:    '#cee0d4',
        },
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
