import * as React from 'react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'tw:flex tw:h-11 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3.5 tw:text-sm tw:text-slate-900 tw:outline-none tw:transition-colors tw:placeholder:text-slate-400 tw:focus:border-brand-500 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100 tw:dark:placeholder:text-slate-500',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
