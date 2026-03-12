/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'xs': '475px',   // 큰 모바일 (iPhone 14 Pro Max 등)
      'sm': '640px',   // 작은 태블릿
      'md': '768px',   // 태블릿
      'lg': '1024px',  // 데스크탑
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: {
          50: '#E6F8FB',
          100: '#CCF1F7',
          200: '#99E3EF',
          300: '#66D5E7',
          400: '#33C7DF',
          500: '#00B0C8',
          600: '#009DB3',
          700: '#007A8A',
          800: '#005862',
          900: '#00353A',
        },
      },
    },
  },
  plugins: [],
}
