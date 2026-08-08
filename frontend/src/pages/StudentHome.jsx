import React from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Award, MessageSquare, Calendar, PlayCircle, Bell,
  ShieldCheck, Briefcase, ClipboardList, FileSearch, User,
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { useAuth } from '../contexts/AuthContext';
import { TMA_WHATSAPP_URL } from '../shell/tmaWhatsapp';

// The full feature tray, in the order requested: Course Summary, Past Questions, TMA,
// Course Material, Projects, Plagiarism, then the rest. Tab-bar destinations (Summary,
// AI Tutor, Past Question) are also cross-listed here for first-run discoverability,
// since a first-time student sees this grid before learning the bottom tab bar exists.
// Profile is not listed here — it's the top-right icon button instead, since it's account
// management, not a study feature. "TMA" has no in-app page — it opens a WhatsApp chat
// instead (tmaWhatsapp.js). "Course Material" is a live web search for the real course
// guide/lecture notes PDF (not a summary) — see pages/CourseMaterial.js.
const FEATURES = [
  { key: 'course-summary', path: '/courses', label: 'Course Summary', description: 'Browse courses and get clean summaries', icon: BookOpen },
  { key: 'past-questions', path: '/ask', label: 'Past Questions', description: 'Ask about past questions', icon: MessageSquare },
  { key: 'tma', path: TMA_WHATSAPP_URL, label: 'TMA', description: 'Chat with us on WhatsApp', icon: ClipboardList, external: true },
  { key: 'course-material', path: '/course-material', label: 'Course Material', description: 'Search and download the real course PDF', icon: FileSearch },
  { key: 'projects', path: '/projects', label: 'Projects', description: 'Consultation and project fees', icon: Briefcase },
  { key: 'plagiarism', path: '/plagiarism', label: 'Plagiarism Checker', description: 'Check your project for originality', icon: ShieldCheck },
  { key: 'dashboard', path: '/dashboard', label: 'Dashboard', description: 'Your progress at a glance', icon: LayoutDashboard },
  { key: 'quiz', path: '/quiz', label: 'Quiz', description: 'Practice with live quizzes', icon: Award },
  { key: 'exam-timetable', path: '/exam-timetable', label: 'Exam Timetable', description: 'Your upcoming exams', icon: Calendar },
  { key: 'videos', path: '/videos', label: 'Videos', description: 'Watch course videos', icon: PlayCircle },
  { key: 'reminders', path: '/reminders', label: 'Reminders', description: 'Study reminders and alarms', icon: Bell },
];

const FeatureCardContent = ({ label, description, Icon }) => (
  <Card interactive className="tw:flex tw:h-full tw:flex-col tw:gap-2 tw:p-4">
    <span className="tw:flex tw:h-10 tw:w-10 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
      <Icon className="tw:h-5 tw:w-5" />
    </span>
    <span>
      <span className="tw:block tw:font-heading tw:text-sm tw:font-bold">{label}</span>
      <span className="tw:block tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{description}</span>
    </span>
  </Card>
);

const StudentHome = () => {
  const { user } = useAuth();
  const firstName = user?.name ? user.name.split(' ')[0] : '';

  return (
    <div className="tw:mx-auto tw:max-w-5xl tw:space-y-5 tw:p-5">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <div>
          <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </p>
          <h1 className="tw:font-heading tw:text-2xl tw:font-bold tw:tracking-tight">What do you want to do?</h1>
        </div>
        <Link
          to="/profile"
          aria-label="Profile"
          className="tw:flex tw:h-10 tw:w-10 tw:flex-none tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300 tw:md:hidden"
        >
          <User className="tw:h-5 tw:w-5" />
        </Link>
      </div>

      <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:md:grid-cols-3 tw:lg:grid-cols-4 tw:xl:grid-cols-5">
        {FEATURES.map(({ key, path, label, description, icon: Icon, external }) => (
          external ? (
            <a key={key} href={path} target="_blank" rel="noreferrer" className="tw:block">
              <FeatureCardContent label={label} description={description} Icon={Icon} />
            </a>
          ) : (
            <Link key={key} to={path} className="tw:block">
              <FeatureCardContent label={label} description={description} Icon={Icon} />
            </Link>
          )
        ))}
      </div>
    </div>
  );
};

export default StudentHome;
