import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { User } from 'lucide-react';
import { TAB_ITEMS } from './tabConfig';
import { cn } from '../lib/utils';

// Desktop counterpart to BottomTabBar — same TAB_ITEMS, shown only at md+ (BottomTabBar
// hides itself at that breakpoint via tw:md:hidden). A persistent top bar means desktop
// users need a Profile shortcut here too, not just on the Home screen's icon button.
const TopNavBar = () => (
  <header className="tw:sticky tw:top-0 tw:z-40 tw:hidden tw:h-16 tw:border-b tw:border-slate-200/70 tw:bg-white/95 tw:backdrop-blur tw:dark:border-slate-800 tw:dark:bg-slate-950/95 tw:md:block">
    <div className="tw:mx-auto tw:flex tw:h-16 tw:max-w-5xl tw:items-center tw:justify-between tw:gap-6 tw:px-6">
      <Link to="/home" className="tw:font-heading tw:text-lg tw:font-bold tw:tracking-tight tw:text-brand-600 tw:dark:text-brand-400">
        NounPaddi
      </Link>

      <nav className="tw:flex tw:items-center tw:gap-1">
        {TAB_ITEMS.map(({ key, path, label, icon: Icon, external }) => (
          external ? (
            <a
              key={key}
              href={path}
              target="_blank"
              rel="noreferrer"
              className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-xl tw:px-3 tw:py-2 tw:text-sm tw:font-semibold tw:text-slate-500 tw:transition-colors tw:hover:bg-slate-100 tw:dark:text-slate-400 tw:dark:hover:bg-slate-800"
            >
              <Icon className="tw:h-4 tw:w-4" /> {label}
            </a>
          ) : (
            <NavLink
              key={key}
              to={path}
              className={({ isActive }) => cn(
                'tw:flex tw:items-center tw:gap-1.5 tw:rounded-xl tw:px-3 tw:py-2 tw:text-sm tw:font-semibold tw:transition-colors',
                isActive
                  ? 'tw:bg-brand-50 tw:text-brand-600 tw:dark:bg-brand-950/60 tw:dark:text-brand-400'
                  : 'tw:text-slate-500 tw:hover:bg-slate-100 tw:dark:text-slate-400 tw:dark:hover:bg-slate-800',
              )}
            >
              <Icon className="tw:h-4 tw:w-4" /> {label}
            </NavLink>
          )
        ))}
      </nav>

      <Link
        to="/profile"
        aria-label="Profile"
        className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"
      >
        <User className="tw:h-4 tw:w-4" />
      </Link>
    </div>
  </header>
);

export default TopNavBar;
