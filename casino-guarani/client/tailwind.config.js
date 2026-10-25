export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07060b', 900: '#0d0b14', 800: '#15121f', 700: '#1d1930' },
        gold: { DEFAULT: '#f5c542', light: '#ffe08a', dark: '#b8860b' },
        neon: { pink: '#ff2e9a', violet: '#a855f7', cyan: '#22d3ee' },
      },
      fontFamily: { display: ['Cinzel', 'serif'], sans: ['"DM Sans"', 'system-ui', 'sans-serif'] },
      keyframes: {
        twinkle: { '0%,100%': { opacity: '.2' }, '50%': { opacity: '1' } },
        glow: {
          '0%,100%': { boxShadow: '0 0 24px #f5c54233' },
          '50%': { boxShadow: '0 0 70px #f5c542bb, 0 0 130px #ff2e9a55' },
        },
        pop: { '0%': { transform: 'scale(.5)', opacity: '0' }, '65%': { transform: 'scale(1.12)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        rise: { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: {
        twinkle: 'twinkle 1.2s ease-in-out infinite',
        glow: 'glow 1s ease-in-out infinite',
        pop: 'pop .5s ease-out both',
        rise: 'rise .35s ease-out both',
      },
    },
  },
};
