/** @type {import('tailwindcss').Config} */
// Brand tokens are ported 1:1 from the web app's CSS variables in
// frontend/src/index.css (:root). Keep these two files in sync — if the brand
// palette changes on the web, mirror it here.
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./src/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1B2B4A", // --navy      primary, headings
          deep: "#14213D",    // --navy-deep deep sections, footer
          soft: "#233A63",    // --navy-soft navbar, cards on dark
        },
        gold: {
          DEFAULT: "#C8A951", // --gold       accent, buttons
          light: "#E8C96A",   // --gold-light hover highlight
          deep: "#A9863A",    // --gold-deep  gold text on cream (contrast)
        },
        cream: {
          DEFAULT: "#FAF6EC", // --cream      main light background
          warm: "#F3ECD9",    // --cream-warm alt sections, cards on cream
        },
        slate: {
          DEFAULT: "#4A5568", // --slate       body text
          light: "#7A8699",   // --slate-light muted text
        },
        ink: "#1B2B4A",       // --ink        body heading text
        "hero-cream": "#F5EEC9", // pale cream text over dark photos
      },
      fontFamily: {
        // Loaded in app/_layout.jsx via expo-font. `font-display` replaces the
        // web's .font-serif-display / inline Playfair Display styles.
        display: ["PlayfairDisplay_400Regular"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        "sans-bold": ["Inter_700Bold"],
      },
    },
  },
  plugins: [],
};
