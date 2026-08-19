/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // ✅ Theme colors powered by CSS vars (set in ThemeProvider)
      colors: {
        primary: "rgb(var(--sw-accent-rgb) / <alpha-value>)",
        "primary-hover": "rgb(var(--sw-accent-hover-rgb) / <alpha-value>)",
        "primary-light": "rgb(var(--sw-accent-light-rgb) / <alpha-value>)",

        surface: "rgb(var(--sw-surface-rgb) / <alpha-value>)",
        "surface-2": "rgb(var(--sw-surface-2-rgb) / <alpha-value>)",

        border: "rgb(var(--sw-border-rgb) / <alpha-value>)",
        secondary: "rgb(var(--sw-text-secondary-rgb) / <alpha-value>)",
      },

      screens: { xs: "475px" },

      animation: {
        float: "float 6s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite alternate",
        "fade-in": "fadeIn 0.6s ease-out",
        "slide-up": "slideUp 0.6s ease-out",
        "slide-down": "slideDown 0.4s ease-out",
        "slide-in-right": "slideInRight 0.6s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },

      keyframes: {
        float: {
          "0%, 100%": {
            transform: "translateY(0px) translateX(0px) rotate(0deg)",
            opacity: "0.3",
          },
          "25%": {
            transform: "translateY(-20px) translateX(10px) rotate(90deg)",
            opacity: "0.8",
          },
          "50%": {
            transform: "translateY(-10px) translateX(-10px) rotate(180deg)",
            opacity: "1",
          },
          "75%": {
            transform: "translateY(-30px) translateX(5px) rotate(270deg)",
            opacity: "0.6",
          },
        },

        // ✅ Glow now follows the active theme
        glow: {
          "0%": { boxShadow: "0 0 20px rgb(var(--sw-accent-rgb) / 0.22)" },
          "100%": { boxShadow: "0 0 44px rgb(var(--sw-accent-rgb) / 0.55)" },
        },

        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },

        slideUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },

        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },

        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(50px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },

        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 12px rgb(var(--sw-accent-rgb) / 0.25)" },
          "50%": { boxShadow: "0 0 36px rgb(var(--sw-accent-rgb) / 0.70)" },
        },
      },
    },
  },
  plugins: [],
};
