module.exports = {
  // `mode: 'file'` hands PostCSS config entirely to postcss.config.js at the project
  // root, resolved via postcss-loader's own postcss-load-config lookup. This was
  // necessary (not just a preference): CRACO 7's `style.postcss.plugins` only accepts a
  // plain array (it silently no-ops for the documented function form — verified
  // directly, the function was never invoked), and the array form always APPENDS to
  // CRA's existing plugins, which runs Tailwind's PostCSS plugin LAST — after
  // postcss-preset-env has already mangled its @import/@theme/@custom-variant/@source
  // at-rules, corrupting Tailwind's utility-generation step (verified: standalone
  // postcss([tailwindPlugin]) worked correctly; only the CRA-pipeline version produced a
  // literal, never-expanded `@tailwind utilities` marker in the output). A real
  // postcss.config.js gives full, explicit control over plugin order instead.
  style: {
    postcss: {
      mode: 'file',
    },
  },
};
