import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Toaster } from '../components/ui/sonner';
import BottomTabBar from './BottomTabBar';
import '../styles/tailwind.css';

// Wraps every student-facing route (see studentShellRoutes.js for the exact list) with
// the mobile shell chrome — bottom tab bar, toast host — but only once a student is
// actually logged in. Five of the wrapped routes (/ask, /courses, /course/:id, /practice,
// /quiz) are also reachable logged-out — same as before this redesign — in which case
// this just renders the page with no shell chrome around it.
const StudentShell = () => {
  const { user } = useAuth();
  const isStudent = !!user && user.role !== 'admin';

  if (!isStudent) {
    return <Outlet />;
  }

  return (
    <div className="np-shell tw:min-h-screen tw:bg-slate-50 tw:pb-16 tw:dark:bg-slate-950">
      <Toaster />
      <Outlet />
      <BottomTabBar />
    </div>
  );
};

export default StudentShell;
