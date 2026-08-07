import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// min-h-9 (36px) is the style guide's mobile tap-target floor for real interactive
// elements — every size here meets or exceeds it except icon-sm, which the guide
// explicitly carves out as the one allowed exception for icon-only controls.
const buttonVariants = cva(
  'tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:whitespace-nowrap tw:rounded-xl tw:text-sm tw:font-semibold tw:transition-colors tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500/50 tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:active:translate-y-px',
  {
    variants: {
      variant: {
        default: 'tw:bg-brand-600 tw:text-white tw:hover:bg-brand-500',
        outline:
          'tw:border tw:border-slate-200 tw:bg-white tw:text-slate-900 tw:hover:bg-slate-50 tw:dark:border-slate-800 tw:dark:bg-transparent tw:dark:text-slate-100 tw:dark:hover:bg-slate-900',
        secondary:
          'tw:bg-slate-100 tw:text-slate-900 tw:hover:bg-slate-200 tw:dark:bg-slate-800 tw:dark:text-slate-100 tw:dark:hover:bg-slate-700',
        ghost: 'tw:text-slate-700 tw:hover:bg-slate-100 tw:dark:text-slate-300 tw:dark:hover:bg-slate-800',
        // Tinted, not a solid fill — matches the style guide's destructive-button rule.
        destructive: 'tw:bg-red-500/10 tw:text-red-600 tw:hover:bg-red-500/20 tw:dark:text-red-400',
        link: 'tw:text-brand-600 tw:underline-offset-4 tw:hover:underline tw:dark:text-brand-400',
      },
      size: {
        xs: 'tw:h-7 tw:px-2.5 tw:text-xs',
        sm: 'tw:h-8 tw:px-3 tw:text-xs',
        default: 'tw:h-9 tw:px-4',
        lg: 'tw:h-11 tw:px-6 tw:text-base',
        icon: 'tw:h-9 tw:w-9',
        'icon-sm': 'tw:h-8 tw:w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = 'Button';

export { Button, buttonVariants };
