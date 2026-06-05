import React, { useEffect, useMemo, useState } from 'react';
import {
  FiCheck,
  FiClock,
  FiFileText,
  FiPlay,
  FiRefreshCw,
  FiSquare,
  FiUploadCloud,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import api from '../utils/api';
import './AdminLiveQuiz.css';

const AdminLiveQuiz = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
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
      const response = await api.get('/live-quiz/admin/quizzes');
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

  const loadDetail = async (quizId) => {
    if (!quizId) {
      setDetail(null);
      return;
    }
    try {
      const response = await api.get(`/live-quiz/admin/quizzes/${quizId}`);
      setDetail(response.data?.data || null);
    } catch (error) {
      setDetail(null);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load quiz details.' });
    }
  };

  useEffect(() => {
    loadQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDetail(selectedQuizId);
  }, [selectedQuizId]);

  const handleRootImport = async () => {
    try {
      setImporting(true);
      setMessage({ type: '', text: '' });
      const response = await api.post('/live-quiz/admin/import-root-nou107', {
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
      const response = await api.post('/live-quiz/admin/import-pdf', data, {
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
    if (!selectedQuizId) return;
    try {
      await api.patch(`/live-quiz/admin/quizzes/${selectedQuizId}/status`, { status });
      setMessage({ type: 'success', text: `Quiz status changed to ${status}.` });
      await loadQuizzes();
      await loadDetail(selectedQuizId);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update quiz status.' });
    }
  };

  const handleModerate = async (answerId, isCorrect) => {
    try {
      await api.patch(`/live-quiz/admin/answers/${answerId}`, { isCorrect });
      await loadDetail(selectedQuizId);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to moderate answer.' });
    }
  };

  return (
    <div className="admin-live-quiz-page">
      <div className="admin-live-quiz-header">
        <div>
          <p className="admin-live-quiz-kicker">Live competition</p>
          <h1>Quiz Control</h1>
          <p>Generate questions from a PDF, start the live quiz, and moderate recorded answers.</p>
        </div>
        <button
          type="button"
          className="admin-live-quiz-refresh"
          onClick={() => loadQuizzes(true)}
        >
          <FiRefreshCw />
          Refresh
        </button>
      </div>

      {message.text && <div className={`admin-live-quiz-message ${message.type}`}>{message.text}</div>}

      <section className="admin-live-quiz-import">
        <div className="admin-live-quiz-section-head">
          <div>
            <p className="admin-live-quiz-kicker">Gemini question generation</p>
            <h2>Create a 120-question quiz</h2>
          </div>
          <FiFileText />
        </div>
        <form onSubmit={handleUploadImport}>
          <label>
            Quiz title
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          </label>
          <label>
            Course code
            <input value={form.courseCode} onChange={(event) => setForm((current) => ({ ...current, courseCode: event.target.value }))} required />
          </label>
          <label className="admin-live-quiz-description">
            Description
            <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="admin-live-quiz-file">
            Future PDF upload
            <input type="file" accept="application/pdf" onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
          </label>
          <div className="admin-live-quiz-import-actions">
            <button type="button" onClick={handleRootImport} disabled={importing}>
              <FiFileText />
              {importing ? 'Generating questions...' : 'Use root NOU107 PDF'}
            </button>
            <button type="submit" disabled={importing}>
              <FiUploadCloud />
              Import uploaded PDF
            </button>
          </div>
        </form>
      </section>

      <main className="admin-live-quiz-layout">
        <aside className="admin-live-quiz-list">
          <div className="admin-live-quiz-section-head">
            <div>
              <p className="admin-live-quiz-kicker">Quiz library</p>
              <h2>Quizzes</h2>
            </div>
            <span>{quizzes.length}</span>
          </div>
          {loading && <p className="admin-live-quiz-muted">Loading quizzes...</p>}
          {quizzes.map((quiz) => (
            <button
              type="button"
              key={quiz._id}
              className={selectedQuizId === quiz._id ? 'admin-live-quiz-list-item active' : 'admin-live-quiz-list-item'}
              onClick={() => setSelectedQuizId(quiz._id)}
            >
              <strong>{quiz.title}</strong>
              <span>{quiz.courseCode} / {quiz.questionCount} questions / {quiz.status}</span>
            </button>
          ))}
        </aside>

        <section className="admin-live-quiz-detail">
          {!selectedQuiz && <p className="admin-live-quiz-muted">Select or create a quiz.</p>}
          {selectedQuiz && (
            <>
              <div className="admin-live-quiz-detail-head">
                <div>
                  <p className="admin-live-quiz-kicker">{selectedQuiz.courseCode}</p>
                  <h2>{selectedQuiz.title}</h2>
                  <p>{selectedQuiz.questionCount} questions / {detail?.participantCount || 0} participants</p>
                </div>
                <span className={`admin-live-quiz-status ${selectedQuiz.status}`}>{selectedQuiz.status}</span>
              </div>

              <div className="admin-live-quiz-controls">
                <button type="button" onClick={() => handleStatus('draft')}><FiClock /> Draft</button>
                <button type="button" onClick={() => handleStatus('live')}><FiPlay /> Start quiz</button>
                <button type="button" onClick={() => handleStatus('ended')}><FiSquare /> End quiz</button>
              </div>

              <div className="admin-live-quiz-stats">
                <div><FiFileText /><strong>{selectedQuiz.questionCount}</strong><span>Questions</span></div>
                <div><FiUsers /><strong>{detail?.participantCount || 0}</strong><span>Participants</span></div>
                <div><FiCheck /><strong>{detail?.answers?.length || 0}</strong><span>Recorded answers</span></div>
              </div>

              <div className="admin-live-quiz-leaderboard">
                <div className="admin-live-quiz-section-head">
                  <div>
                    <p className="admin-live-quiz-kicker">Live ranking</p>
                    <h2>Leaderboard</h2>
                  </div>
                  <span>{detail?.leaderboard?.length || 0}</span>
                </div>
                <div className="admin-live-quiz-leader-list">
                  {(detail?.leaderboard || []).map((participant) => (
                    <article key={participant._id}>
                      <span className="admin-live-quiz-rank">{participant.rank}</span>
                      <div>
                        <strong>{participant.username}</strong>
                        <p>{participant.email}</p>
                      </div>
                      <div className="admin-live-quiz-leader-score">
                        <strong>{participant.score}</strong>
                        <span>{participant.correctCount} correct / {participant.answeredCount} answered</span>
                      </div>
                    </article>
                  ))}
                  {detail && detail.leaderboard?.length === 0 && (
                    <p className="admin-live-quiz-muted">No participants are on the leaderboard yet.</p>
                  )}
                </div>
              </div>

              <div className="admin-live-quiz-answer-key">
                <div className="admin-live-quiz-section-head">
                  <div>
                    <p className="admin-live-quiz-kicker">Answer key</p>
                    <h2>Generated questions</h2>
                  </div>
                  <span>{detail?.questions?.length || 0}</span>
                </div>
                <div className="admin-live-quiz-question-list">
                  {(detail?.questions || []).map((question) => (
                    <article key={question._id}>
                      <span>Q{question.order} / {question.questionType}</span>
                      <h3>{question.prompt}</h3>
                      <p>Accepted: {(question.acceptedAnswers || []).join(', ')}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="admin-live-quiz-answers">
                <div className="admin-live-quiz-section-head">
                  <div>
                    <p className="admin-live-quiz-kicker">Moderation</p>
                    <h2>Recorded answers</h2>
                  </div>
                </div>
                {(detail?.answers || []).map((answer) => (
                  <article className="admin-live-quiz-answer" key={answer._id}>
                    <div>
                      <span>Q{answer.questionId?.order} / {answer.questionId?.questionType}</span>
                      <h3>{answer.questionId?.prompt}</h3>
                      <p><strong>{answer.participantId?.username}</strong> ({answer.participantId?.email}) answered: {answer.answer}</p>
                      <small>Accepted: {(answer.questionId?.acceptedAnswers || []).join(', ')}</small>
                    </div>
                    <div className="admin-live-quiz-answer-actions">
                      <span className={answer.isCorrect ? 'correct' : 'incorrect'}>
                        {answer.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                      <button type="button" title="Mark correct" onClick={() => handleModerate(answer._id, true)}><FiCheck /></button>
                      <button type="button" title="Mark incorrect" onClick={() => handleModerate(answer._id, false)}><FiX /></button>
                    </div>
                  </article>
                ))}
                {detail && detail.answers?.length === 0 && <p className="admin-live-quiz-muted">No answers have been submitted yet.</p>}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminLiveQuiz;
