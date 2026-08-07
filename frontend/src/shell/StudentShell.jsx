import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Toaster } from '../components/ui/sonner';
import BottomTabBar from './BottomTabBar';
import TopNavBar from './TopNavBar';
import '../styles/tailwind.css';

// Wraps every student-facing route (see studentShellRoutes.js for the exact list) with
// the shell chrome, but only once a student is actually logged in. Five of the wrapped
// routes (/ask, /courses, /course/:id, /practice, /quiz) are also reachable logged-out —
// same as before this redesign — in which case this just renders the page with no shell
// chrome around it. Below md, BottomTabBar is the primary nav and TopNavBar stays hidden;
// at md+ that flips (TopNavBar shown, BottomTabBar hides itself) — see each component's
// own responsive classes.
const StudentShell = () => {
  const { user } = useAuth();
  const isStudent = !!user && user.role !== 'admin';

  if (!isStudent) {
    return <Outlet />;
  }

  return (
    <div className="np-shell np-shell-root tw:min-h-screen tw:bg-slate-50 tw:pb-16 tw:dark:bg-slate-950 tw:md:pb-0">
      <Toaster />
      <TopNavBar />
      <Outlet />
      <BottomTabBar />
    </div>
  );
};

export default StudentShell;
