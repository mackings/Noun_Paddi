import React, { useEffect, useMemo, useState } from 'react';
import {
  FiBell,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import './ExamTimetable.css';

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
      <div className="exam-timetable-page">
        <div className="container">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading your exam timetable...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-timetable-page">
      <div className="container">
        <section className="exam-hero">
          <div>
            <p className="exam-kicker">2026_1 E-Exam Draft Timetable</p>
            <h1>My Exam Timetable</h1>
            <p>Add your course codes, view exam dates and times, then record your score after each paper.</p>
          </div>
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button type="button" className="btn btn-primary" onClick={enableReminderNotifications}>
              <FiBell /> Enable Reminders
            </button>
          )}
        </section>

        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
            {message.text}
          </div>
        )}

        <section className="exam-builder-grid">
          <div className="exam-search-panel">
            <div className="exam-panel-head">
              <FiSearch />
              <div>
                <h2>Add Courses</h2>
                <p>Type course codes like GST105, BIO101, or CIT104.</p>
              </div>
            </div>

            <div className="exam-search-box">
              <FiSearch />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value.toUpperCase())}
                placeholder="Enter course code"
              />
            </div>

            <div className="exam-result-list">
              {searching && <p className="exam-muted">Searching timetable...</p>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="exam-muted">No course matched that code.</p>
              )}
              {results.map((entry) => {
                const added = scheduledCodes.has(entry.courseCode);
                return (
                  <article key={entry.courseCode} className="exam-result-card">
                    <div>
                      <strong>{entry.courseCode}</strong>
                      <h3>{entry.courseTitle}</h3>
                      <p><FiCalendar /> {formatExamDate(entry.examDate)} · <FiClock /> {entry.startTime}</p>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm ${added ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => addCourse(entry.courseCode)}
                      disabled={added}
                    >
                      {added ? <><FiCheckCircle /> Added</> : <><FiPlus /> Add</>}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="exam-summary-panel">
            <h2>Summary</h2>
            <div className="exam-summary-stat">
              <span>Courses</span>
              <strong>{schedule.length}</strong>
            </div>
            <div className="exam-summary-stat">
              <span>Scores Recorded</span>
              <strong>{schedule.filter((item) => item.score !== null && item.score !== undefined).length}</strong>
            </div>
            <div className="exam-notice">
              <FiBell />
              <p>Two hours after an exam starts, this app sends a push reminder to record your score if notifications are enabled.</p>
            </div>
          </aside>
        </section>

        <section className="exam-schedule-section">
          <div className="exam-section-head">
            <h2>Your Personalized Timetable</h2>
            <p>{schedule.length} selected course{schedule.length === 1 ? '' : 's'}</p>
          </div>

          {schedule.length === 0 ? (
            <div className="exam-empty">
              <FiCalendar />
              <h3>No courses added yet</h3>
              <p>Search for your course codes above and add them to build your exam plan.</p>
            </div>
          ) : (
            <div className="exam-day-list">
              {Object.entries(groupedSchedule).map(([dateKey, exams]) => (
                <div className="exam-day-group" key={dateKey}>
                  <h3>{formatExamDate(dateKey)}</h3>
                  <div className="exam-card-grid">
                    {exams.map((exam) => {
                      const status = getStatus(exam);
                      return (
                        <article className={`exam-course-card ${status}`} key={exam._id}>
                          <div className="exam-card-top">
                            <div>
                              <span>{exam.startTime}</span>
                              <h4>{exam.courseCode}</h4>
                            </div>
                            <button type="button" onClick={() => removeCourse(exam._id)} aria-label={`Remove ${exam.courseCode}`}>
                              <FiTrash2 />
                            </button>
                          </div>
                          <p>{exam.courseTitle}</p>
                          <div className="exam-score-row">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder={exam.score !== null && exam.score !== undefined ? String(exam.score) : 'Score'}
                              value={scores[exam._id] ?? ''}
                              onChange={(event) => setScores((current) => ({ ...current, [exam._id]: event.target.value }))}
                            />
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => recordScore(exam)}>
                              Save
                            </button>
                          </div>
                          {exam.score !== null && exam.score !== undefined && (
                            <span className="exam-score-pill">Recorded: {exam.score}</span>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ExamTimetable;
