import { Home, BookOpen, ClipboardList, MessageSquare } from 'lucide-react';
import { TMA_WHATSAPP_URL } from './tmaWhatsapp';

// The 4 tab-bar destinations. Everything else lives only in the /home grid (see
// src/pages/StudentHome.jsx) — these same destinations are also cross-listed there for
// first-run discoverability, since a first-time student sees the grid before learning
// the tab bar exists. TMA has no in-app page — it opens a WhatsApp chat instead (see
// tmaWhatsapp.js), so it's marked `external` and rendered as a plain <a>, not a route.
// Profile lives as a top-right icon button on the Home screen instead of a tab slot,
// since it's an account-management surface rather than a study feature.
export const TAB_ITEMS = [
  { key: 'home', path: '/home', label: 'Home', icon: Home },
  { key: 'summary', path: '/courses', label: 'Summary', icon: BookOpen },
  { key: 'tma', path: TMA_WHATSAPP_URL, label: 'TMA', icon: ClipboardList, external: true },
  { key: 'past-question', path: '/ask', label: 'Past Question', icon: MessageSquare },
];
