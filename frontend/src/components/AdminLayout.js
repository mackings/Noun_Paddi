import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  Command,
  LayoutGrid,
  UploadCloud,
  Layers,
  Users,
  Activity,
  Briefcase,
  Map,
  BookOpen,
  Shield,
  PenSquare,
  Award,
  ClipboardList,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import '../styles/tailwind.css';

const adminMenu = [
  { to: '/admin/overview', label: 'Overview', icon: LayoutGrid, key: 'overview' },
  { to: '/admin/broadcast', label: 'Push Broadcast', icon: Bell, key: 'broadcast', group: 'Operations' },
  { to: '/admin/api-usage', label: 'API Usage', icon: Activity, key: 'api-usage', group: 'Operations' },
  { to: '/admin/upload?tab=faculties', label: 'Faculties', icon: Briefcase, key: 'faculties', group: 'Academic Setup' },
  { to: '/admin/upload?tab=departments', label: 'Departments', icon: Map, key: 'departments', group: 'Academic Setup' },
  { to: '/admin/upload?tab=courses', label: 'Courses', icon: BookOpen, key: 'courses', group: 'Academic Setup' },
  { to: '/admin/upload?tab=materials', label: 'Upload Materials', icon: UploadCloud, key: 'materials-upload', group: 'Content' },
  { to: '/admin/materials', label: 'Material Library', icon: Layers, key: 'materials-library', group: 'Content' },
  { to: '/admin/tma?tab=assistant', label: 'TMA', icon: PenSquare, key: 'tma', group: 'Content' },
  { to: '/admin/tma?tab=records', label: 'TMA Records', icon: ClipboardList, key: 'tma-records', group: 'Content' },
  { to: '/admin/quiz', label: 'Live Quiz', icon: Award, key: 'quiz', group: 'Content' },
  { to: '/admin/users', label: 'Users', icon: Users, key: 'users', group: 'Access' },
  { to: '/admin/users#invite', label: 'Invite Admin', icon: Shield, key: 'invite-admin', group: 'Access' },
];

