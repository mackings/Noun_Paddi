import * as React from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '../../contexts/ThemeContext';

// sonner has its own light/dark theming but no built-in awareness of this app's
// data-theme attribute (it normally expects next-themes' class-based system) — passed
// through explicitly from the existing ThemeContext instead of duplicating theme state.
const Toaster = (props) => {
  const { theme } = useTheme();
  return <SonnerToaster theme={theme} richColors position="top-center" {...props} />;
};

export { Toaster };
