/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        neon: {
          purple: '#8b5cf6',
          gold: '#fbbf24',
          teal: '#14b8a6',
          deep: '#070312',
        },
      },
      boxShadow: {
        neon: '0 0 18px rgba(139,92,246,.8),0 0 42px rgba(20,184,166,.35)',
      },
      backgroundImage: {
        cosmic: 'radial-gradient(circle at 50% 0%, #2a1257 0%, #090414 45%, #05020b 100%)',
      },
    },
  },
  plugins: [],
};
