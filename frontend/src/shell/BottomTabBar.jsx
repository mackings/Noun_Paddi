import React from 'react';
import { NavLink } from 'react-router-dom';
import { TAB_ITEMS } from './tabConfig';
import { cn } from '../lib/utils';

const BottomTabBar = () => (
  <nav
    className="tw:fixed tw:inset-x-0 tw:bottom-0 tw:z-40 tw:flex tw:border-t tw:border-slate-200/70 tw:bg-white/95 tw:backdrop-blur tw:dark:border-slate-800 tw:dark:bg-slate-950/95"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    {TAB_ITEMS.map(({ path, label, icon: Icon }) => (
      <NavLink
        key={path}
        to={path}
        className={({ isActive }) => cn(
          'tw:flex tw:min-h-14 tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:gap-0.5 tw:text-[11px] tw:font-semibold tw:transition-colors',
          isActive ? 'tw:text-brand-600 tw:dark:text-brand-400' : 'tw:text-slate-400 tw:dark:text-slate-500',
        )}
      >
        <Icon className="tw:h-5 tw:w-5" />
        {label}
      </NavLink>
    ))}
  </nav>
);

export default BottomTabBar;
