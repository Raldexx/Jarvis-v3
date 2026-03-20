/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['Consolas', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        spotify: '#1DB954',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      keyframes: {
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-10px) scale(0.9)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        pulse2: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(220,38,38,0)' },
          '50%':       { boxShadow: '0 0 0 4px rgba(220,38,38,0.15)' },
        },
        barUp: {
          '0%':   { height: '0px' },
          '100%': { height: 'var(--bar-h)' },
        }
      },
      animation: {
        'slide-in':  'slideIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        'pulse2':    'pulse2 1.5s ease-in-out infinite',
        'bar-up':    'barUp 0.4s ease both',
      }
    }
  },
  plugins: []
};
