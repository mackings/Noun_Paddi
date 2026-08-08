import { Home, BookOpen, GraduationCap, MessageSquare } from 'lucide-react';
import { AI_TUTOR_URL } from './aiTutorLink';

// The 4 tab-bar destinations. Everything else lives only in the /home grid (see
// src/pages/StudentHome.jsx) — these same destinations are also cross-listed there for
// first-run discoverability, since a first-time student sees the grid before learning
// the tab bar exists. AI Tutor has no in-app page — it opens Theresa at asktheresa.com
// instead (see aiTutorLink.js), and Past Question routes into Ask (there's no separate
// past-question page — Ask already fields these questions conversationally), so both are
// marked `external`/share a path but need distinct `key`s since NavLink is keyed on more
// than just the route. Profile lives as a top-right icon button on the Home screen
// instead of a tab slot, since it's an account-management surface, not a study feature.
export const TAB_ITEMS = [
  { key: 'home', path: '/home', label: 'Home', icon: Home },
  { key: 'summary', path: '/courses', label: 'Summary', icon: BookOpen },
  { key: 'ai-tutor', path: AI_TUTOR_URL, label: 'AI Tutor', icon: GraduationCap, external: true },
  { key: 'past-question', path: '/ask', label: 'Past Question', icon: MessageSquare },
];
