import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// App.css already defines ~40 hand-rolled utility classes sharing names with real
// Tailwind utilities but different pixel values (.gap-2 is 16px here, 8px in Tailwind,
// etc.) — Tailwind is imported with the `tw` prefix specifically to avoid that collision
// (see src/styles/tailwind.css), so tailwind-merge needs the matching prefix to
// recognize and correctly dedupe those prefixed utility classes.
const twMerge = extendTailwindMerge({ prefix: 'tw' });

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
