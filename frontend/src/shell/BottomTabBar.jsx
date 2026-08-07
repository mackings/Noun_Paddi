import React from 'react';
import { NavLink } from 'react-router-dom';
import { TAB_ITEMS } from './tabConfig';
import { cn } from '../lib/utils';

const tabClass = (isActive) => cn(
  'tw:flex tw:min-h-14 tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:gap-0.5 tw:text-[11px] tw:font-semibold tw:transition-colors',
  isActive ? 'tw:text-brand-600 tw:dark:text-brand-400' : 'tw:text-slate-400 tw:dark:text-slate-500',
);

const BottomTabBar = () => (
  <nav
    className="tw:fixed tw:inset-x-0 tw:bottom-0 tw:z-40 tw:flex tw:border-t tw:border-slate-200/70 tw:bg-white/95 tw:backdrop-blur tw:dark:border-slate-800 tw:dark:bg-slate-950/95 tw:md:hidden"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    {TAB_ITEMS.map(({ key, path, label, icon: Icon, external }) => (
      external ? (
        <a key={key} href={path} target="_blank" rel="noreferrer" className={tabClass(false)}>
          <Icon className="tw:h-5 tw:w-5" />
          {label}
        </a>
      ) : (
        <NavLink key={key} to={path} className={({ isActive }) => tabClass(isActive)}>
          <Icon className="tw:h-5 tw:w-5" />
          {label}
        </NavLink>
      )
    ))}
  </nav>
);

export default BottomTabBar;
