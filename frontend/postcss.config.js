// Tailwind's PostCSS plugin MUST run first — it needs to see the raw, unmangled CSS to
// correctly expand its own @import/@theme/@custom-variant/@source at-rules and generate
// utilities. CRA's original plugins (same config CRA itself used, see
// node_modules/@craco/craco/dist/lib/features/webpack/style/postcss.js CRA_PLUGINS/
// CRA_PRESET_ENV) follow afterward, unchanged, so existing plain CSS (App.css, every
// page's .css file) keeps getting the same flexbug fixes / autoprefixing / normalize
// treatment it always has.
module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    require('postcss-flexbugs-fixes'),
    require('postcss-preset-env')({
      autoprefixer: {
        flexbox: 'no-2009',
      },
      stage: 3,
    }),
    require('postcss-normalize'),
  ],
};
