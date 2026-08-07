import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import api from '../utils/api';
import SEO from '../components/SEO';
import { convertHalfToTrueFalse } from '../utils/questionTransformer';
import { trackFeatureVisit } from '../utils/featureTracking';
import ShellHeader from '../shell/ShellHeader';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const Practice = () => {
  const expectedQuestionCount = 70;
  const minStartQuestions = 10;
  const isLoggedIn = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null); // Single answer (number) or array of numbers
  const [examMode, setExamMode] = useState(null); // 'e-exam' | 'pop'
  const [showModeSetup, setShowModeSetup] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [questionSyncing, setQuestionSyncing] = useState(false);
  const [examStartError, setExamStartError] = useState('');
  const [popAnswers, setPopAnswers] = useState({});
  const [popQuestions, setPopQuestions] = useState([]);
  const [popInstructions, setPopInstructions] = useState('');
  const [popLoading, setPopLoading] = useState(false);
  const [popGrading, setPopGrading] = useState(false);
  const [popGradeResult, setPopGradeResult] = useState(null);
  const [popReviewItems, setPopReviewItems] = useState([]);
  const [examComplete, setExamComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  // Timer states
  const [showTimerSetup, setShowTimerSetup] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(60); // in minutes
  const [timeRemaining, setTimeRemaining] = useState(null); // in seconds
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    trackFeatureVisit('exams');
  }, []);

  // Leaderboard states
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const questionPollRef = useRef(null);
  const questionPollDelayRef = useRef(3000);
  const startExamButtonRef = useRef(null);
  const location = useLocation();
  const autoSelectRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const courseId = params.get('courseId');
    if (!courseId || autoSelectRef.current || selectedCourse || loading) {
      return;
    }
    autoSelectRef.current = true;
    selectCourseForExam(courseId);
  }, [location.search, selectedCourse, loading]);

  useEffect(() => {
    return () => {
      if (questionPollRef.current) {
        clearTimeout(questionPollRef.current);
        questionPollRef.current = null;
      }
    };
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses');
      setCourses(response.data.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const selectCourseForExam = async (courseId) => {
    try {
      setLoading(true);
      setExamStartError('');
      setQuestionSyncing(false);
      if (questionPollRef.current) {
        clearTimeout(questionPollRef.current);
        questionPollRef.current = null;
      }
      const response = await api.get(`/questions/course/${courseId}`);

      // Convert 50% to True/False, keep rest as single-answer
      const transformedQuestions = convertHalfToTrueFalse(response.data.data);

      setQuestions(transformedQuestions);
      setSelectedCourse(courseId);
      setShowModeSetup(true);
      setLeaderboard([]);
      setMyRank(null);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setLoading(false);
    }
  };

  const scheduleQuestionRefresh = (courseId) => {
    if (!isLoggedIn) return;
    if (!courseId) return;
    if (questionPollRef.current) return;

    setQuestionSyncing(true);
    questionPollDelayRef.current = 3000;

    const poll = async () => {
      try {
        const response = await api.get(`/questions/course/${courseId}`);
        const transformedQuestions = convertHalfToTrueFalse(response.data.data);
        setQuestions((prev) => {
          if (transformedQuestions.length > prev.length) {
            return transformedQuestions;
          }
          return prev;
        });

        if (transformedQuestions.length < expectedQuestionCount) {
          api.post(`/questions/course/${courseId}/ensure`).catch((error) => {
            console.error('Error triggering question generation:', error);
          });
        }

        if (transformedQuestions.length >= expectedQuestionCount) {
          setQuestionSyncing(false);
          questionPollRef.current = null;
          questionPollDelayRef.current = 3000;
          return;
        }
      } catch (error) {
        console.error('Error refreshing questions:', error);
      }

      questionPollDelayRef.current = Math.min(questionPollDelayRef.current * 1.5, 15000);
      questionPollRef.current = setTimeout(poll, questionPollDelayRef.current);
    };

    questionPollRef.current = setTimeout(poll, questionPollDelayRef.current);
  };

  const selectExamMode = async (mode) => {
    setExamMode(mode);
    setShowModeSetup(false);
    if (mode === 'e-exam') {
      setShowTimerSetup(true);
    } else {
      setPopLoading(true);
      setTimeRemaining(null);
      setTimerActive(false);
      setCurrentQuestionIndex(0);
      setScore(0);
      setAnswers([]);
      setPopAnswers({});
      setPopGradeResult(null);
      setExamComplete(false);
      try {
        const response = await api.get(`/questions/pop-paper/${selectedCourse}`);
        const popPaper = response.data.data || {};
        setPopInstructions(popPaper.instructions || '');
        setPopQuestions(Array.isArray(popPaper.questions) ? popPaper.questions : []);
        setPopReviewItems([]);
      } catch (error) {
        console.error('Error fetching POP paper:', error);
        setPopInstructions('');
        setPopQuestions([]);
        setPopReviewItems([]);
      } finally {
        setPopLoading(false);
      }
    }
  };

  const startExamWithTimer = async () => {
    if (questions.length === 0) {
      setExamStartError('No practice questions are available for this course yet.');
      return;
    }

    if (isLoggedIn && questions.length < minStartQuestions) {
      setExamStartError('We are still preparing your exam. Please wait a moment and try again.');
      return;
    }
    setExamStartError('');

    const durationInSeconds = selectedDuration * 60;
    setTimeRemaining(durationInSeconds);
    setTimerActive(true);
    setShowTimerSetup(false);
    setCurrentQuestionIndex(0);
    setScore(0);
    setAnswers([]);
    setPopAnswers({});
    setPopGradeResult(null);
    setPopReviewItems([]);
    setExamComplete(false);

    if (isLoggedIn) {
      try {
        await api.post(`/questions/course/${selectedCourse}/ensure`);
      } catch (error) {
        console.error('Error queueing question generation:', error);
      }
      scheduleQuestionRefresh(selectedCourse);
    }
  };

  const handleSelectDuration = (duration) => {
    setSelectedDuration(duration);

    window.requestAnimationFrame(() => {
      startExamButtonRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const fetchLeaderboard = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch leaderboard (public endpoint)
      const leaderboardRes = await api.get(`/leaderboard/course/${selectedCourse}?limit=10`);
      setLeaderboard(leaderboardRes.data.data);

      // Only fetch rank if logged in
      if (token) {
        try {
          const rankRes = await api.get(`/leaderboard/my-rank/${selectedCourse}`);
          setMyRank(rankRes.data.data);
        } catch (rankError) {
          console.log('Could not fetch rank:', rankError);
          setMyRank(null);
        }
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  }, [selectedCourse]);

  const submitExamResults = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const timeTaken = selectedDuration * 60 - (timeRemaining || 0); // Actual time taken in seconds
      const totalQuestions = examMode === 'e-exam' ? questions.length : questions.length;

      // Only submit if user is logged in
      if (token) {
        await api.post('/leaderboard/submit', {
          courseId: selectedCourse,
          score,
          totalQuestions,
          duration: selectedDuration * 60,
          timeTaken,
          answers: answers.map(a => ({
            questionId: a.questionId,
            answer: a.answer,
            isCorrect: a.isCorrect
          }))
        });
      }

      // Fetch leaderboard (works for everyone)
      await fetchLeaderboard();
    } catch (error) {
      console.error('Error submitting exam results:', error);
      // Still fetch leaderboard even if submission fails
      await fetchLeaderboard();
    }
  }, [answers, examMode, fetchLeaderboard, questions.length, score, selectedCourse, selectedDuration, timeRemaining]);

  const handleTimeUp = useCallback(async () => {
    // Auto-complete the exam when time runs out
    setExamComplete(true);
    setTimerActive(false);
    if (examMode === 'e-exam') {
      await submitExamResults();
    }
  }, [examMode, submitExamResults]);

  // Timer countdown effect
  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setTimerActive(false);
            // Auto-submit exam when time runs out
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [handleTimeUp, timerActive, timeRemaining]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (answerIndex) => {
    const currentQuestion = (examMode === 'pop' ? popQuestions : questions)[currentQuestionIndex];
    const questionType = currentQuestion.questionType || 'multiple-choice';

    if (questionType === 'multi-select') {
      // For multi-select, toggle the answer in an array
      const currentAnswers = Array.isArray(selectedAnswer) ? selectedAnswer : [];

      if (currentAnswers.includes(answerIndex)) {
        // Remove if already selected
        setSelectedAnswer(currentAnswers.filter(idx => idx !== answerIndex));
      } else {
        // Add if not selected
        setSelectedAnswer([...currentAnswers, answerIndex].sort());
      }
    } else {
      // For single answer questions (multiple-choice, true-false)
      setSelectedAnswer(answerIndex);
    }
  };

  const handleSubmitAnswer = async () => {
    const currentQuestion = (examMode === 'pop' ? popQuestions : questions)[currentQuestionIndex];
    const questionType = currentQuestion.questionType || 'multiple-choice';

    // Validate that an answer is selected
    if (selectedAnswer === null || selectedAnswer === undefined) return;

    // For multi-select, ensure at least one answer is selected
    if (questionType === 'multi-select' && (!Array.isArray(selectedAnswer) || selectedAnswer.length === 0)) {
      return;
    }

    try {
      const response = await api.post(
        `/questions/${currentQuestion._id}/check`,
        { answer: selectedAnswer }
      );

      const answerResult = response.data.data || {};
      setShowResult(true);
      setAnswers((prev) => {
        const next = [...prev];
        next[currentQuestionIndex] = {
          ...answerResult,
          questionId: currentQuestion._id,
          answer: selectedAnswer,
        };
        return next;
      });

      if (answerResult.isCorrect) {
        setScore((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Error checking answer:', error);
      setShowResult(true);
      setAnswers((prev) => {
        const next = [...prev];
        next[currentQuestionIndex] = {
          questionId: currentQuestion._id,
          answer: selectedAnswer,
          isCorrect: false,
          correctAnswer: null,
          explanation: 'Error checking answer. Please try again.',
          questionType
        };
        return next;
      });
    }
  };

  const handleNextQuestion = async () => {
    const totalQuestions = examMode === 'pop' ? popQuestions.length : questions.length;
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null); // Reset to null for all question types
      setShowResult(false);
    } else {
      setExamComplete(true);
      setTimerActive(false);
      if (examMode === 'e-exam') {
        await submitExamResults();
      }
    }
  };

  const resetExam = () => {
    setSelectedCourse(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setAnswers([]);
    setPopAnswers({});
    setPopQuestions([]);
    setPopInstructions('');
    setPopLoading(false);
    setPopGradeResult(null);
    setPopReviewItems([]);
    setPopGrading(false);
    setExamMode(null);
    setShowModeSetup(false);
    setShowTimerSetup(false);
    setExamComplete(false);
    setQuestionSyncing(false);
    setExamStartError('');
    if (questionPollRef.current) {
      clearTimeout(questionPollRef.current);
      questionPollRef.current = null;
    }
  };

  const goToDashboardLeaderboard = () => {
    navigate('/dashboard');
  };

  const goToSelectedCourse = () => {
    if (!selectedCourse) return;
    navigate(`/course/${selectedCourse}`);
  };

  const goToQuestion = (index) => {
    const isPlaceholder = !isPopMode && index >= questions.length;
    if (isPlaceholder || index < 0 || index >= totalExamQuestions) return;
    setCurrentQuestionIndex(index);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const gradePopAnswers = async () => {
    setPopGrading(true);
    try {
      const reviewItems = examQuestions.flatMap((question) =>
        (question.parts || []).map((part) => {
          const key = `${question.number}${part.label}`;
          return {
            key,
            number: question.number,
            label: part.label,
            text: part.text,
            maxScore: part.marks,
            answer: popAnswers[key] || '',
          };
        })
      );
      const payload = reviewItems.map((item) => ({
        question: `Question ${item.number} (${item.label}) ${item.text}`,
        answer: item.answer,
        maxScore: item.maxScore,
      }));
      const response = await api.post('/questions/pop-grade', {
        answers: payload,
      });
      const graded = response.data.data;
      const items = Array.isArray(graded?.items) ? graded.items : [];
      const merged = reviewItems.map((item, idx) => ({
        ...item,
        score: items[idx]?.score ?? 0,
        feedback: items[idx]?.feedback || '',
        modelAnswer: items[idx]?.modelAnswer || '',
      }));
      setPopReviewItems(merged);
      setPopGradeResult(graded);
      return true;
    } catch (error) {
      console.error('POP grading error:', error);
      return false;
    } finally {
      setPopGrading(false);
    }
  };

  const examQuestions = examMode === 'pop' ? popQuestions : questions;

  if (loading) {
    return (
      <div className="np-shell tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
        <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
        <p className="tw:text-sm">Loading questions...</p>
      </div>
    );
  }

  if (examComplete) {
    const totalQuestions = examMode === 'e-exam' ? questions.length : examQuestions.length;
    const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    const popAnswerCount = Object.values(popAnswers).filter((value) => value && value.trim()).length;
    const popTotalScore = popGradeResult?.totalScore || 0;
    const popMaxTotal = popGradeResult?.maxTotal || 0;
    const popPercentage = popMaxTotal > 0 ? (popTotalScore / popMaxTotal) * 100 : 0;
    const hasPopFeedback = popGradeResult && popReviewItems.length > 0;

    return (
      <div className="np-shell">
        <ShellHeader title="Exam Results" />
        <div className="tw:space-y-4 tw:p-4">

        <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-6 tw:text-center">
          <span className="tw:flex tw:h-14 tw:w-14 tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
            <Award className="tw:h-7 tw:w-7" />
          </span>
          <h1 className="tw:font-heading tw:text-lg tw:font-bold">Exam Complete!</h1>

          {examMode === 'e-exam' ? (
            <>
              <div className="tw:mt-1 tw:flex tw:items-end tw:gap-1">
                <span className="tw:font-heading tw:text-4xl tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{score}</span>
                <span className="tw:pb-1 tw:text-sm tw:text-slate-400">/ {totalQuestions}</span>
              </div>
              <Badge variant={percentage >= 70 ? 'success' : 'warning'}>{percentage.toFixed(0)}% Score</Badge>
              <p className={cn('tw:mt-1 tw:text-sm tw:font-semibold', percentage >= 70 ? 'tw:text-emerald-600 tw:dark:text-emerald-400' : 'tw:text-amber-600 tw:dark:text-amber-400')}>
                {percentage >= 70 ? 'Great job! You passed!' : 'Keep practicing to improve!'}
              </p>
              {!isLoggedIn && (
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                  Sign in if you want future exam scores saved to the leaderboard.
                </p>
              )}
            </>
          ) : (
            <>
              {popGradeResult ? (
                <div className="tw:mt-1 tw:flex tw:items-end tw:gap-1">
                  <span className="tw:font-heading tw:text-4xl tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{popTotalScore.toFixed(1)}</span>
                  <span className="tw:pb-1 tw:text-sm tw:text-slate-400">/ {popMaxTotal} ({popPercentage.toFixed(0)}%)</span>
                </div>
              ) : (
                <div className="tw:mt-1 tw:flex tw:items-end tw:gap-1">
                  <span className="tw:font-heading tw:text-4xl tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{popAnswerCount}</span>
                  <span className="tw:pb-1 tw:text-sm tw:text-slate-400">/ {examQuestions.length} answered</span>
                </div>
              )}
              {!popGradeResult && (
                <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Submit for system grading to see your score.</p>
              )}
            </>
          )}
        </Card>

        {examMode === 'pop' && popGradeResult && (
          <Card className="tw:space-y-3 tw:p-5">
            <div className="tw:flex tw:items-center tw:justify-between">
              <h2 className="tw:font-heading tw:text-base tw:font-bold">Score Sheet</h2>
              <Badge variant={popPercentage >= 70 ? 'success' : 'warning'}>
                {popPercentage >= 70 ? 'Passed' : 'Needs Improvement'}
              </Badge>
            </div>
            <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:text-center">
              <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Total Score</p>
                <strong className="tw:font-heading tw:text-base">{popTotalScore.toFixed(1)} / {popMaxTotal}</strong>
              </div>
              <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Answered</p>
                <strong className="tw:font-heading tw:text-base">{popAnswerCount} parts</strong>
              </div>
            </div>

            {hasPopFeedback && (
              <div className="tw:space-y-3">
                <h3 className="tw:text-sm tw:font-bold">Feedback by Question</h3>
                {popReviewItems.map((item, index) => {
                  const isFullScore = item.score >= item.maxScore;
                  return (
                    <div key={`${item.key}-${index}`} className="tw:space-y-2 tw:rounded-xl tw:border tw:border-slate-200 tw:p-3.5 tw:dark:border-slate-800">
                      <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
                        <div>
                          <span className="tw:text-xs tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">Question {item.number} ({item.label})</span>
                          <p className="tw:mt-0.5 tw:text-sm">{item.text}</p>
                        </div>
                        <Badge variant={isFullScore ? 'success' : 'warning'} className="tw:flex-none">{item.score} / {item.maxScore}</Badge>
                      </div>
                      <div className="tw:space-y-1.5 tw:text-xs">
                        <div>
                          <p className="tw:font-semibold tw:text-slate-500 tw:dark:text-slate-400">Your Answer</p>
                          <p>{item.answer || 'No answer provided.'}</p>
                        </div>
                        <div>
                          <p className="tw:font-semibold tw:text-slate-500 tw:dark:text-slate-400">Feedback</p>
                          <p>{item.feedback || 'No feedback provided.'}</p>
                        </div>
                        <div>
                          <p className="tw:font-semibold tw:text-slate-500 tw:dark:text-slate-400">Model Answer</p>
                          <p>{item.modelAnswer || 'No model answer provided.'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {examMode === 'e-exam' && myRank && (
          <Card className="tw:space-y-3 tw:p-5">
            <h3 className="tw:font-heading tw:text-base tw:font-bold">Your Ranking</h3>
            <div className="tw:grid tw:grid-cols-3 tw:gap-2 tw:text-center">
              <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Rank</p>
                <strong className="tw:font-heading tw:text-base">#{myRank.rank}</strong>
              </div>
              <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Score</p>
                <strong className="tw:font-heading tw:text-base">{myRank.percentage.toFixed(1)}%</strong>
              </div>
              <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Time</p>
                <strong className="tw:font-heading tw:text-base">{Math.floor(myRank.timeTaken / 60)}m {myRank.timeTaken % 60}s</strong>
              </div>
            </div>
          </Card>
        )}

        {examMode === 'e-exam' && leaderboard.length > 0 && (
          <Card className="tw:space-y-3 tw:p-5">
            <h2 className="tw:font-heading tw:text-base tw:font-bold">🏆 Top 10 Leaderboard</h2>
            <div className="tw:space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry._id}
                  className={cn(
                    'tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:p-3',
                    myRank && entry.rank === myRank.rank ? 'tw:bg-brand-50 tw:dark:bg-brand-950/40' : 'tw:bg-slate-50 tw:dark:bg-slate-800/60',
                  )}
                >
                  <span className="tw:flex tw:h-7 tw:w-7 tw:flex-none tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-100 tw:text-xs tw:font-bold tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                    {entry.rank === 1 && '🥇'}
                    {entry.rank === 2 && '🥈'}
                    {entry.rank === 3 && '🥉'}
                    {entry.rank > 3 && `#${entry.rank}`}
                  </span>
                  <div className="tw:flex-1">
                    <strong className="tw:block tw:text-sm tw:font-semibold">{entry.studentName}</strong>
                    <small className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                      {entry.score}/{entry.totalQuestions} ({entry.percentage.toFixed(1)}%)
                    </small>
                  </div>
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-500 tw:dark:text-slate-400">
                    {Math.floor(entry.timeTaken / 60)}m {entry.timeTaken % 60}s
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="tw:space-y-2">
          <Button onClick={resetExam} className="tw:w-full">Take Another Exam</Button>
          <Button onClick={goToDashboardLeaderboard} variant="outline" className="tw:w-full">View Leaderboard</Button>
          <Button onClick={goToSelectedCourse} variant="outline" className="tw:w-full">Back to Course</Button>
          {examMode === 'pop' && !popGradeResult && (
            <Button onClick={gradePopAnswers} variant="secondary" disabled={popGrading} className="tw:w-full">
              {popGrading ? 'Grading...' : 'Grade POP Answers'}
            </Button>
          )}
        </div>
        </div>
      </div>
    );
  }

  if (!selectedCourse) {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Quiz",
      "name": "NOUN Practice Exams",
      "description": "Practice exams and quizzes for NOUN courses with instant feedback and scoring",
      "educationalLevel": "Higher Education",
      "learningResourceType": "Quiz"
    };

    return (
      <div className="np-shell">
        <SEO
          title="Practice Exams & Questions for NOUN Courses - NounPaddi"
          description="Test your knowledge with practice exams for all NOUN courses. Get instant feedback, track your progress, and prepare for your exams with confidence."
          url="/practice"
          keywords="NOUN practice questions, exam preparation, NOUN past questions, quiz Nigeria, test preparation, study questions NOUN"
          robots="index, follow"
          structuredData={structuredData}
        />
        <ShellHeader title="Practice Exam" />
        <div className="tw:space-y-4 tw:p-4">
        <p className="tw:-mt-2 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Select a course to start practicing</p>

        <div className="tw:space-y-2.5 tw:md:grid tw:md:grid-cols-2 tw:md:gap-2.5 tw:md:space-y-0 tw:lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course._id} interactive className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:p-4" onClick={() => selectCourseForExam(course._id)}>
              <div>
                <p className="tw:text-xs tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{course.courseCode}</p>
                <h3 className="tw:font-heading tw:text-sm tw:font-bold">{course.courseName}</h3>
              </div>
              <ChevronRight className="tw:h-4 tw:w-4 tw:flex-none tw:text-slate-300 tw:dark:text-slate-600" />
            </Card>
          ))}
        </div>
        </div>
      </div>
    );
  }

  if (showModeSetup && questions.length > 0) {
    return (
      <div className="np-shell">
        <SEO
          title="Select Exam Mode - NounPaddi"
          description="Choose between auto‑graded practice exams or POP handwritten style answers."
          url="/practice"
          robots="index, follow"
        />
        <ShellHeader title="Choose Exam Mode" />
        <div className="tw:space-y-4 tw:p-4">
        <p className="tw:-mt-2 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Select how you want to take this practice exam.</p>

        <div className="tw:space-y-3">
          <Card interactive className="tw:space-y-1 tw:p-4" onClick={() => selectExamMode('e-exam')}>
            <div className="tw:flex tw:items-center tw:justify-between">
              <h3 className="tw:font-heading tw:text-base tw:font-bold">E Exam</h3>
              <Badge variant="brand">Auto-graded</Badge>
            </div>
            <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Multiple choice, instant feedback, leaderboard scoring.</p>
          </Card>

          {isLoggedIn ? (
            <Card interactive className="tw:space-y-1 tw:p-4" onClick={() => selectExamMode('pop')}>
              <div className="tw:flex tw:items-center tw:justify-between">
                <h3 className="tw:font-heading tw:text-base tw:font-bold">POP Exam</h3>
                <Badge variant="info">Write answers</Badge>
              </div>
              <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Type your responses offhand. System grading after submit.</p>
            </Card>
          ) : (
            <Card className="tw:space-y-1 tw:p-4 tw:opacity-60">
              <div className="tw:flex tw:items-center tw:justify-between">
                <h3 className="tw:font-heading tw:text-base tw:font-bold">POP Exam</h3>
                <Badge variant="neutral">Sign in required</Badge>
              </div>
              <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Sign in to unlock handwritten POP practice, grading, and saved results.</p>
            </Card>
          )}
        </div>

        <Button onClick={resetExam} variant="outline" className="tw:w-full">Back to Courses</Button>
        </div>
      </div>
    );
  }

  // Timer Setup Screen
  if (showTimerSetup && questions.length > 0) {
    const timerOptions = [
      { value: 30, label: '30 Minutes', description: 'Quick practice' },
      { value: 60, label: '1 Hour', description: 'Standard exam' },
      { value: 90, label: '1.5 Hours', description: 'Extended practice' },
      { value: 120, label: '2 Hours', description: 'Full exam simulation' },
      { value: 180, label: '3 Hours', description: 'Comprehensive test' }
    ];

    return (
      <div className="np-shell">
        <SEO
          title="Set Exam Timer - NounPaddi"
          description="Configure your practice exam timer and start your test."
          url="/practice"
          robots="index, follow"
        />
        <ShellHeader title="Set Your Timer" />
        <div className="tw:space-y-4 tw:p-4">
        <p className="tw:-mt-2 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">
          Choose how long you want to practice. The timer counts down and auto-submits when time runs out.
        </p>

        <div className="tw:grid tw:grid-cols-2 tw:gap-2.5 tw:md:grid-cols-3">
          {timerOptions.map((option) => (
            <Card
              key={option.value}
              interactive
              className={cn(
                'tw:p-3.5',
                selectedDuration === option.value && 'tw:border-brand-500 tw:ring-1 tw:ring-brand-500',
              )}
              onClick={() => handleSelectDuration(option.value)}
            >
              <div className="tw:flex tw:items-center tw:justify-between">
                <strong className="tw:font-heading tw:text-sm tw:font-bold">{option.label}</strong>
                {selectedDuration === option.value && <CheckCircle2 className="tw:h-4 tw:w-4 tw:text-brand-600 tw:dark:text-brand-400" />}
              </div>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{option.description}</p>
            </Card>
          ))}
        </div>

        <Card className="tw:space-y-1 tw:p-4 tw:text-sm tw:text-slate-600 tw:dark:tw:text-slate-300">
          <p><strong>Several questions</strong> available for this exam</p>
          <p>Time per question: ~{Math.max(1, Math.floor((selectedDuration * 60) / Math.max(questions.length, 1)))} seconds</p>
          {!isLoggedIn && (
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
              You can practice publicly. Sign in if you want your score saved to the leaderboard.
            </p>
          )}
          {examStartError && (
            <p className="tw:text-xs tw:font-semibold tw:text-red-600 tw:dark:text-red-400">{examStartError}</p>
          )}
        </Card>

        <div ref={startExamButtonRef} className="tw:space-y-2">
          <Button onClick={startExamWithTimer} className="tw:w-full">Start Exam ({selectedDuration} min)</Button>
          <Button onClick={() => { setShowTimerSetup(false); setSelectedCourse(null); setQuestions([]); }} variant="outline" className="tw:w-full">
            Cancel
          </Button>
        </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="np-shell">
        <ShellHeader title="Practice Exam" />
        <div className="tw:p-4">
        <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
          <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">No practice questions available for this course yet.</p>
          <Button onClick={resetExam} variant="outline">Back to Courses</Button>
        </Card>
        </div>
      </div>
    );
  }

  if (examMode === 'pop' && popLoading) {
    return (
      <div className="np-shell tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
        <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
        <p className="tw:text-sm">Preparing POP paper...</p>
      </div>
    );
  }

  if (examMode === 'pop' && popQuestions.length === 0) {
    return (
      <div className="np-shell">
        <ShellHeader title="POP Exam" />
        <div className="tw:p-4">
        <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
          <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">No POP questions available for this course yet.</p>
          <Button onClick={resetExam} variant="outline">Back to Courses</Button>
        </Card>
        </div>
      </div>
    );
  }

  const isPopMode = examMode === 'pop';
  const totalExamQuestions = isPopMode ? popQuestions.length : questions.length;
  const currentQuestion = isPopMode ? examQuestions[currentQuestionIndex] : questions[currentQuestionIndex];
  const hasCurrentQuestion = isPopMode ? !!currentQuestion : currentQuestionIndex < questions.length;
  const questionType = !isPopMode && hasCurrentQuestion ? (currentQuestion.questionType || 'multiple-choice') : null;
  const popParts = isPopMode && currentQuestion ? (currentQuestion.parts || []) : [];

  // Helper to check if an option is selected (works for both single and multi-select)
  const isOptionSelected = (index) => {
    if (questionType === 'multi-select') {
      return Array.isArray(selectedAnswer) && selectedAnswer.includes(index);
    }
    return selectedAnswer === index;
  };

  // Helper to check if an option is correct (works for both single and multi-select)
  const isOptionCorrect = (index) => {
    if (!showResult) return false;
    const correctAnswer = answers[currentQuestionIndex]?.correctAnswer;
    if (Array.isArray(correctAnswer)) {
      return correctAnswer.includes(index);
    }
    return correctAnswer === index;
  };

  // Helper to check if an option is incorrect (was selected but wrong)
  const isOptionIncorrect = (index) => {
    if (!showResult) return false;
    const correctAnswer = answers[currentQuestionIndex]?.correctAnswer;
    const wasSelected = questionType === 'multi-select'
      ? Array.isArray(selectedAnswer) && selectedAnswer.includes(index)
      : selectedAnswer === index;

    if (Array.isArray(correctAnswer)) {
      return wasSelected && !correctAnswer.includes(index);
    }
    return wasSelected && correctAnswer !== index;
  };

  // Calculate time warning (last 10% of time)
  const timeWarning = timeRemaining !== null && timeRemaining < (selectedDuration * 60 * 0.1);
  const timeCritical = timeRemaining !== null && timeRemaining < (selectedDuration * 60 * 0.05);
  const popHasAnswerForQuestion = (question) => {
    if (!question || !Array.isArray(question.parts)) return false;
    return question.parts.some((part) => {
      const key = `${question.number}${part.label}`;
      return popAnswers[key] && popAnswers[key].trim();
    });
  };

  return (
    <div className="np-shell">
      <ShellHeader title={isPopMode ? 'POP Exam' : 'E Exam'} />
      <div className="tw:space-y-3 tw:p-4">

      <Card className="tw:space-y-2.5 tw:p-4">
        <div className="tw:flex tw:items-center tw:justify-between tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:text-slate-300">
          <span>Question {currentQuestionIndex + 1} of {totalExamQuestions}</span>
          {isPopMode ? (
            <Badge variant="info">POP Mode</Badge>
          ) : (
            <span>Score: {score}/{currentQuestionIndex}</span>
          )}
        </div>
        {!isPopMode && questionSyncing && (
          <p className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:text-amber-600 tw:dark:text-amber-400">
            <Loader2 className="tw:h-3.5 tw:w-3.5 tw:animate-spin" /> Generating remaining questions...
          </p>
        )}
        {timerActive && timeRemaining !== null && (
          <div className={cn(
            'tw:flex tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-xl tw:py-2 tw:text-sm tw:font-bold',
            timeCritical
              ? 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300'
              : timeWarning
              ? 'tw:bg-amber-100 tw:text-amber-700 tw:dark:bg-amber-500/15 tw:dark:text-amber-300'
              : 'tw:bg-slate-50 tw:text-slate-700 tw:dark:bg-slate-800/60 tw:dark:text-slate-300',
          )}
          >
            <Clock className="tw:h-4 tw:w-4" /> {formatTime(timeRemaining)}
          </div>
        )}
        <div className="tw:h-1.5 tw:overflow-hidden tw:rounded-full tw:bg-slate-100 tw:dark:bg-slate-800">
          <div
            className="tw:h-full tw:rounded-full tw:bg-brand-500 tw:transition-all"
            style={{ width: `${((currentQuestionIndex + 1) / totalExamQuestions) * 100}%` }}
          />
        </div>
      </Card>

      <div className="tw:flex tw:gap-1.5 tw:overflow-x-auto tw:pb-1">
        {Array.from({ length: totalExamQuestions }).map((_, index) => {
          const isActive = index === currentQuestionIndex;
          const isAnswered = isPopMode
            ? popHasAnswerForQuestion(examQuestions[index])
            : !!answers[index];
          const isPlaceholder = !isPopMode && index >= questions.length;
          return (
            <button
              key={index}
              type="button"
              onClick={() => goToQuestion(index)}
              disabled={isPlaceholder}
              className={cn(
                'tw:flex tw:h-8 tw:w-8 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:text-xs tw:font-bold tw:transition-colors',
                isActive
                  ? 'tw:bg-brand-600 tw:text-white'
                  : isAnswered
                  ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                  : isPlaceholder
                  ? 'tw:bg-slate-50 tw:text-slate-300 tw:dark:bg-slate-800/40 tw:dark:text-slate-600'
                  : 'tw:bg-slate-100 tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300',
              )}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="tw:space-y-4 tw:p-4">
          {isPopMode && popInstructions && (
            <p className="tw:rounded-xl tw:bg-brand-50 tw:p-3 tw:text-xs tw:text-brand-700 tw:dark:bg-brand-950/40 tw:dark:text-brand-300">
              <strong>Instruction:</strong> {popInstructions}
            </p>
          )}

          {isPopMode ? (
            <div className="tw:text-xs tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">QUESTION {currentQuestion.number}</div>
          ) : !hasCurrentQuestion ? (
            <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-6 tw:text-center">
              <Loader2 className="tw:h-5 tw:w-5 tw:animate-spin tw:text-slate-400" />
              <h3 className="tw:font-heading tw:text-sm tw:font-bold">Generating question {currentQuestionIndex + 1}...</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">We are preparing the remaining questions. This slot will unlock soon.</p>
            </div>
          ) : (
            <h2 className="tw:font-heading tw:text-base tw:font-bold">{currentQuestion.questionText}</h2>
          )}

          {questionType === 'multi-select' && !isPopMode && (
            <p className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
              <CheckCircle2 className="tw:h-3.5 tw:w-3.5" /> Select all correct answers (you can choose more than one)
            </p>
          )}
          {isPopMode && (
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
              Type your response for each part. You can move between questions anytime.
            </p>
          )}

          {isPopMode ? (
            <div className="tw:space-y-3">
              {popParts.map((part) => {
                const key = `${currentQuestion.number}${part.label}`;
                return (
                  <div key={key} className="tw:space-y-1.5">
                    <div className="tw:flex tw:items-start tw:justify-between tw:gap-2 tw:text-sm">
                      <span><strong>({part.label})</strong> {part.text}</span>
                      <Badge variant="neutral" className="tw:flex-none">{part.marks} marks</Badge>
                    </div>
                    <textarea
                      value={popAnswers[key] || ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setPopAnswers((prev) => ({
                          ...prev,
                          [key]: value,
                        }));
                      }}
                      placeholder={`Answer for (${part.label})`}
                      rows={4}
                      className="tw:w-full tw:resize-none tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100"
                    />
                  </div>
                );
              })}
            </div>
          ) : hasCurrentQuestion ? (
            <>
              <div className="tw:space-y-2">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => !showResult && handleAnswerSelect(index)}
                    disabled={showResult}
                    className={cn(
                      'tw:flex tw:w-full tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:p-3 tw:text-left tw:text-sm tw:transition-colors',
                      showResult && isOptionCorrect(index)
                        ? 'tw:border-emerald-500 tw:bg-emerald-50 tw:dark:bg-emerald-950/40'
                        : showResult && isOptionIncorrect(index)
                        ? 'tw:border-red-500 tw:bg-red-50 tw:dark:bg-red-500/10'
                        : isOptionSelected(index)
                        ? 'tw:border-brand-500 tw:bg-brand-50 tw:dark:bg-brand-950/40'
                        : 'tw:border-slate-200 tw:dark:border-slate-800',
                    )}
                  >
                    {questionType === 'multi-select' ? (
                      <span className={cn(
                        'tw:flex tw:h-6 tw:w-6 tw:flex-none tw:items-center tw:justify-center tw:rounded-md tw:border-2',
                        isOptionSelected(index) ? 'tw:border-brand-600 tw:bg-brand-600' : 'tw:border-slate-300 tw:dark:border-slate-600',
                      )}
                      >
                        {isOptionSelected(index) && <CheckCircle2 className="tw:h-4 tw:w-4 tw:text-white" />}
                      </span>
                    ) : (
                      <span className={cn(
                        'tw:flex tw:h-6 tw:w-6 tw:flex-none tw:items-center tw:justify-center tw:rounded-full tw:text-xs tw:font-bold',
                        isOptionSelected(index) ? 'tw:bg-brand-600 tw:text-white' : 'tw:bg-slate-100 tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300',
                      )}
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                    )}
                    <span className="tw:flex-1">{option}</span>
                    {showResult && isOptionCorrect(index) && <CheckCircle2 className="tw:h-4 tw:w-4 tw:flex-none tw:text-emerald-600 tw:dark:text-emerald-400" />}
                    {showResult && isOptionIncorrect(index) && <XCircle className="tw:h-4 tw:w-4 tw:flex-none tw:text-red-600 tw:dark:text-red-400" />}
                  </button>
                ))}
              </div>

              {showResult && (
                <div
                  className={cn(
                    'tw:flex tw:items-start tw:gap-2 tw:rounded-xl tw:p-3 tw:text-sm',
                    answers[currentQuestionIndex]?.isCorrect
                      ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                      : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
                  )}
                >
                  {answers[currentQuestionIndex]?.isCorrect ? (
                    <><CheckCircle2 className="tw:h-4 tw:w-4 tw:flex-none" /> Correct! Well done!</>
                  ) : (
                    <><XCircle className="tw:h-4 tw:w-4 tw:flex-none" /> {answers[currentQuestionIndex]?.explanation}</>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-6 tw:text-center">
              <Loader2 className="tw:h-5 tw:w-5 tw:animate-spin tw:text-slate-400" />
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Hang tight while we generate this question.</p>
            </div>
          )}

          <div className="tw:space-y-2">
            {isPopMode ? (
              <>
                <Button onClick={handleNextQuestion} className="tw:w-full">
                  {currentQuestionIndex < examQuestions.length - 1 ? 'Save & Next' : 'Finish Exam'}
                </Button>
                {currentQuestionIndex === examQuestions.length - 1 && (
                  <Button
                    onClick={async () => {
                      const ok = await gradePopAnswers();
                      if (ok) setExamComplete(true);
                    }}
                    variant="secondary"
                    disabled={popGrading}
                    className="tw:w-full"
                  >
                    {popGrading ? 'Grading...' : 'Finish & Grade'}
                  </Button>
                )}
              </>
            ) : (
              <>
                {!showResult ? (
                  <Button
                    onClick={handleSubmitAnswer}
                    className="tw:w-full"
                    disabled={
                      !hasCurrentQuestion ||
                      selectedAnswer === null ||
                      selectedAnswer === undefined ||
                      (questionType === 'multi-select' && (!Array.isArray(selectedAnswer) || selectedAnswer.length === 0))
                    }
                  >
                    Submit Answer
                  </Button>
                ) : (
                  <Button onClick={handleNextQuestion} className="tw:w-full">
                    {currentQuestionIndex < totalExamQuestions - 1 ? 'Next Question' : 'Finish Exam'}
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Practice;
