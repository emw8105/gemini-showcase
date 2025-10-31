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
        cinzel: ['Cinzel', 'serif'],
        inter: ['Inter', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Courier New', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'bounce-slow': 'bounceSlow 2s infinite',
        'gradient-pulse': 'gradientPulse 8s ease-in-out infinite',
        'float': 'float 20s infinite',
        'pulse-custom': 'pulseCustom 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': {
            filter: 'brightness(1) drop-shadow(0 0 20px rgba(6, 182, 212, 0.6))',
          },
          '50%': {
            filter: 'brightness(1.2) drop-shadow(0 0 40px rgba(168, 85, 247, 0.8))',
          },
        },
        bounceSlow: {
          '0%, 100%': {
            transform: 'translateX(-50%) translateY(0)',
          },
          '50%': {
            transform: 'translateX(-50%) translateY(10px)',
          },
        },
        gradientPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0) translateX(0)',
            opacity: '0',
          },
          '10%': {
            opacity: '1',
          },
          '90%': {
            opacity: '1',
          },
          '100%': {
            transform: 'translateY(-100vh) translateX(50px)',
            opacity: '0',
          },
        },
        pulseCustom: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.01)' },
        },
        slideIn: {
          from: {
            opacity: '0',
            transform: 'translateX(-10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
      },
    },
  },
  plugins: [],
};