import { Home, BookOpen, Award, MessageSquare } from 'lucide-react';

// The 4 highest-frequency destinations. Everything else lives only in the /home grid
// (see src/pages/StudentHome.jsx) — tab-bar destinations are also cross-listed there for
// first-run discoverability, since a first-time student sees the grid before learning
// the tab bar exists. Profile lives as a top-right icon button on the Home screen instead
// of a tab slot, since it's an account-management surface rather than a study feature.
export const TAB_ITEMS = [
  { path: '/home', label: 'Home', icon: Home },
  { path: '/courses', label: 'Courses', icon: BookOpen },
  { path: '/quiz', label: 'Quiz', icon: Award },
  { path: '/ask', label: 'Ask', icon: MessageSquare },
];
