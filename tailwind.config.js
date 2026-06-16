/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ea-primary':      '#1d1d1d',  // dark — text, nav, dark sections
        'ea-secondary':    '#ffffff',  // white
        'ea-accent':       '#cc9966',  // gold — buttons, highlights (matches logo icon)
        'ea-accent-dark':  '#b8874f',  // gold hover
        'ea-surface':      '#f8f7f3',  // warm cream — page backgrounds
        'ea-dark':         '#0d0d0d',  // very dark — footer, hero dark sections
        'ea-neutral-800':  '#1c1c1c',  // dark neutral
        'ea-neutral-600':  '#666666',  // body text gray
        'ea-border':       '#e7e0cf',  // subtle warm border
      },
    },
  },
  plugins: [],
}
