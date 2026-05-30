import { useEffect } from 'react';

export function usePreventLeakage(ref) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return undefined;

    const blockContext = (event) => event.preventDefault();
    const blockDrag = (event) => event.preventDefault();
    const blockKeys = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = String(event.key || '').toLowerCase();

      if (mod && ['s', 'u', 'p'].includes(key)) {
        event.preventDefault();
      }
    };

    el.addEventListener('contextmenu', blockContext);
    el.addEventListener('dragstart', blockDrag);
    document.addEventListener('keydown', blockKeys);

    return () => {
      el.removeEventListener('contextmenu', blockContext);
      el.removeEventListener('dragstart', blockDrag);
      document.removeEventListener('keydown', blockKeys);
    };
  }, [ref]);
}
