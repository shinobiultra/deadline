/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#05070d',
        panel: '#0b1020',
        neon: '#7cffb2',
        cyan: '#6ee7ff',
        ink: '#d9e8ff'
      },
      boxShadow: {
        neon: '0 0 24px rgba(124, 255, 178, 0.2)'
      }
    }
  },
  plugins: []
}
