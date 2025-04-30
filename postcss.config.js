/** @type {import('postcss').Config} */
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {}, // Revert back to this plugin name
    autoprefixer: {},
  },
}