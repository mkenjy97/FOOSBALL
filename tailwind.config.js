/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        dark: 'var(--bg-primary)',
        card: 'var(--bg-card)',
      },
      textColor: {
        white: 'var(--text-primary)',
        brand: 'var(--brand-text)',
        zinc: {
           400: 'var(--text-secondary)',
           500: 'var(--text-secondary)',
           600: 'var(--text-secondary)',
        }
      },
      borderColor: {
        white: 'var(--border-primary)',
        brand: 'var(--brand)',
      }
    },
  },
  plugins: [],
}