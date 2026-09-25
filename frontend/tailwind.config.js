/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0a0a10", 900: "#0a0a10", 800: "#12121a", 700: "#1a1a25", 600: "#252533" },
        blush: { DEFAULT: "#ff3e8a", 400: "#ff6fa8", 500: "#ff3e8a", 600: "#e8267a" },
        orchid: { DEFAULT: "#9b5cff", 500: "#9b5cff" },
        gold: { DEFAULT: "#f5c16c" },
        mist: { DEFAULT: "#a1a1b5", 300: "#d4d4de" },
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(255, 62, 138, 0.55)",
        card: "0 20px 50px -20px rgba(0, 0, 0, 0.8)",
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(255,62,138,.6)" }, "100%": { boxShadow: "0 0 0 10px rgba(255,62,138,0)" } },
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
        pulseRing: "pulseRing 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};
