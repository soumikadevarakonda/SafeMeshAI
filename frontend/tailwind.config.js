/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          dark: '#0f172a',    // Deep slate
          panel: '#1e293b',   // Mid slate
          border: '#334155',  // Light slate border
          accent: '#38bdf8',  // Light blue
          low: '#10b981',     // Emerald green
          medium: '#f59e0b',  // Amber yellow
          high: '#f97316',    // Orange
          critical: '#ef4444' // Red
        }
      }
    },
  },
  plugins: [],
}