const AdminLayout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeUploadTab = new URLSearchParams(location.search).get('tab') || 'faculties';
  const activeTmaTab = new URLSearchParams(location.search).get('tab') || 'assistant';
  const activeHash = location.hash || '';

  const isItemActive = (item) => {
    if (item.key === 'invite-admin') {
      return location.pathname === '/admin/users' && activeHash === '#invite';
    }
    if (item.key === 'users') {
      return location.pathname === '/admin/users' && activeHash !== '#invite';
    }
    if (location.pathname === '/admin/upload') {
      if (item.key === 'faculties' && activeUploadTab === 'faculties') return true;
      if (item.key === 'departments' && activeUploadTab === 'departments') return true;
      if (item.key === 'courses' && activeUploadTab === 'courses') return true;
      if (item.key === 'materials-upload' && activeUploadTab === 'materials') return true;
    }
    if (location.pathname === '/admin/tma') {
      if (item.key === 'tma' && activeTmaTab === 'assistant') return true;
      if (item.key === 'tma-records' && activeTmaTab === 'records') return true;
      return false;
    }
    return location.pathname === item.to;
  };
  const activeItem = adminMenu.find((item) => isItemActive(item)) || adminMenu[0];
  const menuGroups = adminMenu.reduce((groups, item) => {
    const groupName = item.group || 'Workspace';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(item);
    return groups;
  }, {});

  const initials = (user?.name || 'A').charAt(0).toUpperCase();

  const navContent = (
    <>
      <div className="tw:flex tw:items-center tw:gap-3 tw:px-5 tw:py-5">
        <span className="tw:flex tw:h-10 tw:w-10 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-600 tw:text-white">
          <Command className="tw:h-5 tw:w-5" />
        </span>
        <div>
          <p className="tw:text-[11px] tw:font-bold tw:tracking-wide tw:text-slate-400 tw:uppercase">Admin Workspace</p>
          <h2 className="tw:font-heading tw:text-base tw:font-bold">NounPaddi</h2>
        </div>
      </div>

      <nav className="tw:flex-1 tw:space-y-5 tw:overflow-y-auto tw:px-3 tw:pb-4">
        {Object.entries(menuGroups).map(([groupName, items]) => (
          <div key={groupName}>
            <p className="tw:px-3 tw:pb-1.5 tw:text-[11px] tw:font-bold tw:tracking-wide tw:text-slate-400 tw:uppercase">{groupName}</p>
            <div className="tw:space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      'tw:flex tw:items-center tw:gap-2.5 tw:rounded-xl tw:px-3 tw:py-2 tw:text-sm tw:font-semibold tw:transition-colors',
                      active
                        ? 'tw:bg-brand-600 tw:text-white'
                        : 'tw:text-slate-600 tw:hover:bg-slate-100 tw:dark:text-slate-300 tw:dark:hover:bg-slate-900',
                    )}
                  >
                    <Icon className="tw:h-4 tw:w-4 tw:shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="tw:space-y-3 tw:border-t tw:border-slate-200/70 tw:p-4 tw:dark:border-slate-800">
        <div className="tw:flex tw:items-center tw:gap-3">
          <span className="tw:flex tw:h-9 tw:w-9 tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-100 tw:text-sm tw:font-bold tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300">
            {initials}
          </span>
          <div className="tw:min-w-0">
            <strong className="tw:block tw:truncate tw:text-sm tw:font-bold">{user?.name || 'Admin'}</strong>
            <p className="tw:truncate tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{user?.email || 'admin@nounpaddi'}</p>
          </div>
        </div>
        <p className="tw:flex tw:items-start tw:gap-1.5 tw:rounded-xl tw:bg-slate-100 tw:p-2.5 tw:text-xs tw:text-slate-500 tw:dark:bg-slate-900 tw:dark:text-slate-400">
          <Bell className="tw:h-3.5 tw:w-3.5 tw:shrink-0 tw:translate-y-0.5" />
          Broadcast updates and platform changes from one workspace.
        </p>
      </div>
    </>
  );

  return (
    <div className="np-shell tw:flex tw:min-h-screen tw:bg-slate-50 tw:dark:bg-slate-950">
      <aside className="tw:sticky tw:top-0 tw:hidden tw:h-screen tw:w-64 tw:flex-col tw:border-r tw:border-slate-200/70 tw:bg-white tw:dark:border-slate-800 tw:dark:bg-slate-950 tw:lg:flex">
        {navContent}
      </aside>

      {mobileNavOpen && (
        <div className="tw:fixed tw:inset-0 tw:z-50 tw:flex tw:lg:hidden">
          <div className="tw:absolute tw:inset-0 tw:bg-slate-950/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="tw:relative tw:flex tw:h-full tw:w-72 tw:flex-col tw:bg-white tw:dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="tw:absolute tw:top-4 tw:right-4 tw:flex tw:h-8 tw:w-8 tw:items-center tw:justify-center tw:rounded-lg tw:text-slate-400"
              aria-label="Close menu"
            >
              <X className="tw:h-5 tw:w-5" />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      <main className="tw:min-w-0 tw:flex-1">
        <header className="tw:sticky tw:top-0 tw:z-30 tw:flex tw:items-center tw:justify-between tw:border-b tw:border-slate-200/70 tw:bg-white/95 tw:px-4 tw:py-3 tw:backdrop-blur tw:dark:border-slate-800 tw:dark:bg-slate-950/95 tw:sm:px-6">
          <div className="tw:flex tw:items-center tw:gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="tw:flex tw:h-9 tw:w-9 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-slate-200 tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300 tw:lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="tw:h-4.5 tw:w-4.5" />
            </button>
            <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-sm">
              <span className="tw:text-slate-400">Admin</span>
              <ChevronRight className="tw:h-3.5 tw:w-3.5 tw:text-slate-300" />
              <strong className="tw:font-heading tw:font-bold">{activeItem?.label || 'Overview'}</strong>
            </div>
          </div>
          <div className="tw:flex tw:items-center tw:gap-3">
            <div className="tw:hidden tw:items-center tw:gap-1.5 tw:rounded-full tw:bg-emerald-100 tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300 tw:sm:flex">
              <Activity className="tw:h-3.5 tw:w-3.5" />
              <span>Live workspace</span>
            </div>
            <span className="tw:flex tw:h-9 tw:w-9 tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-100 tw:text-sm tw:font-bold tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300">
              {initials}
            </span>
          </div>
        </header>
        <div className="tw:p-4 tw:sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
