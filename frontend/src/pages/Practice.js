import React, { useState, useEffect } from 'react';
import api from '../utils/api';
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

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses');
      setCourses(response.data.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const startExam = async (courseId) => {
    try {
      setLoading(true);
      const response = await api.get(`/questions/course/${courseId}`);

      // Convert 50% to True/False, keep rest as single-answer
      const transformedQuestions = convertHalfToTrueFalse(response.data.data);

      setQuestions(transformedQuestions);
      setSelectedCourse(courseId);
      setCurrentQuestionIndex(0);
      setScore(0);
      setAnswers([]);
      setExamComplete(false);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setLoading(false);
    }
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

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null); // Reset to null for all question types
      setShowResult(false);
    } else {
      setExamComplete(true);
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
            <button onClick={resetExam} className="btn btn-primary">
              Take Another Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedCourse) {
    return (
      <div className="practice-container">
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
                  onClick={() => startExam(course._id)}
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

  return (
    <div className="practice-container">
      <div className="container">
        <div className="exam-header">
          <div className="exam-progress">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>Score: {score}/{currentQuestionIndex}</span>
          </div>
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
