import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Trash2,
  Loader2,
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import ShellHeader from '../shell/ShellHeader';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const formatExamDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  });
};

const getStatus = (exam) => {
  if (exam.score !== null && exam.score !== undefined) return 'recorded';
  if (new Date(exam.reminderDueAt).getTime() <= Date.now()) return 'score-due';
  return 'upcoming';
};

const STATUS_BADGE = {
  recorded: { variant: 'success', label: 'Recorded' },
  'score-due': { variant: 'warning', label: 'Score due' },
  upcoming: { variant: 'neutral', label: 'Upcoming' },
};

const ExamTimetable = () => {
  const { notificationPermission, enableNotifications } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [scores, setScores] = useState({});

  const fetchSchedule = async () => {
    const response = await api.get('/exam-timetable/my');
    setSchedule(response.data.data || []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await fetchSchedule();
      } catch (error) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to load your timetable.' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const response = await api.get(`/exam-timetable/search?q=${encodeURIComponent(normalized)}`);
        setResults(response.data.data || []);
      } catch (error) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const scheduledCodes = useMemo(
    () => new Set(schedule.map((item) => item.courseCode)),
    [schedule]
  );

  const groupedSchedule = useMemo(() => {
    return schedule.reduce((groups, exam) => {
      const key = new Date(exam.examDate).toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(exam);
      return groups;
    }, {});
  }, [schedule]);

  const addCourse = async (courseCode) => {
    try {
      setMessage({ type: '', text: '' });
      await api.post('/exam-timetable/my', { courseCode });
      await fetchSchedule();
      setQuery('');
      setResults([]);
      setMessage({ type: 'success', text: `${courseCode} added to your exam timetable.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to add course.' });
    }
  };

  const removeCourse = async (id) => {
    try {
      await api.delete(`/exam-timetable/my/${id}`);
      await fetchSchedule();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to remove course.' });
    }
  };

  const recordScore = async (exam) => {
    const score = Number(scores[exam._id]);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setMessage({ type: 'error', text: 'Enter a score from 0 to 100.' });
      return;
    }

    try {
      const response = await api.patch(`/exam-timetable/my/${exam._id}/score`, { score });
      setSchedule((current) => current.map((item) => (
        item._id === exam._id ? response.data.data : item
      )));
      setScores((current) => ({ ...current, [exam._id]: '' }));
      setMessage({ type: 'success', text: `${exam.courseCode} score recorded.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to record score.' });
    }
  };

  const enableReminderNotifications = async () => {
    const result = await enableNotifications();
    if (result?.subscribed) {
      setMessage({ type: 'success', text: 'Notifications enabled for exam score reminders.' });
    } else {
      setMessage({ type: 'error', text: 'Notifications were not enabled on this device.' });
    }
  };

  if (loading) {
    return (
      <div className="np-shell">
        <ShellHeader title="Exam Timetable" />
        <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
          <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
          <p className="tw:text-sm">Loading your exam timetable...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="np-shell">
      <ShellHeader title="Exam Timetable" />

      <div className="tw:space-y-4 tw:p-4">
        <Card className="tw:space-y-3 tw:p-5">
          <div>
            <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">2026_1 E-Exam Final Timetable</p>
            <h1 className="tw:font-heading tw:mt-1 tw:text-xl tw:font-bold tw:tracking-tight">My Exam Timetable</h1>
            <p className="tw:mt-1 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">
              Add your course codes, view exam dates and times, then record your score after each paper.
            </p>
          </div>
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <Button onClick={enableReminderNotifications}>
              <Bell className="tw:h-4 tw:w-4" /> Enable Reminders
            </Button>
          )}
        </Card>

        {message.text && (
          <div
            className={cn(
              'tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm',
              message.type === 'success'
                ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
            )}
          >
            {message.text}
          </div>
        )}

        <Card className="tw:space-y-3 tw:p-4">
          <div className="tw:flex tw:items-center tw:gap-2.5">
            <span className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
              <Search className="tw:h-4 tw:w-4" />
            </span>
            <div>
              <h2 className="tw:font-heading tw:text-sm tw:font-bold">Add Courses</h2>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Type course codes like GST105, BIO101, or CIT104.</p>
            </div>
          </div>

          <Input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value.toUpperCase())}
            placeholder="Enter course code"
          />

          <div className="tw:space-y-2">
            {searching && <p className="tw:text-xs tw:text-slate-400">Searching timetable...</p>}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="tw:text-xs tw:text-slate-400">No course matched that code.</p>
            )}
            {results.map((entry) => {
              const added = scheduledCodes.has(entry.courseCode);
              return (
                <div key={entry.courseCode} className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
                  <div>
                    <strong className="tw:text-xs tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{entry.courseCode}</strong>
                    <h3 className="tw:font-heading tw:text-sm tw:font-bold">{entry.courseTitle}</h3>
                    <p className="tw:mt-0.5 tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                      <Calendar className="tw:h-3 tw:w-3" /> {formatExamDate(entry.examDate)}
                      <Clock className="tw:h-3 tw:w-3" /> {entry.startTime}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={added ? 'secondary' : 'default'}
                    onClick={() => addCourse(entry.courseCode)}
                    disabled={added}
                  >
                    {added ? <><CheckCircle2 className="tw:h-3.5 tw:w-3.5" /> Added</> : <><Plus className="tw:h-3.5 tw:w-3.5" /> Add</>}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="tw:space-y-3 tw:p-4">
          <h2 className="tw:font-heading tw:text-sm tw:font-bold">Summary</h2>
          <div className="tw:flex tw:items-center tw:justify-between tw:text-sm">
            <span className="tw:text-slate-500 tw:dark:text-slate-400">Courses</span>
            <strong className="tw:font-heading">{schedule.length}</strong>
          </div>
          <div className="tw:flex tw:items-center tw:justify-between tw:text-sm">
            <span className="tw:text-slate-500 tw:dark:text-slate-400">Scores Recorded</span>
            <strong className="tw:font-heading">{schedule.filter((item) => item.score !== null && item.score !== undefined).length}</strong>
          </div>
          <p className="tw:flex tw:items-start tw:gap-2 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:text-xs tw:text-slate-500 tw:dark:bg-slate-800/60 tw:dark:text-slate-400">
            <Bell className="tw:h-4 tw:w-4 tw:flex-none" />
            Two hours after an exam starts, this app sends a push reminder to record your score if notifications are enabled.
          </p>
        </Card>

        <div className="tw:space-y-3">
          <div className="tw:flex tw:items-center tw:justify-between">
            <h2 className="tw:font-heading tw:text-sm tw:font-bold">Your Personalized Timetable</h2>
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{schedule.length} selected course{schedule.length === 1 ? '' : 's'}</p>
          </div>

          {schedule.length === 0 ? (
            <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-8 tw:text-center">
              <Calendar className="tw:h-8 tw:w-8 tw:text-slate-300 tw:dark:text-slate-600" />
              <h3 className="tw:font-heading tw:text-sm tw:font-bold">No courses added yet</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Search for your course codes above and add them to build your exam plan.</p>
            </Card>
          ) : (
            <div className="tw:space-y-4">
              {Object.entries(groupedSchedule).map(([dateKey, exams]) => (
                <div key={dateKey} className="tw:space-y-2">
                  <h3 className="tw:text-xs tw:font-bold tw:text-slate-500 tw:uppercase tw:tracking-wide tw:dark:text-slate-400">{formatExamDate(dateKey)}</h3>
                  <div className="tw:space-y-2">
                    {exams.map((exam) => {
                      const status = getStatus(exam);
                      const badge = STATUS_BADGE[status];
                      return (
                        <Card key={exam._id} className="tw:p-4">
                          <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
                            <div>
                              <span className="tw:text-xs tw:font-semibold tw:text-slate-400">{exam.startTime}</span>
                              <h4 className="tw:font-heading tw:text-sm tw:font-bold">{exam.courseCode}</h4>
                            </div>
                            <div className="tw:flex tw:items-center tw:gap-2">
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                              <button
                                type="button"
                                onClick={() => removeCourse(exam._id)}
                                aria-label={`Remove ${exam.courseCode}`}
                                className="tw:rounded-lg tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-600 tw:dark:hover:bg-red-500/10 tw:dark:hover:text-red-400"
                              >
                                <Trash2 className="tw:h-4 tw:w-4" />
                              </button>
                            </div>
                          </div>
                          <p className="tw:mt-1 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{exam.courseTitle}</p>
                          <div className="tw:mt-3 tw:flex tw:items-center tw:gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder={exam.score !== null && exam.score !== undefined ? String(exam.score) : 'Score'}
                              value={scores[exam._id] ?? ''}
                              onChange={(event) => setScores((current) => ({ ...current, [exam._id]: event.target.value }))}
                              className="tw:h-9"
                            />
                            <Button size="sm" onClick={() => recordScore(exam)}>Save</Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamTimetable;
