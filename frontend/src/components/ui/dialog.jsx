import * as React from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

// Base UI (unlike Radix) exposes data-open/data-closed and data-starting-style/
// data-ending-style rather than a single data-state="open|closed" attribute — verified
// against Base UI's own animation docs. Plain CSS transitions keyed off
// data-starting-style/data-ending-style are Base UI's own recommended approach (they
// cancel cleanly if a user interrupts mid-animation, unlike a fixed keyframe run).
const Dialog = BaseDialog.Root;
const DialogTrigger = BaseDialog.Trigger;
const DialogClose = BaseDialog.Close;
const DialogPortal = BaseDialog.Portal;

const DialogBackdrop = React.forwardRef(({ className, ...props }, ref) => (
  <BaseDialog.Backdrop
    ref={ref}
    className={cn(
      'tw:fixed tw:inset-0 tw:z-50 tw:bg-slate-950/50 tw:transition-opacity tw:duration-150',
      'tw:data-[starting-style]:opacity-0 tw:data-[ending-style]:opacity-0',
      className,
    )}
    {...props}
  />
));
DialogBackdrop.displayName = 'DialogBackdrop';

// sm:max-w-sm by default per the style guide, explicitly widened per-usage for forms.
const DialogPopup = React.forwardRef(({ className, children, showClose = true, ...props }, ref) => (
  <DialogPortal>
    <DialogBackdrop />
    <BaseDialog.Popup
      ref={ref}
      className={cn(
        'tw:fixed tw:top-1/2 tw:left-1/2 tw:z-50 tw:w-[calc(100%-2rem)] tw:max-w-sm tw:-translate-x-1/2 tw:-translate-y-1/2',
        'tw:rounded-2xl tw:border tw:border-slate-200/70 tw:bg-white tw:p-5 tw:shadow-lg tw:dark:border-slate-800 tw:dark:bg-slate-900',
        'tw:transition-all tw:duration-150',
        'tw:data-[starting-style]:scale-95 tw:data-[starting-style]:opacity-0',
        'tw:data-[ending-style]:scale-95 tw:data-[ending-style]:opacity-0',
        className,
      )}
      {...props}
    >
      {children}
      {showClose && (
        <DialogClose className="tw:absolute tw:top-4 tw:right-4 tw:rounded-lg tw:p-1 tw:text-slate-400 tw:transition-colors tw:hover:bg-slate-100 tw:hover:text-slate-600 tw:dark:hover:bg-slate-800 tw:dark:hover:text-slate-300">
          <X className="tw:h-4 tw:w-4" />
        </DialogClose>
      )}
    </BaseDialog.Popup>
  </DialogPortal>
));
DialogPopup.displayName = 'DialogPopup';

const DialogHeader = ({ className, ...props }) => (
  <div className={cn('tw:flex tw:flex-col tw:gap-1 tw:pr-6', className)} {...props} />
);

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <BaseDialog.Title ref={ref} className={cn('tw:font-heading tw:text-lg tw:font-bold', className)} {...props} />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <BaseDialog.Description ref={ref} className={cn('tw:text-sm tw:text-slate-500 tw:dark:text-slate-400', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';

const DialogFooter = ({ className, ...props }) => (
  <div className={cn('tw:mt-4 tw:flex tw:items-center tw:justify-end tw:gap-2', className)} {...props} />
);

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};
