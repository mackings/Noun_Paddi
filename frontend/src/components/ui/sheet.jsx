import * as React from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

// Same Base UI Dialog primitive as dialog.jsx, but the Popup slides in from an edge
// instead of appearing centered — the natural home for anything that used to be an ad
// hoc bottom-sheet (e.g. App.css's .np-bottom-sheet*), and for a right-side "detail"
// panel launched from a list row.
const Sheet = BaseDialog.Root;
const SheetTrigger = BaseDialog.Trigger;
const SheetClose = BaseDialog.Close;
const SheetPortal = BaseDialog.Portal;

const SheetBackdrop = React.forwardRef(({ className, ...props }, ref) => (
  <BaseDialog.Backdrop
    ref={ref}
    className={cn(
      'tw:fixed tw:inset-0 tw:z-50 tw:bg-slate-950/50 tw:transition-opacity tw:duration-200',
      'tw:data-[starting-style]:opacity-0 tw:data-[ending-style]:opacity-0',
      className,
    )}
    {...props}
  />
));
SheetBackdrop.displayName = 'SheetBackdrop';

const SIDE_STYLES = {
  bottom:
    'tw:inset-x-0 tw:bottom-0 tw:max-h-[85vh] tw:w-full tw:rounded-t-2xl tw:data-[starting-style]:translate-y-full tw:data-[ending-style]:translate-y-full',
  right:
    'tw:inset-y-0 tw:right-0 tw:h-full tw:w-full tw:sm:max-w-xl tw:data-[starting-style]:translate-x-full tw:data-[ending-style]:translate-x-full',
};

// side="bottom" is the mobile default (matches the field-app bottom-sheet convention);
// side="right" is available for the wider desktop-style slide-over described in the
// style guide.
const SheetPopup = React.forwardRef(({ className, children, side = 'bottom', showClose = true, ...props }, ref) => (
  <SheetPortal>
    <SheetBackdrop />
    <BaseDialog.Popup
      ref={ref}
      className={cn(
        'tw:fixed tw:z-50 tw:border tw:border-slate-200/70 tw:bg-white tw:p-5 tw:shadow-lg tw:transition-transform tw:duration-200 tw:dark:border-slate-800 tw:dark:bg-slate-900',
        SIDE_STYLES[side],
        className,
      )}
      {...props}
    >
      {children}
      {showClose && (
        <SheetClose className="tw:absolute tw:top-4 tw:right-4 tw:rounded-lg tw:p-1 tw:text-slate-400 tw:transition-colors tw:hover:bg-slate-100 tw:hover:text-slate-600 tw:dark:hover:bg-slate-800 tw:dark:hover:text-slate-300">
          <X className="tw:h-4 tw:w-4" />
        </SheetClose>
      )}
    </BaseDialog.Popup>
  </SheetPortal>
));
SheetPopup.displayName = 'SheetPopup';

const SheetHeader = ({ className, ...props }) => (
  <div className={cn('tw:flex tw:flex-col tw:gap-1 tw:pr-6', className)} {...props} />
);

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <BaseDialog.Title ref={ref} className={cn('tw:font-heading tw:text-lg tw:font-bold', className)} {...props} />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <BaseDialog.Description ref={ref} className={cn('tw:text-sm tw:text-slate-500 tw:dark:text-slate-400', className)} {...props} />
));
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetBackdrop,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
