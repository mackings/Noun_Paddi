import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import {
  FiArchive,
  FiBookOpen,
  FiCheckCircle,
  FiDatabase,
  FiFileText,
  FiFilter,
  FiInfo,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
} from 'react-icons/fi';
import './AdminTma.css';

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
  const [sources, setSources] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modeLoading, setModeLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all');
  const [uploadForm, setUploadForm] = useState({
    title: '',
    sourceType: 'course_material',
    courseId: '',
    file: null,
  });
  const [answerForm, setAnswerForm] = useState({
    courseId: '',
    question: '',
    optionsText: '',
  });
  const [answerResult, setAnswerResult] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sourcesRes, coursesRes] = await Promise.all([
        api.get('/tma/sources'),
        api.get('/courses'),
      ]);
      setSources(sourcesRes.data.data || []);
      setCourses(coursesRes.data.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load TMA workspace' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = window.setTimeout(() => {
      setModeLoading(false);
    }, 1600);

    return () => window.clearTimeout(timer);
  }, []);

  const stats = useMemo(() => {
    const totalChunks = sources.reduce((sum, item) => sum + (item.chunkCount || 0), 0);
    const linked = sources.filter((item) => item.courseId?._id).length;
    const courseMaterials = sources.filter((item) => item.sourceType === 'course_material').length;
    return { totalSources: sources.length, totalChunks, linked, courseMaterials };
  }, [sources]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course._id === answerForm.courseId),
    [answerForm.courseId, courses]
  );

  const selectedCourseSources = useMemo(() => {
    if (!answerForm.courseId) return sources.length;
    return sources.filter((source) => source.courseId?._id === answerForm.courseId).length;
  }, [answerForm.courseId, sources]);

  const answerOptionsCount = useMemo(
    () => answerForm.optionsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean).length,
    [answerForm.optionsText]
  );

  const filteredSources = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return sources.filter((source) => {
      if (sourceTypeFilter !== 'all' && source.sourceType !== sourceTypeFilter) {
        return false;
      }
      if (!normalized) return true;
      const haystack = [
        source.title,
        source.sourceType,
        source.detectedCourseCode,
        source.detectedCourseName,
        source.courseId?.courseCode,
        source.courseId?.courseName,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [sources, searchTerm, sourceTypeFilter]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!uploadForm.file) {
      setMessage({ type: 'error', text: 'Choose a PDF, DOC, DOCX, or TXT source first.' });
      return;
    }

    try {
      setUploading(true);
      setMessage({ type: '', text: '' });
      const data = new FormData();
      data.append('file', uploadForm.file);
      data.append('title', uploadForm.title || uploadForm.file.name);
      data.append('sourceType', uploadForm.sourceType);
      if (uploadForm.courseId) {
        data.append('courseId', uploadForm.courseId);
      }

      await api.post('/tma/sources/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadForm({ title: '', sourceType: 'course_material', courseId: '', file: null });
      setMessage({ type: 'success', text: 'Source fully read, extracted, and saved for TMA answering.' });
      await fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Upload failed. The source was not saved.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (source) => {
    if (!window.confirm(`Delete "${source.title}" from the TMA knowledge base?`)) return;
    try {
      await api.delete(`/tma/sources/${source._id}`);
      setMessage({ type: 'success', text: 'TMA source deleted.' });
      await fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete source.' });
    }
  };

  const handleBackfill = async () => {
    try {
      setBackfilling(true);
      setMessage({ type: '', text: '' });
      const response = await api.post('/tma/sources/backfill-embeddings', { limit: 250 });
      const data = response.data.data || {};
      setMessage({
        type: 'success',
        text: data.processed > 0
          ? `Upgraded ${data.processed} chunks. ${data.remaining || 0} remaining.`
          : 'All sources are already upgraded.',
      });
      await fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to upgrade old sources.' });
    } finally {
      setBackfilling(false);
    }
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
        courseId: answerForm.courseId || undefined,
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

  if (modeLoading) {
    return (
      <div className="admin-tma-container">
        <div className="container">
          <div className="tma-mode-loader">
            <div className="spinner"></div>
            <h1>Entering TMA mode</h1>
            <p>Preparing sources and answer tools...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-tma-container">
        <div className="container">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading TMA workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-tma-container">
      <div className="container">
        <div className="tma-hero">
          <div>
            <p className="tma-kicker">TMA Workspace</p>
            <h1>TMA Mode</h1>
            <p>Answer questions from fully-read course materials, TMA files, and past-question sources.</p>
          </div>
          <div className="tma-hero-actions">
            <button type="button" className="btn btn-outline-primary" onClick={fetchData}>
              <FiRefreshCw /> Refresh
            </button>
            <button type="button" className="btn btn-outline-primary" onClick={handleBackfill} disabled={backfilling}>
              {backfilling ? <><div className="spinner-small"></div> Upgrading...</> : <><FiArchive /> Upgrade sources</>}
            </button>
          </div>
        </div>

        <div className="tma-status-strip">
          <div className="tma-stat-card">
            <span>Sources</span>
            <strong>{stats.totalSources}</strong>
          </div>
          <div className="tma-stat-card">
            <span>Text Chunks</span>
            <strong>{stats.totalChunks}</strong>
          </div>
          <div className="tma-stat-card">
            <span>Linked Courses</span>
            <strong>{stats.linked}</strong>
          </div>
          <div className="tma-stat-card">
            <span>Course Materials</span>
            <strong>{stats.courseMaterials}</strong>
          </div>
        </div>

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
                  {selectedCourse
                    ? `${selectedCourse.courseCode} scope selected with ${selectedCourseSources} source${selectedCourseSources === 1 ? '' : 's'}.`
                    : `Searching across ${sources.length} source${sources.length === 1 ? '' : 's'}.`}
                </p>
              </div>
            </div>

            <div className="tma-scope-note">
              <FiInfo />
              <span>Pick a course when you want stricter matching. Leave it on all sources for broad TMA lookup.</span>
            </div>

            <form onSubmit={handleAnswer} className="tma-form">
              <label>
                <span>Course</span>
                <select
                  value={answerForm.courseId}
                  onChange={(event) => setAnswerForm((current) => ({ ...current, courseId: event.target.value }))}
                >
                  <option value="">Search all sources</option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.courseCode} - {course.courseName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Question <em>{answerForm.question.length} characters</em></span>
                <textarea
                  value={answerForm.question}
                  onChange={(event) => setAnswerForm((current) => ({ ...current, question: event.target.value }))}
                  placeholder="Paste the full TMA question here"
                  rows={7}
                  required
                />
              </label>

              <label>
                <span>Options <em>{answerOptionsCount} entered</em></span>
                <textarea
                  value={answerForm.optionsText}
                  onChange={(event) => setAnswerForm((current) => ({ ...current, optionsText: event.target.value }))}
                  placeholder={'A. Option one\nB. Option two\nC. Option three\nD. Option four'}
                  rows={5}
                />
              </label>

              <button type="submit" className="btn btn-success tma-primary-action" disabled={answering || !answerForm.question.trim()}>
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

          <aside className="tma-side-stack">
            <section className="tma-panel tma-readiness-panel">
              <div className="tma-panel-head compact">
                <FiDatabase />
                <div>
                  <h2>Source Readiness</h2>
                  <p>More linked sources improve answer quality.</p>
                </div>
              </div>
              <div className="tma-readiness-list">
                <div>
                  <span>Current answer scope</span>
                  <strong>{selectedCourse ? selectedCourse.courseCode : 'All sources'}</strong>
                </div>
                <div>
                  <span>Sources in scope</span>
                  <strong>{selectedCourseSources}</strong>
                </div>
                <div>
                  <span>Uploaded files</span>
                  <strong>{stats.totalSources}</strong>
                </div>
              </div>
            </section>

            <section className="tma-panel tma-upload-panel">
              <div className="tma-panel-head compact">
                <FiUploadCloud />
                <div>
                  <h2>Add Source</h2>
                  <p>Files are saved after extraction completes.</p>
                </div>
              </div>

              <form onSubmit={handleUpload} className="tma-form">
                <label>
                  <span>Title</span>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="e.g. GST 105 TMA 1"
                  />
                </label>

                <div className="tma-two-col">
                  <label>
                    <span>Type</span>
                    <select
                      value={uploadForm.sourceType}
                      onChange={(event) => setUploadForm((current) => ({ ...current, sourceType: event.target.value }))}
                    >
                      {sourceTypes.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Course</span>
                    <select
                      value={uploadForm.courseId}
                      onChange={(event) => setUploadForm((current) => ({ ...current, courseId: event.target.value }))}
                    >
                      <option value="">Auto-detect</option>
                      {courses.map((course) => (
                        <option key={course._id} value={course._id}>
                          {course.courseCode} - {course.courseName}
                        </option>
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

        <section className="tma-library">
          <div className="tma-library-head">
            <div>
              <h2>Sources</h2>
              <p>Search, filter, and maintain the files used for TMA answers.</p>
            </div>
            <div className="tma-library-tools">
              <div className="tma-search">
                <FiSearch />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search sources"
                />
              </div>
              <div className="tma-type-filter">
                <FiFilter />
                <select value={sourceTypeFilter} onChange={(event) => setSourceTypeFilter(event.target.value)}>
                  <option value="all">All types</option>
                  {sourceTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {filteredSources.length === 0 ? (
            <div className="tma-empty">
              <FiBookOpen />
              <h3>No sources found</h3>
              <p>Upload course material or a TMA file to start.</p>
            </div>
          ) : (
            <div className="tma-source-grid">
              {filteredSources.map((source) => (
                <article key={source._id} className="tma-source-card">
                  <div className="tma-source-icon">
                    <FiFileText />
                  </div>
                  <div className="tma-source-main">
                    <div className="tma-source-title-row">
                      <h3>{source.title}</h3>
                      <button type="button" onClick={() => handleDelete(source)} aria-label={`Delete ${source.title}`}>
                        <FiTrash2 />
                      </button>
                    </div>
                    <p>
                      {source.courseId?.courseCode || source.detectedCourseCode || 'Course not linked'}
                      {source.courseId?.courseName ? ` · ${source.courseId.courseName}` : ''}
                    </p>
                    <div className="tma-source-meta">
                      <span>{sourceTypeLabels[source.sourceType] || source.sourceType.replace(/_/g, ' ')}</span>
                      <span>{source.chunkCount || 0} chunks</span>
                      <span>{source.pageCount ? `${source.pageCount} pages` : `${source.textLength || 0} chars`}</span>
                      <span>{formatDate(source.createdAt)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminTma;
