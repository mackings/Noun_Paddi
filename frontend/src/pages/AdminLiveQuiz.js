import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  FileText,
  Play,
  RefreshCw,
  Square,
  Trash2,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import liveQuizApi from '../utils/liveQuizApi';
import { createLiveQuizSocket } from '../utils/liveQuizSocket';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const statusBadgeClass = {
  draft: 'tw:bg-slate-100 tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300',
  live: 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300',
  ended: 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
};

const AdminLiveQuiz = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState('');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const detailRequestRef = useRef(0);
  const detailRefreshTimerRef = useRef(null);
  const detailStateRef = useRef(null);
  const [form, setForm] = useState({
    title: 'NOU107 Live Quiz',
    courseCode: 'NOU107',
    description: '120 difficult questions sourced exclusively from the NOU107 study guide.',
    file: null,
  });

  const selectedQuiz = useMemo(
    () => quizzes.find((quiz) => quiz._id === selectedQuizId) || null,
    [quizzes, selectedQuizId]
  );

  const loadQuizzes = async (refreshDetail = false) => {
    try {
      setLoading(true);
      const response = await liveQuizApi.get('/live-quiz/admin/quizzes');
      const items = response.data?.data || [];
      const nextQuizId = items.some((quiz) => quiz._id === selectedQuizId)
        ? selectedQuizId
        : (items[0]?._id || '');
      setQuizzes(items);
      setSelectedQuizId(nextQuizId);
      if (refreshDetail) await loadDetail(nextQuizId);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load quizzes.' });
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (quizId, options = {}) => {
    if (!quizId) {
      detailRequestRef.current += 1;
      setDetail(null);
      return;
    }
    const requestId = ++detailRequestRef.current;
    try {
      const includeQuestions = options.includeQuestions ?? showAnswerKey;
      const response = await liveQuizApi.get(`/live-quiz/admin/quizzes/${quizId}`, {
        params: {
          answersLimit: 25,
          participantsLimit: 50,
          includeQuestions,
        },
      });
      if (requestId === detailRequestRef.current) {
        const nextDetail = response.data?.data || null;
        detailStateRef.current = nextDetail;
        setDetail(nextDetail);
      }
    } catch (error) {
      if (requestId === detailRequestRef.current) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load quiz details.' });
      }
    }
  };

  useEffect(() => {
    loadQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setShowAnswerKey(false);
    detailStateRef.current = null;
    setDetail(null);
    loadDetail(selectedQuizId, { includeQuestions: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuizId]);

  useEffect(() => {
    if (!selectedQuizId) return undefined;
    const socket = createLiveQuizSocket();
    const scheduleDetailRefresh = () => {
      if (detailRefreshTimerRef.current) return;
      detailRefreshTimerRef.current = window.setTimeout(() => {
        detailRefreshTimerRef.current = null;
        loadDetail(selectedQuizId);
      }, 200);
    };

    const joinQuizRoom = () => {
      socket.emit('liveQuiz:joinQuiz', { quizId: selectedQuizId });
    };

    socket.on('connect', joinQuizRoom);
    socket.on('liveQuiz:status', (payload) => {
      if (payload?.quizId !== selectedQuizId) return;
      loadQuizzes(true);
    });
    socket.on('liveQuiz:answerRecorded', (payload) => {
      if (payload?.quizId === selectedQuizId) {
        scheduleDetailRefresh();
      }
    });
    socket.on('liveQuiz:participantJoined', (payload) => {
      if (payload?.quizId === selectedQuizId) {
        scheduleDetailRefresh();
      }
    });
    socket.on('liveQuiz:leaderboard', (payload) => {
      if (payload?.quizId === selectedQuizId) {
        const currentDetail = detailStateRef.current;
        if (!currentDetail) return;
        detailRequestRef.current += 1;
        const currentById = new Map(
          (currentDetail.leaderboard || []).map((participant) => [String(participant._id), participant])
        );
        const nextDetail = {
          ...currentDetail,
          leaderboard: (payload.leaderboard || []).map((participant) => ({
            ...currentById.get(String(participant._id)),
            ...participant,
            score: participant.points ?? participant.score,
          })),
        };
        detailStateRef.current = nextDetail;
        setDetail(nextDetail);
      }
    });
    socket.on('liveQuiz:deleted', (payload) => {
      if (payload?.quizId === selectedQuizId) {
        setDetail(null);
        loadQuizzes();
      }
    });

    if (socket.connected) joinQuizRoom();

    return () => {
      if (detailRefreshTimerRef.current) {
        window.clearTimeout(detailRefreshTimerRef.current);
        detailRefreshTimerRef.current = null;
      }
      socket.emit('liveQuiz:leaveQuiz', { quizId: selectedQuizId });
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuizId]);

  const handleRootImport = async () => {
    try {
      setImporting(true);
      setMessage({ type: '', text: '' });
      const response = await liveQuizApi.post('/live-quiz/admin/import-root-nou107', {
        title: form.title,
        courseCode: form.courseCode,
        description: form.description,
      });
      setMessage({ type: 'success', text: `${response.data.data.questionCount} NOU107 questions generated.` });
      await loadQuizzes();
      setSelectedQuizId(response.data.data._id);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to import the root NOU107 PDF.' });
    } finally {
      setImporting(false);
    }
  };

  const handleUploadImport = async (event) => {
    event.preventDefault();
    if (!form.file) {
      setMessage({ type: 'error', text: 'Choose a PDF file first.' });
      return;
    }

    try {
      setImporting(true);
      setMessage({ type: '', text: '' });
      const data = new FormData();
      data.append('file', form.file);
      data.append('title', form.title);
      data.append('courseCode', form.courseCode);
      data.append('description', form.description);
      const response = await liveQuizApi.post('/live-quiz/admin/import-pdf', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage({ type: 'success', text: `${response.data.data.questionCount} questions generated from the PDF.` });
      await loadQuizzes();
      setSelectedQuizId(response.data.data._id);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to import PDF.' });
    } finally {
      setImporting(false);
    }
  };

  const handleStatus = async (status) => {
    if (!selectedQuizId || updatingStatus) return;
    try {
      setUpdatingStatus(status);
      setMessage({ type: '', text: '' });
      await liveQuizApi.patch(`/live-quiz/admin/quizzes/${selectedQuizId}/status`, { status });
      setMessage({ type: 'success', text: `Quiz status changed to ${status}.` });
      await loadQuizzes();
      await loadDetail(selectedQuizId);
    } catch (error) {
      const statusCode = error.response?.status;
      const fallback = statusCode === 401 || statusCode === 403
        ? 'Your admin session expired. Sign in again and retry.'
        : 'Failed to update quiz status.';
      setMessage({ type: 'error', text: error.response?.data?.message || fallback });
    } finally {
      setUpdatingStatus('');
    }
  };

  const handleToggleAnswerKey = async () => {
    const nextValue = !showAnswerKey;
    setShowAnswerKey(nextValue);
    await loadDetail(selectedQuizId, { includeQuestions: nextValue });
  };

  const handleDeleteQuiz = async () => {
    if (!selectedQuizId || !selectedQuiz) return;
    const confirmed = window.confirm(
      `Delete "${selectedQuiz.title}" and all its questions, participants, and answers? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setMessage({ type: '', text: '' });
      await liveQuizApi.delete(`/live-quiz/admin/quizzes/${selectedQuizId}`);
      setMessage({ type: 'success', text: 'Quiz deleted.' });
      setDetail(null);
      setSelectedQuizId('');
      await loadQuizzes();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete quiz.' });
    }
  };

  const handleModerate = async (answerId, isCorrect) => {
    try {
      await liveQuizApi.patch(`/live-quiz/admin/answers/${answerId}`, { isCorrect });
      await loadDetail(selectedQuizId);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to moderate answer.' });
    }
  };

  return (
    <div className="tw:space-y-5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Live competition</p>
          <h1 className="tw:font-heading tw:text-xl tw:font-bold tw:tracking-tight">Quiz Control</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Generate questions from a PDF, start the live quiz, and moderate recorded answers.</p>
        </div>
        <Button variant="outline" onClick={() => loadQuizzes(true)}>
          <RefreshCw className="tw:h-4 tw:w-4" /> Refresh
        </Button>
      </div>

      {message.text && (
        <div className={cn(
          'tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm',
          message.type === 'success'
            ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
            : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
        )}>
          {message.text}
        </div>
      )}

      <Card className="tw:p-5">
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
          <div>
            <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Gemini question generation</p>
            <h2 className="tw:font-heading tw:text-base tw:font-bold">Create a 120-question quiz</h2>
          </div>
          <FileText className="tw:h-5 tw:w-5 tw:text-slate-300" />
        </div>
        <form onSubmit={handleUploadImport} className="tw:mt-4 tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
          <label className="tw:block tw:space-y-1.5">
            <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Quiz title</span>
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          </label>
          <label className="tw:block tw:space-y-1.5">
            <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Course code</span>
            <Input value={form.courseCode} onChange={(event) => setForm((current) => ({ ...current, courseCode: event.target.value }))} required />
          </label>
          <label className="tw:block tw:space-y-1.5 tw:sm:col-span-2">
            <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Description</span>
            <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="tw:block tw:space-y-1.5 tw:sm:col-span-2">
            <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Future PDF upload</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
              className="tw:block tw:w-full tw:text-sm tw:text-slate-500 tw:dark:text-slate-400"
            />
          </label>
          <div className="tw:flex tw:flex-wrap tw:gap-2 tw:sm:col-span-2">
            <Button type="button" variant="outline" onClick={handleRootImport} disabled={importing}>
              <FileText className="tw:h-4 tw:w-4" /> {importing ? 'Generating questions...' : 'Use root NOU107 PDF'}
            </Button>
            <Button type="submit" disabled={importing}>
              <UploadCloud className="tw:h-4 tw:w-4" /> Import uploaded PDF
            </Button>
          </div>
        </form>
      </Card>

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-[300px_1fr]">
        <Card className="tw:p-4">
          <div className="tw:flex tw:items-center tw:justify-between">
            <div>
              <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Quiz library</p>
              <h2 className="tw:font-heading tw:text-sm tw:font-bold">Quizzes</h2>
            </div>
            <span className="tw:text-sm tw:font-bold tw:text-slate-400">{quizzes.length}</span>
          </div>
          <div className="tw:mt-3 tw:max-h-[60vh] tw:space-y-1.5 tw:overflow-y-auto">
            {loading && <p className="tw:text-sm tw:text-slate-400">Loading quizzes...</p>}
            {quizzes.map((quiz) => (
              <button
                type="button"
                key={quiz._id}
                onClick={() => setSelectedQuizId(quiz._id)}
                className={cn(
                  'tw:block tw:w-full tw:rounded-xl tw:border tw:p-3 tw:text-left tw:transition-colors',
                  selectedQuizId === quiz._id
                    ? 'tw:border-brand-600 tw:bg-brand-50 tw:dark:bg-brand-950'
                    : 'tw:border-slate-200/70 tw:dark:border-slate-800',
                )}
              >
                <strong className="tw:block tw:text-sm tw:font-bold">{quiz.title}</strong>
                <span className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{quiz.courseCode} / {quiz.questionCount} questions / {quiz.status}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="tw:space-y-4">
          {!selectedQuiz && (
            <Card className="tw:p-10 tw:text-center tw:text-sm tw:text-slate-400">Select or create a quiz.</Card>
          )}
          {selectedQuiz && (
            <>
              <Card className="tw:p-5">
                <div className="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
                  <div>
                    <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">{selectedQuiz.courseCode}</p>
                    <h2 className="tw:font-heading tw:text-lg tw:font-bold">{selectedQuiz.title}</h2>
                    <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">{selectedQuiz.questionCount} questions / {detail?.participantCount || 0} participants</p>
                  </div>
                  <span className={cn('tw:rounded-full tw:px-3 tw:py-1 tw:text-xs tw:font-bold tw:capitalize', statusBadgeClass[selectedQuiz.status] || statusBadgeClass.draft)}>{selectedQuiz.status}</span>
                </div>

                <div className="tw:mt-4 tw:flex tw:flex-wrap tw:gap-2">
                  <Button size="sm" variant="outline" disabled={Boolean(updatingStatus)} onClick={() => handleStatus('draft')}><Clock className="tw:h-3.5 tw:w-3.5" /> {updatingStatus === 'draft' ? 'Updating...' : 'Draft'}</Button>
                  <Button size="sm" disabled={Boolean(updatingStatus)} onClick={() => handleStatus('live')}><Play className="tw:h-3.5 tw:w-3.5" /> {updatingStatus === 'live' ? 'Starting...' : 'Start quiz'}</Button>
                  <Button size="sm" variant="outline" disabled={Boolean(updatingStatus)} onClick={() => handleStatus('ended')}><Square className="tw:h-3.5 tw:w-3.5" /> {updatingStatus === 'ended' ? 'Ending...' : 'End quiz'}</Button>
                  <Button size="sm" variant="destructive" onClick={handleDeleteQuiz}><Trash2 className="tw:h-3.5 tw:w-3.5" /> Delete</Button>
                </div>

                <div className="tw:mt-4 tw:grid tw:grid-cols-3 tw:gap-3">
                  <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:text-center tw:dark:bg-slate-900">
                    <FileText className="tw:mx-auto tw:h-4 tw:w-4 tw:text-brand-600" />
                    <strong className="tw:block tw:font-heading tw:text-lg tw:font-bold">{selectedQuiz.questionCount}</strong>
                    <span className="tw:text-[11px] tw:text-slate-400">Questions</span>
                  </div>
                  <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:text-center tw:dark:bg-slate-900">
                    <Users className="tw:mx-auto tw:h-4 tw:w-4 tw:text-brand-600" />
                    <strong className="tw:block tw:font-heading tw:text-lg tw:font-bold">{detail?.participantCount || 0}</strong>
                    <span className="tw:text-[11px] tw:text-slate-400">Participants</span>
                  </div>
                  <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:text-center tw:dark:bg-slate-900">
                    <Check className="tw:mx-auto tw:h-4 tw:w-4 tw:text-brand-600" />
                    <strong className="tw:block tw:font-heading tw:text-lg tw:font-bold">{detail?.answerCount || 0}</strong>
                    <span className="tw:text-[11px] tw:text-slate-400">Recorded answers</span>
                  </div>
                </div>
              </Card>

              <Card className="tw:p-5">
                <div className="tw:flex tw:items-center tw:justify-between">
                  <div>
                    <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Live ranking</p>
                    <h2 className="tw:font-heading tw:text-sm tw:font-bold">Leaderboard</h2>
                  </div>
                  <span className="tw:text-sm tw:font-bold tw:text-slate-400">{detail?.leaderboard?.length || 0}</span>
                </div>
                <div className="tw:mt-3 tw:space-y-2">
                  {(detail?.leaderboard || []).map((participant) => (
                    <article key={participant._id} className="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                      <span className="tw:flex tw:h-7 tw:w-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-100 tw:text-xs tw:font-bold tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300">{participant.rank}</span>
                      <div className="tw:min-w-0 tw:flex-1">
                        <strong className="tw:block tw:truncate tw:text-sm">{participant.username}</strong>
                        <p className="tw:truncate tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{participant.email}</p>
                      </div>
                      <div className="tw:shrink-0 tw:text-right">
                        <strong className="tw:block tw:text-sm tw:font-bold">{participant.score}</strong>
                        <span className="tw:text-[11px] tw:text-slate-400">{participant.correctCount} correct / {participant.answeredCount} answered</span>
                      </div>
                    </article>
                  ))}
                  {detail && detail.leaderboard?.length === 0 && (
                    <p className="tw:py-4 tw:text-center tw:text-sm tw:text-slate-400">No participants are on the leaderboard yet.</p>
                  )}
                </div>
              </Card>

              <Card className="tw:p-5">
                <div className="tw:flex tw:items-center tw:justify-between">
                  <div>
                    <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Answer key</p>
                    <h2 className="tw:font-heading tw:text-sm tw:font-bold">Generated questions</h2>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleToggleAnswerKey} disabled={!selectedQuizId}>
                    {showAnswerKey ? 'Hide' : 'Load'}
                  </Button>
                </div>
                {showAnswerKey ? (
                  <div className="tw:mt-3 tw:space-y-2">
                    {(detail?.questions || []).map((question) => (
                      <article key={question._id} className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-900">
                        <span className="tw:text-[11px] tw:font-semibold tw:text-brand-600">Q{question.order} / {question.questionType}</span>
                        <h3 className="tw:text-sm tw:font-semibold">{question.prompt}</h3>
                        <p className="tw:mt-1 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Accepted: {(question.acceptedAnswers || []).join(', ')}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="tw:mt-3 tw:text-sm tw:text-slate-400">Question key is hidden until needed.</p>
                )}
              </Card>

              <Card className="tw:p-5">
                <div className="tw:flex tw:items-center tw:justify-between">
                  <div>
                    <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Moderation</p>
                    <h2 className="tw:font-heading tw:text-sm tw:font-bold">Recent answers</h2>
                  </div>
                  <span className="tw:text-xs tw:text-slate-400">{(detail?.answers || []).length} of {detail?.answerCount || 0}</span>
                </div>
                <div className="tw:mt-3 tw:space-y-2">
                  {(detail?.answers || []).map((answer) => (
                    <article key={answer._id} className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:rounded-xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                      <div className="tw:min-w-0">
                        <span className="tw:text-[11px] tw:font-semibold tw:text-brand-600">Q{answer.questionId?.order} / {answer.questionId?.questionType}</span>
                        <h3 className="tw:text-sm tw:font-semibold">{answer.questionId?.prompt}</h3>
                        <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400"><strong>{answer.participantId?.username}</strong> ({answer.participantId?.email}) answered: {answer.answer}</p>
                        <small className="tw:text-[11px] tw:text-slate-400">Accepted: {(answer.questionId?.acceptedAnswers || []).join(', ')}</small>
                      </div>
                      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
                        <span className={cn(
                          'tw:rounded-full tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold',
                          answer.isCorrect
                            ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                            : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
                        )}>
                          {answer.isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                        <button type="button" title="Mark correct" onClick={() => handleModerate(answer._id, true)} className="tw:flex tw:h-7 tw:w-7 tw:items-center tw:justify-center tw:rounded-lg tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300"><Check className="tw:h-3.5 tw:w-3.5" /></button>
                        <button type="button" title="Mark incorrect" onClick={() => handleModerate(answer._id, false)} className="tw:flex tw:h-7 tw:w-7 tw:items-center tw:justify-center tw:rounded-lg tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300"><X className="tw:h-3.5 tw:w-3.5" /></button>
                      </div>
                    </article>
                  ))}
                  {detail && detail.answers?.length === 0 && <p className="tw:py-4 tw:text-center tw:text-sm tw:text-slate-400">No answers have been submitted yet.</p>}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLiveQuiz;
