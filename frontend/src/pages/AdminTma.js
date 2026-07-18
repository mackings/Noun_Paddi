import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import {
  FiCheckCircle,
  FiFileText,
  FiPlusCircle,
  FiUploadCloud,
} from 'react-icons/fi';
import AdminTmaRecords from './AdminTmaRecords';
import './AdminTma.css';

const ALLOWED_TABS = ['assistant', 'records'];

const sourceTypes = [
  { value: 'course_material', label: 'Course Material' },
  { value: 'past_question', label: 'Past Question' },
  { value: 'tma_1', label: 'TMA 1' },
  { value: 'tma_2', label: 'TMA 2' },
  { value: 'tma_3', label: 'TMA 3' },
  { value: 'other', label: 'Other Source' },
];

const sourceTypeLabels = sourceTypes.reduce((labels, item) => {
  labels[item.value] = item.label;
  return labels;
}, {});

const AdminTma = () => {
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = ALLOWED_TABS.includes(requestedTab) ? requestedTab : 'assistant';

  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [startingNewCourse, setStartingNewCourse] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    sourceType: 'course_material',
    file: null,
  });
  const [answerForm, setAnswerForm] = useState({
    question: '',
    optionsText: '',
  });
  const [answerResult, setAnswerResult] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const sourcesRes = await api.get('/tma/sources');
      setSources(sourcesRes.data.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load TMA workspace' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const totalChunks = sources.reduce((sum, item) => sum + (item.chunkCount || 0), 0);
    const linked = sources.filter((item) => item.courseId?._id).length;
    return { totalSources: sources.length, totalChunks, linked };
  }, [sources]);

  const currentCourse = useMemo(() => {
    if (!sources.length) return null;
    const latest = sources[0];
    return {
      id: latest.courseId?._id || null,
      code: latest.courseId?.courseCode || latest.detectedCourseCode || null,
      name: latest.courseId?.courseName || latest.detectedCourseName || '',
      updatedAt: latest.createdAt,
    };
  }, [sources]);

  const currentCourseSourceCount = useMemo(() => {
    if (!currentCourse?.id) return sources.length;
    return sources.filter((source) => source.courseId?._id === currentCourse.id).length;
  }, [currentCourse, sources]);

  const answerOptionsCount = useMemo(
    () => answerForm.optionsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean).length,
    [answerForm.optionsText]
  );

  const buildUploadFormData = (overrideConfirm) => {
    const data = new FormData();
    data.append('file', uploadForm.file);
    data.append('title', uploadForm.title || uploadForm.file.name);
    data.append('sourceType', uploadForm.sourceType);
    if (overrideConfirm) {
      data.append('confirmOverride', 'true');
    }
    return data;
  };

  const submitUpload = async (overrideConfirm) => {
    try {
      setUploading(true);
      setMessage({ type: '', text: '' });
      await api.post('/tma/sources/upload', buildUploadFormData(overrideConfirm), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadForm({ title: '', sourceType: 'course_material', file: null });
      setMessage({
        type: 'success',
        text: overrideConfirm
          ? 'Previous source replaced. New source saved for TMA answering.'
          : 'Source fully read, extracted, and saved for TMA answering.',
      });
      setDuplicateConflict(null);
      setStartingNewCourse(false);
      await fetchData();
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.duplicate) {
        setDuplicateConflict(error.response.data.data);
        return;
      }
      setMessage({ type: 'error', text: error.response?.data?.message || 'Upload failed. The source was not saved.' });
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!uploadForm.file) {
      setMessage({ type: 'error', text: 'Choose a PDF, DOC, DOCX, or TXT source first.' });
      return;
    }
    await submitUpload(false);
  };

  const handleConfirmOverride = () => submitUpload(true);

  const handleKeepExisting = () => {
    setDuplicateConflict(null);
    setMessage({ type: 'success', text: 'Kept the existing source. Upload cancelled.' });
  };

  const handleAnswer = async (event) => {
    event.preventDefault();
    setAnswerResult(null);
    try {
      setAnswering(true);
      setMessage({ type: '', text: '' });
      const options = answerForm.optionsText
        .split('\n')
        .map((item) => item.replace(/^[A-F][.)]\s*/i, '').trim())
        .filter(Boolean);

      const response = await api.post('/tma/answer', {
        courseId: currentCourse?.id || undefined,
        question: answerForm.question,
        options,
      });

      setAnswerResult(response.data.data);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'The system could not answer this TMA question from the available sources.' });
    } finally {
      setAnswering(false);
    }
  };

  if (loading && activeTab === 'assistant') {
    return (
      <div className="admin-tma-container">
        <div className="container">
          <div className="tma-skeleton-grid">
            <div className="tma-skeleton-panel large">
              <div className="tma-skeleton-icon"></div>
              <div className="tma-skeleton-line wide"></div>
              <div className="tma-skeleton-line"></div>
              <div className="tma-skeleton-box"></div>
              <div className="tma-skeleton-box short"></div>
            </div>
            <div className="tma-skeleton-panel">
              <div className="tma-skeleton-icon"></div>
              <div className="tma-skeleton-line wide"></div>
              <div className="tma-skeleton-line"></div>
              <div className="tma-skeleton-box"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-tma-container">
      <div className="container">
        <section className="tma-hero">
          <div>
            <p className="tma-kicker">Admin Workspace</p>
            <h1>{activeTab === 'records' ? 'TMA Records' : 'TMA Assistant'}</h1>
            <p>
              {activeTab === 'records'
                ? "Log each student's TMA 1, 2, and 3 scores per course for better record keeping."
                : 'Upload source material and get AI-backed answers for tutor-marked assignment questions.'}
            </p>
          </div>
          {activeTab === 'assistant' && (
            <div className="tma-hero-stats">
              <div className="tma-hero-stat">
                <strong>{stats.totalSources}</strong>
                <span>Sources</span>
              </div>
              <div className="tma-hero-stat">
                <strong>{stats.totalChunks}</strong>
                <span>Chunks</span>
              </div>
              <div className="tma-hero-stat">
                <strong>{stats.linked}</strong>
                <span>Linked</span>
              </div>
            </div>
          )}
        </section>

        {activeTab === 'records' ? (
          <AdminTmaRecords />
        ) : (
          <>
            {message.text && (
              <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                {message.text}
              </div>
            )}

            <div className="tma-work-grid">
          <section className="tma-panel tma-answer-panel">
            <div className="tma-panel-head">
              <FiCheckCircle />
              <div>
                <h2>Answer Question</h2>
                <p>
                  {currentCourse
                    ? `Scoped to ${currentCourse.code || 'the current course'} — searching ${currentCourseSourceCount} source${currentCourseSourceCount === 1 ? '' : 's'}.`
                    : `Searching across ${sources.length} source${sources.length === 1 ? '' : 's'}.`}
                </p>
              </div>
            </div>

            <form onSubmit={handleAnswer} className="tma-form">
              <label>
                <span>Question <em>{answerForm.question.length} characters</em></span>
                <textarea
                  value={answerForm.question}
                  onChange={(event) => setAnswerForm((current) => ({ ...current, question: event.target.value }))}
                  placeholder="Paste the full TMA question here"
                  rows={3}
                  required
                />
              </label>

              <label>
                <span>Options <em>{answerOptionsCount} entered</em></span>
                <textarea
                  value={answerForm.optionsText}
                  onChange={(event) => setAnswerForm((current) => ({ ...current, optionsText: event.target.value }))}
                  placeholder={'A. Option one\nB. Option two\nC. Option three\nD. Option four'}
                  rows={3}
                />
              </label>

              <button type="submit" className="btn btn-primary tma-primary-action" disabled={answering || !answerForm.question.trim()}>
                {answering ? <><div className="spinner-small"></div> Answering...</> : <><FiCheckCircle /> Answer</>}
              </button>
            </form>

            {answerResult && (
              <div className="tma-answer-card">
                <div className="tma-answer-top">
                  <span>Answer result</span>
                  <strong>{answerResult.confidence || 0}% confidence</strong>
                </div>
                <div className="tma-confidence-track">
                  <span style={{ width: `${Math.min(Math.max(answerResult.confidence || 0, 0), 100)}%` }} />
                </div>
                <div className="tma-final-answer">
                  <span>Suggested answer</span>
                  <h3>{answerResult.answer}</h3>
                </div>
                <p className="tma-answer-explanation">{answerResult.explanation}</p>
                {Array.isArray(answerResult.evidence) && answerResult.evidence.length > 0 && (
                  <div className="tma-evidence-list">
                    <h4>Supporting Evidence</h4>
                    {answerResult.evidence.map((item, index) => (
                      <article key={`${item.sourceId}-${index}`}>
                        <span>{sourceTypeLabels[item.sourceType] || item.sourceType}</span>
                        <strong>{item.title}</strong>
                        <p>{item.excerpt}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <aside>
            <section className="tma-panel tma-upload-panel">
              <div className="tma-panel-head compact">
                <FiUploadCloud />
                <div>
                  <h2>Add Source</h2>
                  <p>Files are saved after extraction completes.</p>
                </div>
              </div>

              <div className="tma-current-course">
                {startingNewCourse || !currentCourse ? (
                  <div className="tma-current-course-empty">
                    <FiPlusCircle />
                    <div>
                      <strong>Ready for a new course</strong>
                      <p>Upload a document below to begin — the course is detected automatically.</p>
                    </div>
                  </div>
                ) : (
                  <div className="tma-current-course-active">
                    <div>
                      <span className="tma-current-course-label">Currently working on</span>
                      <strong>{currentCourse.code || 'Unlinked course'}{currentCourse.name ? ` — ${currentCourse.name}` : ''}</strong>
                      {currentCourse.updatedAt && <small>Last updated {formatDate(currentCourse.updatedAt)}</small>}
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-primary tma-start-new-btn"
                      onClick={() => setStartingNewCourse(true)}
                    >
                      <FiPlusCircle /> Start New Course
                    </button>
                  </div>
                )}
              </div>

              <form onSubmit={handleUpload} className="tma-form">
                <div className="tma-two-col">
                  <label>
                    <span>Title</span>
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="e.g. GST 105 TMA 1"
                    />
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      aria-label="TMA source type"
                      value={uploadForm.sourceType}
                      onChange={(event) => setUploadForm((current) => ({ ...current, sourceType: event.target.value }))}
                    >
                      {sourceTypes.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="tma-file-input" htmlFor="tma-source-file">
                  <span>Document</span>
                  <div className="tma-file-drop">
                    <FiFileText />
                    <strong>{uploadForm.file?.name || 'Choose source document'}</strong>
                    <small>PDF, DOC, DOCX, or TXT</small>
                  </div>
                  <input
                    id="tma-source-file"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                  />
                </label>

                <button type="submit" className="btn btn-primary tma-primary-action" disabled={uploading}>
                  {uploading ? <><div className="spinner-small"></div> Reading...</> : <><FiUploadCloud /> Upload Source</>}
                </button>
              </form>
            </section>
          </aside>
        </div>
          </>
        )}
      </div>

      {activeTab === 'assistant' && duplicateConflict && (
        <div className="tma-conflict-overlay" role="dialog" aria-modal="true">
          <div className="tma-conflict-dialog">
            <h3>Course already uploaded</h3>
            <p>
              <strong>{duplicateConflict.course?.courseCode}</strong>
              {duplicateConflict.course?.courseName ? ` — ${duplicateConflict.course.courseName}` : ''} already has{' '}
              {duplicateConflict.existingSources?.length || 0} source{(duplicateConflict.existingSources?.length || 0) === 1 ? '' : 's'} uploaded.
            </p>
            <ul className="tma-conflict-list">
              {(duplicateConflict.existingSources || []).map((item) => (
                <li key={item._id}>
                  <strong>{item.title}</strong>
                  <span>{sourceTypeLabels[item.sourceType] || item.sourceType} · {formatDate(item.createdAt)}</span>
                </li>
              ))}
            </ul>
            <p>Override to replace the existing source with this new one, or keep the existing source and cancel this upload.</p>
            <div className="tma-conflict-actions">
              <button type="button" className="btn btn-outline-primary" onClick={handleKeepExisting} disabled={uploading}>
                Keep Existing
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirmOverride} disabled={uploading}>
                {uploading ? <><div className="spinner-small"></div> Overriding...</> : 'Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTma;
