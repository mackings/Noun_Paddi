import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  LogIn,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react';
import liveQuizApi from '../utils/liveQuizApi';
import { createLiveQuizSocket } from '../utils/liveQuizSocket';
import SEO from '../components/SEO';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const STORAGE_KEY = 'np_live_quiz_guest_v1';

const readGuest = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};

const participantHeaders = (guest) => ({
  'X-Quiz-Participant': guest?.participantId || '',
  'X-Quiz-Token': guest?.token || '',
});

const STATUS_BADGE = {
  draft: 'neutral',
  live: 'success',
  ended: 'danger',
};

const LiveQuiz = () => {
  const [quiz, setQuiz] = useState(null);
  const [guest, setGuest] = useState(readGuest);
  const [questions, setQuestions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [answers, setAnswers] = useState({});
  const [joinForm, setJoinForm] = useState({ username: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [submittingId, setSubmittingId] = useState('');
  const [questionDeadline, setQuestionDeadline] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [participantAnsweredCount, setParticipantAnsweredCount] = useState(0);
  const [stateLoading, setStateLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const leaderboardRequestRef = useRef(0);

  const loadCurrentQuiz = useCallback(async () => {
    try {
      const response = await liveQuizApi.get('/live-quiz/current');
      setQuiz(response.data?.data || null);
    } catch (error) {
      setMessage({ type: 'error', text: 'The quiz could not be loaded.' });
    }
  }, []);

  const loadParticipantState = useCallback(async () => {
    if (!guest?.participantId || !guest?.token) return;
    try {
      setStateLoading(true);
      const response = await liveQuizApi.get('/live-quiz/participant/state', {
        headers: participantHeaders(guest),
      });
      setQuiz(response.data.data.quiz);
      setQuestions(response.data.data.questions || []);
      setQuestionDeadline(response.data.data.questionDeadline || null);
      setParticipantAnsweredCount(response.data.data.participant?.answeredCount || 0);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem(STORAGE_KEY);
        setGuest(null);
        setQuestions([]);
        setQuestionDeadline(null);
        setMessage({ type: 'error', text: 'Your quiz session expired. Join the quiz again to continue.' });
      } else {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Questions could not be loaded. Please refresh.' });
      }
    } finally {
      setStateLoading(false);
    }
  }, [guest]);

  const loadLeaderboard = useCallback(async (quizId) => {
    if (!quizId) return;
    const requestId = ++leaderboardRequestRef.current;
    try {
      const response = await liveQuizApi.get(`/live-quiz/${quizId}/leaderboard`);
      if (requestId === leaderboardRequestRef.current) {
        setLeaderboard(response.data?.data || []);
      }
    } catch (error) {
      // Keep the previous leaderboard during brief polling failures.
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const response = await liveQuizApi.get('/live-quiz/current');
        const currentQuiz = response.data?.data || null;
        setQuiz(currentQuiz);

        const guestQuizId = guest?.quiz?._id;
        if (guest && currentQuiz?._id && guestQuizId && guestQuizId !== currentQuiz._id) {
          localStorage.removeItem(STORAGE_KEY);
          setGuest(null);
          setQuestions([]);
          setQuestionDeadline(null);
        } else if (guest) {
          await loadParticipantState();
        }
      } catch (error) {
        setMessage({ type: 'error', text: 'The quiz could not be loaded.' });
      }
      setLoading(false);
    };
    initialize();
  }, [guest, loadParticipantState]);

  useEffect(() => {
    if (!quiz?._id) return undefined;
    const socket = createLiveQuizSocket();

    const joinQuizRoom = () => {
      setSocketConnected(true);
      socket.emit('liveQuiz:joinQuiz', { quizId: quiz._id });
    };

    socket.on('connect', joinQuizRoom);
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('liveQuiz:leaderboard', (payload) => {
      if (payload?.quizId === quiz._id) {
        leaderboardRequestRef.current += 1;
        setLeaderboard(payload.leaderboard || []);
      }
    });
    socket.on('liveQuiz:status', (payload) => {
      if (payload?.quizId !== quiz._id || !payload.quiz) return;
      setQuiz(payload.quiz);
      if (guest) loadParticipantState();
    });
    socket.on('liveQuiz:answerRecorded', (payload) => {
      if (payload?.quizId === quiz._id && payload.participantId === guest?.participantId) {
        setParticipantAnsweredCount(payload.answeredCount || 0);
      }
    });

    if (socket.connected) joinQuizRoom();

    return () => {
      socket.emit('liveQuiz:leaveQuiz', { quizId: quiz._id });
      socket.disconnect();
    };
  }, [guest, loadParticipantState, quiz?._id]);

  useEffect(() => {
    if (!quiz?._id) return undefined;
    loadLeaderboard(quiz._id);
    const timer = window.setInterval(() => {
      if (!socketConnected) loadLeaderboard(quiz._id);
      if (guest && !socketConnected) loadParticipantState();
      else if (!socketConnected) loadCurrentQuiz();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [guest, loadCurrentQuiz, loadLeaderboard, loadParticipantState, quiz?._id, socketConnected]);

  const unansweredQuestions = useMemo(
    () => questions.filter((question) => !question.answered),
    [questions]
  );
  const currentQuestion = unansweredQuestions[0] || null;
  const answeredCount = Math.max(0, Number(participantAnsweredCount || 0));
  const questionDuration = quiz?.questionDurationSeconds || 40;
  const timerPercent = Math.max(0, Math.min(100, (timeRemaining / questionDuration) * 100));

  useEffect(() => {
    if (!questionDeadline || !currentQuestion || quiz?.status !== 'live') {
      setTimeRemaining(0);
      return undefined;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((new Date(questionDeadline).getTime() - Date.now()) / 1000));
      setTimeRemaining(remaining);
    };

    updateTimer();
    const timer = window.setInterval(updateTimer, 250);
    return () => window.clearInterval(timer);
  }, [currentQuestion, questionDeadline, quiz?.status]);

  useEffect(() => {
    if (
      !currentQuestion
      || !questionDeadline
      || new Date(questionDeadline).getTime() > Date.now()
      || timeRemaining > 0
      || advancing
      || quiz?.status !== 'live'
    ) return;

    const markMissed = async () => {
      try {
        setAdvancing(true);
        await liveQuizApi.post(
          `/live-quiz/participant/questions/${currentQuestion._id}/miss`,
          {},
          { headers: participantHeaders(guest) }
        );
        setMessage({ type: 'error', text: 'Time elapsed. The question was recorded as missed.' });
        setAnswers((current) => ({ ...current, [currentQuestion._id]: '' }));
        await loadParticipantState();
        loadLeaderboard(quiz._id);
      } catch (error) {
        await loadParticipantState();
      } finally {
        setAdvancing(false);
      }
    };

    markMissed();
  }, [
    advancing,
    currentQuestion,
    guest,
    loadLeaderboard,
    loadParticipantState,
    questionDeadline,
    quiz?._id,
    quiz?.status,
    timeRemaining,
  ]);

  const handleJoin = async (event) => {
    event.preventDefault();
    if (!quiz?._id) return;
    try {
      setJoining(true);
      setMessage({ type: '', text: '' });
      const response = await liveQuizApi.post(`/live-quiz/${quiz._id}/join`, joinForm);
      const nextGuest = response.data.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextGuest));
      setGuest(nextGuest);
      setJoinForm({ username: '', email: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not join the quiz.' });
    } finally {
      setJoining(false);
    }
  };

  const handleSubmitAnswer = async (question) => {
    const answer = String(answers[question._id] || '').trim();
    if (!answer) {
      setMessage({ type: 'error', text: 'Enter or select an answer before submitting.' });
      return;
    }

    try {
      setSubmittingId(question._id);
      setMessage({ type: '', text: '' });
      await liveQuizApi.post(
        `/live-quiz/participant/questions/${question._id}/answer`,
        { answer },
        { headers: participantHeaders(guest) }
      );
      setQuestions((current) => current.map((item) => (
        item._id === question._id ? { ...item, answered: true } : item
      )));
      setAnswers((current) => ({ ...current, [question._id]: '' }));
      setMessage({ type: 'success', text: 'Answer submitted.' });
      await loadParticipantState();
      loadLeaderboard(quiz._id);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Answer could not be submitted.' });
    } finally {
      setSubmittingId('');
    }
  };

  if (loading) {
    return (
      <div className="np-shell tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
        <RefreshCw className="tw:h-6 tw:w-6 tw:animate-spin" />
        <p className="tw:text-sm">Loading quiz...</p>
      </div>
    );
  }

  return (
    <div className="np-shell tw:space-y-4 tw:p-4">
      <SEO
        title="Live Quiz - NounPaddi"
        description="Join the NounPaddi live quiz and compete on the leaderboard."
        url="/quiz"
        robots="noindex, nofollow"
      />

      <Card className="tw:flex tw:items-start tw:justify-between tw:gap-3 tw:p-5">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">NounPaddi Live</p>
          <h1 className="tw:font-heading tw:mt-1 tw:text-xl tw:font-bold tw:tracking-tight">{quiz?.title || 'Live Quiz'}</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">
            {quiz?.description || 'Join the next quiz and compete for a place in the top 10.'}
          </p>
        </div>
        {quiz && <Badge variant={STATUS_BADGE[quiz.status] || 'neutral'} className="tw:flex-none tw:capitalize">{quiz.status}</Badge>}
      </Card>

      {!quiz && (
        <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
          <Clock className="tw:h-8 tw:w-8 tw:text-slate-300 tw:dark:text-slate-600" />
          <h2 className="tw:font-heading tw:text-base tw:font-bold">No quiz is open yet</h2>
          <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Come back when an admin has prepared or started a quiz.</p>
        </Card>
      )}

      {quiz && !guest && (
        <Card className="tw:space-y-4 tw:p-5">
          <div className="tw:flex tw:items-start tw:gap-2.5">
            <span className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
              <LogIn className="tw:h-4 tw:w-4" />
            </span>
            <div>
              <p className="tw:text-xs tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{quiz.courseCode}</p>
              <h2 className="tw:font-heading tw:text-base tw:font-bold">Choose a username and join</h2>
              <p className="tw:mt-1 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                Your username will appear on the leaderboard. Your email is used only to identify your quiz entry.
              </p>
            </div>
          </div>
          <form onSubmit={handleJoin} className="tw:space-y-3">
            <label className="tw:block tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Username</span>
              <Input
                type="text"
                value={joinForm.username}
                onChange={(event) => setJoinForm((current) => ({ ...current, username: event.target.value }))}
                maxLength={40}
                required
              />
            </label>
            <label className="tw:block tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Email</span>
              <Input
                type="email"
                value={joinForm.email}
                onChange={(event) => setJoinForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <Button type="submit" disabled={joining} className="tw:w-full">
              <LogIn className="tw:h-4 tw:w-4" /> {joining ? 'Joining...' : 'Join quiz'}
            </Button>
          </form>
        </Card>
      )}

      {quiz && guest && (
        <div className="tw:space-y-4">
          <Card className="tw:space-y-4 tw:p-5">
            <div className="tw:flex tw:items-center tw:justify-between">
              <div>
                <p className="tw:text-xs tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{quiz.courseCode}</p>
                <h2 className="tw:font-heading tw:text-base tw:font-bold">Questions</h2>
              </div>
              <span className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{Math.max(0, quiz.questionCount - answeredCount)} remaining</span>
            </div>

            {quiz.status === 'draft' && (
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-6 tw:text-center">
                <Clock className="tw:h-6 tw:w-6 tw:text-slate-400" />
                <h3 className="tw:font-heading tw:text-sm tw:font-bold">You have joined the quiz</h3>
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Questions will become answerable when the admin starts the quiz.</p>
              </div>
            )}

            {quiz.status === 'ended' && (
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-6 tw:text-center">
                <CheckCircle2 className="tw:h-6 tw:w-6 tw:text-emerald-500" />
                <h3 className="tw:font-heading tw:text-sm tw:font-bold">The quiz has ended</h3>
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">The leaderboard remains visible while answers are reviewed.</p>
              </div>
            )}

            {quiz.status === 'live' && !currentQuestion && participantAnsweredCount >= quiz.questionCount && (
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-6 tw:text-center">
                <CheckCircle2 className="tw:h-6 tw:w-6 tw:text-emerald-500" />
                <h3 className="tw:font-heading tw:text-sm tw:font-bold">All answers submitted</h3>
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Watch the leaderboard while the quiz continues.</p>
              </div>
            )}

            {quiz.status === 'live' && !currentQuestion && participantAnsweredCount < quiz.questionCount && (
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-6 tw:text-center">
                <RefreshCw className={cn('tw:h-6 tw:w-6 tw:text-slate-400', stateLoading && 'tw:animate-spin')} />
                <h3 className="tw:font-heading tw:text-sm tw:font-bold">Loading the next question</h3>
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Your quiz attempt is being synchronized.</p>
              </div>
            )}

            {quiz.status === 'live' && currentQuestion && (
              <div key={currentQuestion._id} className="tw:space-y-3">
                <div className="tw:flex tw:items-center tw:justify-between">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-500 tw:dark:text-slate-400">
                    Question {currentQuestion.order} of {quiz.questionCount}
                  </span>
                  <span className={cn(
                    'tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-bold',
                    timeRemaining <= 5 ? 'tw:text-red-600 tw:dark:text-red-400' : 'tw:text-slate-600 tw:dark:text-slate-300',
                  )}
                  >
                    <Clock className="tw:h-3.5 tw:w-3.5" /> {timeRemaining}s
                  </span>
                </div>
                <div className="tw:h-1.5 tw:overflow-hidden tw:rounded-full tw:bg-slate-100 tw:dark:bg-slate-800" aria-hidden="true">
                  <div
                    className={cn('tw:h-full tw:rounded-full tw:transition-all', timeRemaining <= 5 ? 'tw:bg-red-500' : 'tw:bg-brand-500')}
                    style={{ width: `${timerPercent}%` }}
                  />
                </div>
                <h3 className="tw:font-heading tw:text-base tw:font-bold">{currentQuestion.prompt}</h3>
                {currentQuestion.questionType === 'single_answer' ? (
                  <div className="tw:space-y-2">
                    {currentQuestion.options.map((option) => {
                      const selected = answers[currentQuestion._id] === option;
                      return (
                        <label
                          key={option}
                          className={cn(
                            'tw:flex tw:cursor-pointer tw:items-center tw:gap-2.5 tw:rounded-xl tw:border tw:p-3 tw:text-sm tw:transition-colors',
                            selected
                              ? 'tw:border-brand-500 tw:bg-brand-50 tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300'
                              : 'tw:border-slate-200 tw:dark:border-slate-800',
                          )}
                        >
                          <input
                            type="radio"
                            name={`question-${currentQuestion._id}`}
                            value={option}
                            checked={selected}
                            onChange={(event) => setAnswers((current) => ({ ...current, [currentQuestion._id]: event.target.value }))}
                            className="tw:h-4 tw:w-4 tw:accent-brand-600"
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={answers[currentQuestion._id] || ''}
                    onChange={(event) => setAnswers((current) => ({ ...current, [currentQuestion._id]: event.target.value }))}
                    placeholder="Type your answer"
                  />
                )}
                <Button
                  className="tw:w-full"
                  onClick={() => handleSubmitAnswer(currentQuestion)}
                  disabled={submittingId === currentQuestion._id || advancing || timeRemaining <= 0}
                >
                  <Send className="tw:h-4 tw:w-4" />
                  {submittingId === currentQuestion._id ? 'Submitting...' : advancing ? 'Moving on...' : 'Submit answer'}
                </Button>
              </div>
            )}
          </Card>

          <Card className="tw:space-y-3 tw:p-5">
            <div className="tw:flex tw:items-center tw:justify-between">
              <div>
                <p className="tw:text-xs tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">Live ranking</p>
                <h2 className="tw:font-heading tw:text-base tw:font-bold">Top 10</h2>
              </div>
              <RefreshCw className="tw:h-4 tw:w-4 tw:text-slate-400" />
            </div>
            <div className="tw:space-y-2">
              {leaderboard.map((leader) => (
                <div key={leader._id} className="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
                  <span className="tw:flex tw:h-7 tw:w-7 tw:flex-none tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-100 tw:text-xs tw:font-bold tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                    {leader.rank}
                  </span>
                  <div className="tw:flex-1">
                    <strong className="tw:block tw:text-sm tw:font-semibold">{leader.username}</strong>
                    <small className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{leader.score} correct / {leader.answeredCount} answered</small>
                  </div>
                  <span className="tw:font-heading tw:text-base tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{leader.score}</span>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400"><Users className="tw:h-4 tw:w-4" /> No scores yet.</p>
              )}
            </div>
            <p className="tw:flex tw:items-start tw:gap-2 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:text-xs tw:text-slate-500 tw:dark:bg-slate-800/60 tw:dark:text-slate-400">
              <Award className="tw:h-4 tw:w-4 tw:flex-none" />
              Scores rank students by total correct answers. Per-question correctness is not shown after submission.
            </p>
          </Card>
        </div>
      )}

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
    </div>
  );
};

export default LiveQuiz;
