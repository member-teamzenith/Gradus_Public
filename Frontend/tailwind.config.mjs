/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/Components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        darkBlueGray: "#2B2B2B",
      },
      fontFamily: {
        'questrial': ['Questrial', 'sans-serif'],
      },
    },
  },
  plugins: [
    // Use ES module dynamic import:
    async function ({addUtilities}) {
      const plugin = (await import('tailwind-scrollbar-hide')).default;
      return plugin({addUtilities});
    }
  ],
};
