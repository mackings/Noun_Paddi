import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// The fixed four-part semantic formula from the style guide: bg-{color}-100
// text-{color}-700, dark:bg-{color}-950-or-500/15 dark:text-{color}-300 — same mapping
// everywhere a status is shown, so color alone stays a reliable, learnable signal.
const badgeVariants = cva(
  'tw:inline-flex tw:w-fit tw:items-center tw:gap-1 tw:rounded-full tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-semibold tw:whitespace-nowrap',
  {
    variants: {
      variant: {
        brand: 'tw:bg-brand-100 tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300',
        success: 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300',
        warning: 'tw:bg-amber-100 tw:text-amber-700 tw:dark:bg-amber-500/15 tw:dark:text-amber-300',
        danger: 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
        info: 'tw:bg-blue-100 tw:text-blue-700 tw:dark:bg-blue-500/15 tw:dark:text-blue-300',
        neutral: 'tw:bg-slate-100 tw:text-slate-700 tw:dark:bg-slate-800 tw:dark:text-slate-300',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

const Badge = React.forwardRef(({ className, variant, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
));
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
