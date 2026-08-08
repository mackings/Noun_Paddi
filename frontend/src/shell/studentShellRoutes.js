// Every path StudentShell wraps. Kept in one place since two things need to agree on it:
// App.js's footer-hiding check (mirrors the existing `.startsWith('/admin')` pattern
// AdminLayout already uses) and StudentShell's own route nesting.
export const STUDENT_SHELL_PATHS = [
  '/home',
  '/dashboard',
  '/explore',
  '/profile',
  '/reminders',
  '/exam-timetable',
  '/videos',
  '/plagiarism',
  '/projects',
  '/projects/consultation',
  '/projects/my-fees',
  '/consultation-terms',
  '/ask',
  '/course-material',
  '/courses',
  '/courses/all',
  '/practice',
  '/quiz',
];

export function isStudentShellRoute(pathname) {
  if (STUDENT_SHELL_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/course/')) return true;
  return false;
}
