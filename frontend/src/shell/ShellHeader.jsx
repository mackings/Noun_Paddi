import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

// Deep links, shared links, and notification links can land a student directly on a
// feature page with zero in-app history — navigate(-1) in that case pops out of the app
// entirely (to an external referrer, or nowhere), not back to the grid. React Router v6's
// history implementation stores { idx, key, usr } on window.history.state; idx === 0
// means this is the first entry in the session, so there's nowhere real to go back to.
const ShellHeader = ({ title, className }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/home', { replace: true });
    }
  };

  return (
    <header
      className={cn(
        'tw:sticky tw:top-0 tw:z-30 tw:flex tw:items-center tw:gap-3 tw:border-b tw:border-slate-200/70 tw:bg-white/90 tw:px-4 tw:py-3 tw:backdrop-blur tw:dark:border-slate-800 tw:dark:bg-slate-950/90 tw:md:top-16',
        className,
      )}
    >
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className="tw:flex tw:h-9 tw:w-9 tw:items-center tw:justify-center tw:rounded-xl tw:text-slate-600 tw:transition-colors tw:hover:bg-slate-100 tw:dark:text-slate-300 tw:dark:hover:bg-slate-800"
      >
        <ArrowLeft className="tw:h-5 tw:w-5" />
      </button>
      <h1 className="tw:font-heading tw:text-lg tw:font-bold tw:tracking-tight">{title}</h1>
    </header>
  );
};

export default ShellHeader;
