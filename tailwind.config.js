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
    extend: {},
  },
  plugins: [],
}
