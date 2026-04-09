import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import SEO from '../components/SEO';
import { convertHalfToTrueFalse } from '../utils/questionTransformer';
import { trackFeatureVisit } from '../utils/featureTracking';
import { FiCheckCircle, FiXCircle, FiAward } from 'react-icons/fi';
import './Practice.css';

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

  const examQuestions = examMode === 'pop' ? popQuestions : questions;

  if (loading) {
    return (
      <div className="practice-container">
        <div className="container">
          <div className="spinner"></div>
        </div>
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
      <div className="practice-container">
        <div className="container">
          <div className={`exam-results ${examMode === 'pop' ? 'exam-results-pop' : ''}`}>
            <FiAward size={64} className="result-icon" />
            <h1>Exam Complete!</h1>
            {examMode === 'e-exam' ? (
              <>
                <div className="score-display">
                  <span className="score-number">{score}</span>
                  <span className="score-total">/ {totalQuestions}</span>
                </div>
                <div className="percentage-display">
                  {percentage.toFixed(0)}% Score
                </div>
                <div className="result-message">
                  {percentage >= 70 ? (
                    <p className="text-success">Great job! You passed!</p>
                  ) : (
                    <p className="text-warning">Keep practicing to improve!</p>
                  )}
                  {!isLoggedIn && (
                    <p className="public-practice-note">
                      Sign in if you want future exam scores saved to the leaderboard.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                {popGradeResult ? (
                  <>
                    <div className="pop-score-sheet">
                      <div className="pop-score-header">
                        <div>
                          <h2>POP Exam Score Sheet</h2>
                          <p>System‑graded summary with feedback and model answers.</p>
                        </div>
                        <div className="pop-score-chip">
                          {popPercentage.toFixed(0)}%
                        </div>
                      </div>
                      <div className="pop-score-metrics">
                        <div className="pop-metric">
                          <span>Total Score</span>
                          <strong>{popTotalScore.toFixed(1)} / {popMaxTotal}</strong>
                        </div>
                        <div className="pop-metric">
                          <span>Answered</span>
                          <strong>{popAnswerCount} parts</strong>
                        </div>
                        <div className="pop-metric">
                          <span>Status</span>
                          <strong>{popPercentage >= 70 ? 'Passed' : 'Needs Improvement'}</strong>
                        </div>
                      </div>
                    </div>

                    {hasPopFeedback && (
                      <div className="pop-feedback">
                        <h3>Feedback by Question</h3>
                        <div className="pop-feedback-list">
                          {popReviewItems.map((item, index) => {
                            const isFullScore = item.score >= item.maxScore;
                            return (
                              <div key={`${item.key}-${index}`} className="pop-feedback-card">
                                <div className="pop-feedback-header">
                                  <div>
                                    <span className="pop-question-label">
                                      Question {item.number} ({item.label})
                                    </span>
                                    <p>{item.text}</p>
                                  </div>
                                  <span className={`pop-score-pill ${isFullScore ? 'success' : 'warning'}`}>
                                    {item.score} / {item.maxScore}
                                  </span>
                                </div>
                                <div className="pop-feedback-body">
                                  <div>
                                    <h4>Your Answer</h4>
                                    <p>{item.answer || 'No answer provided.'}</p>
                                  </div>
                                  <div>
                                    <h4>Feedback</h4>
                                    <p>{item.feedback || 'No feedback provided.'}</p>
                                  </div>
                                  <div>
                                    <h4>Model Answer</h4>
                                    <p>{item.modelAnswer || 'No model answer provided.'}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="score-display">
                      <span className="score-number">{popAnswerCount}</span>
                      <span className="score-total">/ {examQuestions.length}</span>
                    </div>
                    <div className="percentage-display">
                      Answers Drafted
                    </div>
                    <div className="result-message">
                      <p className="text-secondary">Submit for system grading to see your score.</p>
                    </div>
                  </>
                )}
              </>
            )}

            {/* My Rank */}
            {examMode === 'e-exam' && myRank && (
              <div className="my-rank-card">
                <h3>Your Ranking</h3>
                <div className="rank-details">
                  <div className="rank-item">
                    <span className="rank-label">Rank</span>
                    <span className="rank-value">#{myRank.rank}</span>
                  </div>
                  <div className="rank-item">
                    <span className="rank-label">Score</span>
                    <span className="rank-value">{myRank.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="rank-item">
                    <span className="rank-label">Time</span>
                    <span className="rank-value">{Math.floor(myRank.timeTaken / 60)}m {myRank.timeTaken % 60}s</span>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {examMode === 'e-exam' && leaderboard.length > 0 && (
              <div className="leaderboard-section">
                <h2>🏆 Top 10 Leaderboard</h2>
                <div className="leaderboard-table">
                  <div className="leaderboard-header">
                    <div className="rank-col">Rank</div>
                    <div className="name-col">Student</div>
                    <div className="score-col">Score</div>
                    <div className="time-col">Time</div>
                  </div>
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry._id}
                      className={`leaderboard-row ${entry.rank <= 3 ? 'top-rank' : ''} ${myRank && entry.rank === myRank.rank ? 'my-rank-row' : ''}`}
                    >
                      <div className="rank-col">
                        {entry.rank === 1 && '🥇'}
                        {entry.rank === 2 && '🥈'}
                        {entry.rank === 3 && '🥉'}
                        {entry.rank > 3 && `#${entry.rank}`}
                      </div>
                      <div className="name-col">{entry.studentName}</div>
                      <div className="score-col">
                        {entry.score}/{entry.totalQuestions} ({entry.percentage.toFixed(1)}%)
                      </div>
                      <div className="time-col">
                        {Math.floor(entry.timeTaken / 60)}m {entry.timeTaken % 60}s
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="exam-actions">
              <button onClick={resetExam} className="btn btn-primary">
                Take Another Exam
              </button>
              <button onClick={goToDashboardLeaderboard} className="btn btn-secondary">
                View Leaderboard
              </button>
              <button onClick={goToSelectedCourse} className="btn btn-secondary">
                Back to Course
              </button>
              {examMode === 'pop' && !popGradeResult && (
                <button
                  onClick={async () => {
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
                    } catch (error) {
                      console.error('POP grading error:', error);
                    } finally {
                      setPopGrading(false);
                    }
                  }}
                  className="btn btn-secondary"
                  disabled={popGrading}
                >
                  {popGrading ? 'Grading...' : 'Grade POP Answers'}
                </button>
              )}
            </div>
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
      <div className="practice-container">
        <SEO
          title="Practice Exams & Questions for NOUN Courses - NounPaddi"
          description="Test your knowledge with practice exams for all NOUN courses. Get instant feedback, track your progress, and prepare for your exams with confidence."
          url="/practice"
          keywords="NOUN practice questions, exam preparation, NOUN past questions, quiz Nigeria, test preparation, study questions NOUN"
          robots="index, follow"
          structuredData={structuredData}
        />
        <div className="container">
          <div className="practice-header">
            <h1>Practice Exam</h1>
            <p>Select a course to start practicing</p>
          </div>

          <div className="grid grid-3">
            {courses.map((course) => (
              <div key={course._id} className="practice-course-card">
                <h3>{course.courseCode}</h3>
                <p>{course.courseName}</p>
                <button
                  onClick={() => selectCourseForExam(course._id)}
                  className="btn btn-primary"
                >
                  Start Practice
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showModeSetup && questions.length > 0) {
    return (
      <div className="practice-container">
        <SEO
          title="Select Exam Mode - NounPaddi"
          description="Choose between auto‑graded practice exams or POP handwritten style answers."
          url="/practice"
          robots="index, follow"
        />
        <div className="container">
          <div className="timer-setup-card">
            <div className="timer-setup-header">
              <h1>Choose Exam Mode</h1>
              <p>Select how you want to take this practice exam.</p>
            </div>
            <div className="exam-mode-grid">
              <button
                className="exam-mode-card"
                onClick={() => selectExamMode('e-exam')}
              >
                <div className="exam-mode-title">E Exam</div>
                <div className="exam-mode-tag">Auto‑graded</div>
                <p>Multiple choice, instant feedback, leaderboard scoring.</p>
              </button>
              {isLoggedIn ? (
                <button
                  className="exam-mode-card"
                  onClick={() => selectExamMode('pop')}
                >
                  <div className="exam-mode-title">POP Exam</div>
                  <div className="exam-mode-tag">Write answers</div>
                  <p>Type your responses offhand. System grading after submit.</p>
                </button>
              ) : (
                <div className="exam-mode-card disabled">
                  <div className="exam-mode-title">POP Exam</div>
                  <div className="exam-mode-tag">Sign in required</div>
                  <p>Sign in to unlock handwritten POP practice, grading, and saved results.</p>
                </div>
              )}
            </div>
            <div className="timer-setup-actions">
              <button onClick={resetExam} className="btn btn-secondary">
                Back to Courses
              </button>
            </div>
          </div>
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
      <div className="practice-container">
        <SEO
          title="Set Exam Timer - NounPaddi"
          description="Configure your practice exam timer and start your test."
          url="/practice"
          robots="index, follow"
        />
        <div className="container">
          <div className="timer-setup-card">
            <div className="timer-setup-header">
              <h1>⏱️ Set Your Exam Timer</h1>
              <p>Choose how long you want to practice. The timer will count down and auto-submit when time runs out.</p>
            </div>

            <div className="timer-options-grid">
              {timerOptions.map((option) => (
                <div
                  key={option.value}
                  className={`timer-option-card ${selectedDuration === option.value ? 'selected' : ''}`}
                  onClick={() => handleSelectDuration(option.value)}
                >
                  <div className="timer-option-value">{option.label}</div>
                  <div className="timer-option-desc">{option.description}</div>
                  {selectedDuration === option.value && (
                    <div className="timer-option-check">✓</div>
                  )}
                </div>
              ))}
            </div>

            <div className="timer-setup-info">
              <p><strong>Several questions</strong> available for this exam</p>
              <p>Time per question: ~{Math.max(1, Math.floor((selectedDuration * 60) / Math.max(questions.length, 1)))} seconds</p>
              {!isLoggedIn && (
                <p className="timer-setup-note">
                  You can practice publicly. Sign in if you want your score saved to the leaderboard.
                </p>
              )}
              {examStartError && (
                <p className="timer-setup-error">{examStartError}</p>
              )}
            </div>

            <div className="timer-setup-actions" ref={startExamButtonRef}>
              <button onClick={() => { setShowTimerSetup(false); setSelectedCourse(null); setQuestions([]); }} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={startExamWithTimer} className="btn btn-primary btn-lg">
                Start Exam ({selectedDuration} min)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="practice-container">
        <div className="container">
          <div className="no-questions">
            <p>No practice questions available for this course yet.</p>
            <button onClick={resetExam} className="btn btn-secondary">
              Back to Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (examMode === 'pop' && popLoading) {
    return (
      <div className="practice-container">
        <div className="container">
          <div className="spinner"></div>
          <p className="loading-text">Preparing POP paper...</p>
        </div>
      </div>
    );
  }

  if (examMode === 'pop' && popQuestions.length === 0) {
    return (
      <div className="practice-container">
        <div className="container">
          <div className="no-questions">
            <p>No POP questions available for this course yet.</p>
            <button onClick={resetExam} className="btn btn-secondary">
              Back to Courses
            </button>
          </div>
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
    <div className="practice-container">
      <div className="container">
        <div className="exam-header">
          <div className="exam-progress">
            <span>Question {currentQuestionIndex + 1} of {totalExamQuestions}</span>
            {isPopMode ? (
              <span>POP Mode</span>
            ) : (
              <span>Score: {score}/{currentQuestionIndex}</span>
            )}
          </div>
          {!isPopMode && questionSyncing && (
            <div className="question-sync-status">
              Generating remaining questions...
            </div>
          )}
          {timerActive && timeRemaining !== null && (
            <div className={`exam-timer ${timeWarning ? 'warning' : ''} ${timeCritical ? 'critical' : ''}`}>
              <span className="timer-label">⏱️ Time Remaining:</span>
              <span className="timer-value">{formatTime(timeRemaining)}</span>
            </div>
          )}
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((currentQuestionIndex + 1) / totalExamQuestions) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="exam-layout">
          <div className="question-nav">
            <div className="question-nav-title">Questions</div>
            <div className="question-nav-list">
              {Array.from({ length: totalExamQuestions }).map((_, index) => {
                const isActive = index === currentQuestionIndex;
                const isAnswered = isPopMode
                  ? popHasAnswerForQuestion(examQuestions[index])
                  : !!answers[index];
                const isPlaceholder = !isPopMode && index >= questions.length;
                return (
                  <button
                    key={index}
                    className={`question-nav-item ${isActive ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${isPlaceholder ? 'placeholder' : ''}`}
                    onClick={() => goToQuestion(index)}
                    disabled={isPlaceholder}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="question-card">
            <div className="question-toolbar">
              <div className="current-question-indicator">
                <span className="current-question-label">Current Question</span>
                <strong className="current-question-value">
                  {isPopMode && currentQuestion?.number ? `Question ${currentQuestion.number}` : `Question ${currentQuestionIndex + 1}`}
                </strong>
              </div>
              <label className="jump-question-control">
                <span>Jump to question</span>
                <select
                  value={currentQuestionIndex}
                  onChange={(event) => goToQuestion(Number(event.target.value))}
                >
                  {Array.from({ length: totalExamQuestions }).map((_, index) => {
                    const isPlaceholder = !isPopMode && index >= questions.length;
                    const isAnswered = isPopMode
                      ? popHasAnswerForQuestion(examQuestions[index])
                      : !!answers[index];
                    const status = isPlaceholder ? 'Generating' : isAnswered ? 'Answered' : 'Pending';
                    return (
                      <option key={index} value={index} disabled={isPlaceholder}>
                        {`Question ${index + 1} - ${status}`}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            <div className="question-header">
              {isPopMode && popInstructions && (
                <div className="pop-instructions">
                  <span className="pop-instructions-label">Instruction:</span>
                  <span className="pop-instructions-text">{popInstructions}</span>
                </div>
              )}
              {isPopMode ? (
                <div className="pop-question-title">QUESTION {currentQuestion.number}</div>
              ) : !hasCurrentQuestion ? (
                <div className="question-placeholder">
                  <div className="question-placeholder-title">Generating question {currentQuestionIndex + 1}...</div>
                  <p>We are preparing the remaining questions. This slot will unlock soon.</p>
                </div>
              ) : (
                <h2 className="question-text">{currentQuestion.questionText}</h2>
              )}
              {questionType === 'multi-select' && !isPopMode && (
                <div className="multi-select-hint">
                  <FiCheckCircle size={16} />
                  <span>Select all correct answers (you can choose more than one)</span>
                </div>
              )}
              {isPopMode && (
                <div className="pop-hint">
                  Type your response for each part. You can move between questions anytime.
                </div>
              )}
            </div>

            {isPopMode ? (
              <div className="pop-paper">
                {popParts.map((part) => {
                  const key = `${currentQuestion.number}${part.label}`;
                  return (
                    <div key={key} className="pop-part">
                      <div className="pop-part-row">
                        <div className="pop-part-label">({part.label})</div>
                        <div className="pop-part-text">{part.text}</div>
                        <div className="pop-part-marks">{part.marks} marks</div>
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
                      />
                    </div>
                  );
                })}
              </div>
            ) : hasCurrentQuestion ? (
              <>
                <div className="options-list">
                  {currentQuestion.options.map((option, index) => (
                    <button
                      key={index}
                      className={`option-button ${isOptionSelected(index) ? 'selected' : ''} ${
                        showResult
                          ? isOptionCorrect(index)
                            ? 'correct'
                            : isOptionIncorrect(index)
                            ? 'incorrect'
                            : ''
                          : ''
                      }`}
                      onClick={() => !showResult && handleAnswerSelect(index)}
                      disabled={showResult}
                    >
                      {questionType === 'multi-select' ? (
                        <span style={{
                          width: '24px',
                          height: '24px',
                          border: '2px solid var(--border-color)',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isOptionSelected(index) ? 'var(--primary-color)' : 'transparent',
                          flexShrink: 0
                        }}>
                          {isOptionSelected(index) && <FiCheckCircle color="white" size={16} />}
                        </span>
                      ) : (
                        <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                      )}
                      <span className="option-text">{option}</span>
                      {showResult && isOptionCorrect(index) && (
                        <FiCheckCircle className="option-icon correct-icon" />
                      )}
                      {showResult && isOptionIncorrect(index) && (
                        <FiXCircle className="option-icon incorrect-icon" />
                      )}
                    </button>
                  ))}
                </div>

                {showResult && (
                  <div className={`result-feedback ${answers[currentQuestionIndex]?.isCorrect ? 'correct' : 'incorrect'}`}>
                    {answers[currentQuestionIndex]?.isCorrect ? (
                      <p><FiCheckCircle /> Correct! Well done!</p>
                    ) : (
                      <p><FiXCircle /> {answers[currentQuestionIndex]?.explanation}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="question-placeholder-body">
                <div className="spinner small"></div>
                <p>Hang tight while we generate this question.</p>
              </div>
            )}

            <div className="question-actions">
              {isPopMode ? (
                <>
                  <button onClick={handleNextQuestion} className="btn btn-primary">
                    {currentQuestionIndex < examQuestions.length - 1 ? 'Save & Next' : 'Finish Exam'}
                  </button>
                  {currentQuestionIndex === examQuestions.length - 1 && (
                    <button
                      onClick={async () => {
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
                          setExamComplete(true);
                        } catch (error) {
                          console.error('POP grading error:', error);
                        } finally {
                          setPopGrading(false);
                        }
                      }}
                      className="btn btn-secondary"
                      disabled={popGrading}
                    >
                      {popGrading ? 'Grading...' : 'Finish & Grade'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  {!showResult ? (
                    <button
                      onClick={handleSubmitAnswer}
                      className="btn btn-primary"
                      disabled={
                        !hasCurrentQuestion ||
                        selectedAnswer === null ||
                        selectedAnswer === undefined ||
                        (questionType === 'multi-select' && (!Array.isArray(selectedAnswer) || selectedAnswer.length === 0))
                      }
                    >
                      Submit Answer
                    </button>
                  ) : (
                    <button onClick={handleNextQuestion} className="btn btn-primary">
                      {currentQuestionIndex < totalExamQuestions - 1 ? 'Next Question' : 'Finish Exam'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Practice;
