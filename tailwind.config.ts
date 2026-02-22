/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        rajdhani: ['var(--font-rajdhani)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#0a0a12',
          card: '#0d0d1a',
          elevated: '#111126',
        },
        accent: {
          DEFAULT: '#00ff88',
          dim: '#00cc6a',
          glow: 'rgba(0, 255, 136, 0.15)',
        },
        danger: {
          DEFAULT: '#ff3366',
          dim: '#cc2952',
          glow: 'rgba(255, 51, 102, 0.15)',
        },
        warn: {
          DEFAULT: '#ffaa00',
          dim: '#cc8800',
        },
        info: {
          DEFAULT: '#38bdf8',
          dim: '#2196d4',
        },
      },
      animation: {
        'pulse-fast': 'pulse 1s ease-in-out infinite',
        'scan': 'scan 4s linear infinite',
        'glitch': 'glitch 3s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'pop': 'pop 0.2s ease-out',
        'shake': 'shake 0.4s ease-in-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        glitch: {
          '0%, 85%, 100%': { transform: 'translate(0)', opacity: '1' },
          '86%': { transform: 'translate(-3px, 1px)', opacity: '0.8' },
          '88%': { transform: 'translate(3px, -1px)', opacity: '0.9' },
          '90%': { transform: 'translate(-1px, 0)', opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '50%': { transform: 'translateX(4px)' },
          '75%': { transform: 'translateX(-2px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}