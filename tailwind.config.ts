import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2BB673',
          light: '#2FBF9B',
        },
      },
      keyframes: {
        'border-glow': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'card-enter': {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'risk-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
          '50%': { boxShadow: '0 0 8px 2px rgba(239, 68, 68, 0.3)' },
        },
        'ai-glow': {
          '0%, 100%': { boxShadow: '0 0 4px 0 rgba(139, 92, 246, 0.3)' },
          '50%': { boxShadow: '0 0 16px 4px rgba(139, 92, 246, 0.5)' },
        },
        'scan-sweep': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
      animation: {
        'border-glow': 'border-glow 3s ease infinite',
        'card-enter': 'card-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'risk-pulse': 'risk-pulse 2s ease-in-out infinite',
        'ai-glow': 'ai-glow 2.5s ease-in-out infinite',
        'scan-sweep': 'scan-sweep 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config

