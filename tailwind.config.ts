/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@meavo/navigation/dist/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf5",
          100: "#dcfceb",
          500: "#30a46c",
          600: "#30a46c",
          700: "#0c8f61",
        },
      },
    },
  },
  plugins: [],
};
