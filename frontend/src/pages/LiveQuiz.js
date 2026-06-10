import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAward,
  FiCheck,
  FiClock,
  FiLogIn,
  FiRefreshCw,
  FiSend,
  FiUsers,
} from 'react-icons/fi';
import liveQuizApi from '../utils/liveQuizApi';
import { createLiveQuizSocket } from '../utils/liveQuizSocket';
import SEO from '../components/SEO';
import './LiveQuiz.css';

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
    return <div className="live-quiz-loading"><div className="spinner" />Loading quiz...</div>;
  }

  return (
    <div className="live-quiz-page">
      <SEO
        title="Live Quiz - NounPaddi"
        description="Join the NounPaddi live quiz and compete on the leaderboard."
        url="/quiz"
        robots="noindex, nofollow"
      />
      <div className="container">
        <header className="live-quiz-header">
          <div>
            <p className="live-quiz-kicker">NounPaddi Live</p>
            <h1>{quiz?.title || 'Live Quiz'}</h1>
            <p>{quiz?.description || 'Join the next quiz and compete for a place in the top 10.'}</p>
          </div>
          {quiz && <span className={`live-quiz-status ${quiz.status}`}>{quiz.status}</span>}
        </header>

        {!quiz && (
          <section className="live-quiz-empty">
            <FiClock />
            <h2>No quiz is open yet</h2>
            <p>Come back when an admin has prepared or started a quiz.</p>
          </section>
        )}

        {quiz && !guest && (
          <section className="live-quiz-entry">
            <div className="live-quiz-entry-copy">
              <FiLogIn />
              <p className="live-quiz-kicker">{quiz.courseCode}</p>
              <h2>Choose a username and join</h2>
              <p>Your username will appear on the leaderboard. Your email is used only to identify your quiz entry.</p>
            </div>
            <form onSubmit={handleJoin}>
              <label>
                Username
                <input
                  type="text"
                  value={joinForm.username}
                  onChange={(event) => setJoinForm((current) => ({ ...current, username: event.target.value }))}
                  maxLength={40}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={joinForm.email}
                  onChange={(event) => setJoinForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </label>
              <button type="submit" disabled={joining}>
                <FiLogIn />
                {joining ? 'Joining...' : 'Join quiz'}
              </button>
            </form>
          </section>
        )}

        {quiz && guest && (
          <main className="live-quiz-layout">
            <section className="live-quiz-questions">
              <div className="live-quiz-section-head">
                <div>
                  <p className="live-quiz-kicker">{quiz.courseCode}</p>
                  <h2>Questions</h2>
                </div>
                  <span>{Math.max(0, quiz.questionCount - answeredCount)} remaining</span>
              </div>

              {quiz.status === 'draft' && (
                <div className="live-quiz-waiting">
                  <FiClock />
                  <h3>You have joined the quiz</h3>
                  <p>Questions will become answerable when the admin starts the quiz.</p>
                </div>
              )}

              {quiz.status === 'ended' && (
                <div className="live-quiz-waiting">
                  <FiCheck />
                  <h3>The quiz has ended</h3>
                  <p>The leaderboard remains visible while answers are reviewed.</p>
                </div>
              )}

              {quiz.status === 'live' && !currentQuestion && participantAnsweredCount >= quiz.questionCount && (
                <div className="live-quiz-waiting">
                  <FiCheck />
                  <h3>All answers submitted</h3>
                  <p>Watch the leaderboard while the quiz continues.</p>
                </div>
              )}

              {quiz.status === 'live' && !currentQuestion && participantAnsweredCount < quiz.questionCount && (
                <div className="live-quiz-waiting">
                  <FiRefreshCw className={stateLoading ? 'live-quiz-spin' : ''} />
                  <h3>Loading the next question</h3>
                  <p>Your quiz attempt is being synchronized.</p>
                </div>
              )}

              {quiz.status === 'live' && currentQuestion && (
                <article className="live-quiz-question" key={currentQuestion._id}>
                  <div className="live-quiz-question-topline">
                    <div className="live-quiz-question-number">Question {currentQuestion.order} of {quiz.questionCount}</div>
                    <div className={timeRemaining <= 5 ? 'live-quiz-timer urgent' : 'live-quiz-timer'}>
                      <FiClock />
                      <span>{timeRemaining}s</span>
                    </div>
                  </div>
                  <div className="live-quiz-timer-track" aria-hidden="true">
                    <div style={{ width: `${timerPercent}%` }} />
                  </div>
                  <h3>{currentQuestion.prompt}</h3>
                  {currentQuestion.questionType === 'single_answer' ? (
                    <div className="live-quiz-options">
                      {currentQuestion.options.map((option) => (
                        <label key={option} className={answers[currentQuestion._id] === option ? 'selected' : ''}>
                          <input
                            type="radio"
                            name={`question-${currentQuestion._id}`}
                            value={option}
                            checked={answers[currentQuestion._id] === option}
                            onChange={(event) => setAnswers((current) => ({ ...current, [currentQuestion._id]: event.target.value }))}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="live-quiz-answer-input"
                      type="text"
                      value={answers[currentQuestion._id] || ''}
                      onChange={(event) => setAnswers((current) => ({ ...current, [currentQuestion._id]: event.target.value }))}
                      placeholder="Type your answer"
                    />
                  )}
                  <button
                    type="button"
                    className="live-quiz-submit"
                    onClick={() => handleSubmitAnswer(currentQuestion)}
                    disabled={submittingId === currentQuestion._id || advancing || timeRemaining <= 0}
                  >
                    <FiSend />
                    {submittingId === currentQuestion._id ? 'Submitting...' : advancing ? 'Moving on...' : 'Submit answer'}
                  </button>
                </article>
              )}
            </section>

            <aside className="live-quiz-leaderboard">
              <div className="live-quiz-section-head">
                <div>
                  <p className="live-quiz-kicker">Live ranking</p>
                  <h2>Top 10</h2>
                </div>
                <FiRefreshCw />
              </div>
              <div className="live-quiz-leader-list">
                {leaderboard.map((leader) => (
                  <div className="live-quiz-leader" key={leader._id}>
                    <span className="live-quiz-rank">{leader.rank}</span>
                    <div>
                      <strong>{leader.username}</strong>
                      <small>{leader.score} correct / {leader.answeredCount} answered</small>
                    </div>
                    <span className="live-quiz-score">{leader.score}</span>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <div className="live-quiz-no-leaders"><FiUsers />No scores yet.</div>
                )}
              </div>
              <div className="live-quiz-leader-note">
                <FiAward />
                Scores rank students by total correct answers. Per-question correctness is not shown after submission.
              </div>
            </aside>
          </main>
        )}

        {message.text && <div className={`live-quiz-message ${message.type}`}>{message.text}</div>}
      </div>
    </div>
  );
};

export default LiveQuiz;
