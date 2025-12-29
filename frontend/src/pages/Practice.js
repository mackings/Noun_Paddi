import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import SEO from '../components/SEO';
import { convertHalfToTrueFalse } from '../utils/questionTransformer';
import { FiCheckCircle, FiXCircle, FiAward } from 'react-icons/fi';
import './Practice.css';

const Practice = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null); // Single answer (number) or array of numbers
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [examComplete, setExamComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  // Timer states
  const [showTimerSetup, setShowTimerSetup] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(60); // in minutes
  const [timeRemaining, setTimeRemaining] = useState(null); // in seconds
  const [timerActive, setTimerActive] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);

  // Leaderboard states
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  // Timer countdown effect
  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
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
  }, [timerActive, timeRemaining]);

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
      const response = await api.get(`/questions/course/${courseId}`);

      // Convert 50% to True/False, keep rest as single-answer
      const transformedQuestions = convertHalfToTrueFalse(response.data.data);

      setQuestions(transformedQuestions);
      setSelectedCourse(courseId);
      setShowTimerSetup(true);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setLoading(false);
    }
  };

  const startExamWithTimer = () => {
    const durationInSeconds = selectedDuration * 60;
    setTimeRemaining(durationInSeconds);
    setTimerActive(true);
    setStartTime(Date.now());
    setEndTime(Date.now() + durationInSeconds * 1000);
    setShowTimerSetup(false);
    setCurrentQuestionIndex(0);
    setScore(0);
    setAnswers([]);
    setExamComplete(false);
  };

  const handleTimeUp = async () => {
    // Auto-complete the exam when time runs out
    setExamComplete(true);
    setTimerActive(false);
    await submitExamResults();
  };

  const submitExamResults = async () => {
    try {
      const timeTaken = selectedDuration * 60 - (timeRemaining || 0); // Actual time taken in seconds

      // Submit to leaderboard
      await api.post('/leaderboard/submit', {
        courseId: selectedCourse,
        score,
        totalQuestions: questions.length,
        duration: selectedDuration * 60,
        timeTaken,
        answers: answers.map(a => ({
          questionId: a.questionId,
          answer: a.answer,
          isCorrect: a.isCorrect
        }))
      });

      // Fetch leaderboard and rank
      await fetchLeaderboard();
    } catch (error) {
      console.error('Error submitting exam results:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const [leaderboardRes, rankRes] = await Promise.all([
        api.get(`/leaderboard/course/${selectedCourse}?limit=10`),
        api.get(`/leaderboard/my-rank/${selectedCourse}`)
      ]);

      setLeaderboard(leaderboardRes.data.data);
      setMyRank(rankRes.data.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

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
    const currentQuestion = questions[currentQuestionIndex];
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
    const currentQuestion = questions[currentQuestionIndex];
    const questionType = currentQuestion.questionType || 'multiple-choice';

    // Validate that an answer is selected
    if (selectedAnswer === null || selectedAnswer === undefined) return;

    // For multi-select, ensure at least one answer is selected
    if (questionType === 'multi-select' && (!Array.isArray(selectedAnswer) || selectedAnswer.length === 0)) {
      return;
    }

    try {
      // Check if this is a client-side checkable question (has correctAnswer field)
      const hasCorrectAnswer = currentQuestion.correctAnswer !== undefined && currentQuestion.correctAnswer !== null;

      if (hasCorrectAnswer) {
        // Client-side checking for transformed questions
        let isCorrect = false;

        if (questionType === 'multi-select') {
          // For multi-select, check if arrays match
          const correctAnswer = Array.isArray(currentQuestion.correctAnswer)
            ? currentQuestion.correctAnswer
            : [currentQuestion.correctAnswer];
          const userAnswer = Array.isArray(selectedAnswer) ? selectedAnswer : [selectedAnswer];

          // Arrays must have same length and same elements
          isCorrect =
            correctAnswer.length === userAnswer.length &&
            correctAnswer.every(ans => userAnswer.includes(ans));
        } else if (questionType === 'true-false') {
          // For true/false, simple equality check
          isCorrect = currentQuestion.correctAnswer === selectedAnswer;
        } else {
          // For multiple-choice, simple equality check
          isCorrect = currentQuestion.correctAnswer === selectedAnswer;
        }

        setShowResult(true);
        setAnswers([...answers, {
          isCorrect,
          correctAnswer: currentQuestion.correctAnswer,
          explanation: currentQuestion.explanation || (isCorrect ? 'Correct!' : 'Incorrect.'),
          questionType
        }]);

        if (isCorrect) {
          setScore(score + 1);
        }
      } else {
        // Backend API check for original questions without correctAnswer
        const response = await api.post(
          `/questions/${currentQuestion._id}/check`,
          { answer: selectedAnswer }
        );

        setShowResult(true);
        setAnswers([...answers, response.data.data]);

        if (response.data.data.isCorrect) {
          setScore(score + 1);
        }
      }
    } catch (error) {
      console.error('Error checking answer:', error);
      setShowResult(true);
      setAnswers([...answers, {
        isCorrect: false,
        correctAnswer: null,
        explanation: 'Error checking answer. Please try again.',
        questionType
      }]);
    }
  };

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null); // Reset to null for all question types
      setShowResult(false);
    } else {
      setExamComplete(true);
      setTimerActive(false);
      await submitExamResults();
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
    setExamComplete(false);
  };

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
    const percentage = (score / questions.length) * 100;
    return (
      <div className="practice-container">
        <div className="container">
          <div className="exam-results">
            <FiAward size={64} className="result-icon" />
            <h1>Exam Complete!</h1>
            <div className="score-display">
              <span className="score-number">{score}</span>
              <span className="score-total">/ {questions.length}</span>
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
            </div>

            {/* My Rank */}
            {myRank && (
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
            {leaderboard.length > 0 && (
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
              <button
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className="btn btn-secondary"
              >
                {showLeaderboard ? 'Hide' : 'View'} Full Leaderboard
              </button>
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
                  onClick={() => setSelectedDuration(option.value)}
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
              <p><strong>{questions.length} questions</strong> available for this exam</p>
              <p>Time per question: ~{Math.floor((selectedDuration * 60) / questions.length)} seconds</p>
            </div>

            <div className="timer-setup-actions">
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

  const currentQuestion = questions[currentQuestionIndex];
  const questionType = currentQuestion.questionType || 'multiple-choice';

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

  return (
    <div className="practice-container">
      <div className="container">
        <div className="exam-header">
          <div className="exam-progress">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>Score: {score}/{currentQuestionIndex}</span>
          </div>
          {timerActive && timeRemaining !== null && (
            <div className={`exam-timer ${timeWarning ? 'warning' : ''} ${timeCritical ? 'critical' : ''}`}>
              <span className="timer-label">⏱️ Time Remaining:</span>
              <span className="timer-value">{formatTime(timeRemaining)}</span>
            </div>
          )}
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="question-card">
          <div className="question-header">
            <h2 className="question-text">{currentQuestion.questionText}</h2>
            {questionType === 'multi-select' && (
              <div className="multi-select-hint">
                <FiCheckCircle size={16} />
                <span>Select all correct answers (you can choose more than one)</span>
              </div>
            )}
          </div>

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



          <div className="question-actions">
            {!showResult ? (
              <button
                onClick={handleSubmitAnswer}
                className="btn btn-primary"
                disabled={
                  selectedAnswer === null ||
                  selectedAnswer === undefined ||
                  (questionType === 'multi-select' && (!Array.isArray(selectedAnswer) || selectedAnswer.length === 0))
                }
              >
                Submit Answer
              </button>
            ) : (
              <button onClick={handleNextQuestion} className="btn btn-primary">
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Exam'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Practice;
