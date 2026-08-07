import * as React from 'react';
import { cn } from '../../lib/utils';

// `interactive` is the tappable-card variant (home grid, list items) — soft elevation at
// rest, a subtle lift on hover/press, never a hard shadow. Non-interactive cards (most
// content containers) stay flat at rest and never move.
const Card = React.forwardRef(({ className, interactive, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'tw:rounded-2xl tw:border tw:border-slate-200/70 tw:bg-white tw:shadow-sm tw:transition-all tw:dark:border-slate-800 tw:dark:bg-slate-900',
      interactive && 'tw:cursor-pointer tw:hover:-translate-y-0.5 tw:hover:shadow-md tw:active:translate-y-px',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('tw:flex tw:flex-col tw:gap-1.5 tw:p-4', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('tw:font-heading tw:text-lg tw:font-bold tw:tracking-tight', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('tw:text-sm tw:text-slate-500 tw:dark:text-slate-400', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('tw:p-4 tw:pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('tw:flex tw:items-center tw:gap-2 tw:p-4 tw:pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
