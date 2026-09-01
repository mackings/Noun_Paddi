import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import {
  CheckCircle2,
  FileText,
  FolderOpen,
  PlusCircle,
  Search,
  Trash2,
  UploadCloud,
  Loader2,
} from 'lucide-react';
import AdminTmaRecords from './AdminTmaRecords';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { cn } from '../lib/utils';

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

const selectClass = 'tw:h-10 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';
const textareaClass = 'tw:w-full tw:resize-none tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';

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
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [sourceSearch, setSourceSearch] = useState('');
  const [deletingSourceId, setDeletingSourceId] = useState(null);
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

  // Refetches the sources list without the page-level loading spinner — used after a
  // delete so the list, search term, and scroll position don't get blanked out for what
  // is otherwise a small, single-row change.
  const refreshSources = async () => {
    const sourcesRes = await api.get('/tma/sources');
    setSources(sourcesRes.data.data || []);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      await refreshSources();
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

  // Defaults to the most recently uploaded source, but an admin can pick any
  // previously uploaded file from the "Existing Sources" list below to switch the
  // Answer Question search to that file's course — without re-uploading anything.
  const selectedSource = useMemo(
    () => (selectedSourceId ? sources.find((source) => source._id === selectedSourceId) : null),
    [sources, selectedSourceId]
  );

  // The file actually driving Answer Question right now — whichever was explicitly
  // picked from Existing Sources, or the most recent upload otherwise.
  const activeSource = useMemo(() => selectedSource || sources[0] || null, [selectedSource, sources]);

  const currentCourse = useMemo(() => {
    if (!activeSource) return null;
    return {
      id: activeSource.courseId?._id || null,
      code: activeSource.courseId?.courseCode || activeSource.detectedCourseCode || null,
      name: activeSource.courseId?.courseName || activeSource.detectedCourseName || '',
      updatedAt: activeSource.createdAt,
    };
  }, [activeSource]);

  // Matches what the backend actually searches: a real course pools every source linked
  // to it, but a source with no resolved course is scoped to just that one file (see the
  // sourceId fallback in handleAnswer) — so the count here must reflect that, not the
  // full sources.length, or the UI would overstate what's actually being searched.
  const currentCourseSourceCount = useMemo(() => {
    if (currentCourse?.id) {
      return sources.filter((source) => source.courseId?._id === currentCourse.id).length;
    }
    return activeSource ? 1 : sources.length;
  }, [currentCourse, sources, activeSource]);

  const filteredSources = useMemo(() => {
    const term = sourceSearch.trim().toLowerCase();
    if (!term) return sources;
    return sources.filter((source) => {
      const haystack = [
        source.title,
        source.courseId?.courseCode,
        source.courseId?.courseName,
        source.detectedCourseCode,
        source.detectedCourseName,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [sources, sourceSearch]);

  const handleUseSource = (source) => {
    setSelectedSourceId(source._id);
    setStartingNewCourse(false);
    setMessage({ type: '', text: '' });
  };

  const handleDeleteSource = async (source) => {
    if (!window.confirm(`Delete "${source.title}"? This removes it from TMA answering and cannot be undone.`)) {
      return;
    }
    try {
      setDeletingSourceId(source._id);
      await api.delete(`/tma/sources/${source._id}`);
      if (selectedSourceId === source._id) {
        setSelectedSourceId(null);
      }
      setMessage({ type: 'success', text: `"${source.title}" was deleted.` });
      await refreshSources();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete this source.' });
    } finally {
      setDeletingSourceId(null);
    }
  };

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
        // activeSource has no resolved course — scope the search to that one file
        // instead of leaving it unscoped, which would pool every course's chunks
        // together. Only relevant when courseId is absent; the backend ignores
        // sourceId whenever a real courseId is present.
        sourceId: !currentCourse?.id ? activeSource?._id || undefined : undefined,
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
      <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
        <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
        <p className="tw:text-sm">Loading TMA workspace...</p>
      </div>
    );
  }

  return (
    <div className="tw:space-y-5">
      <Card className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-4 tw:p-5">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Admin Workspace</p>
          <h1 className="tw:font-heading tw:text-xl tw:font-bold tw:tracking-tight">{activeTab === 'records' ? 'TMA Records' : 'TMA Assistant'}</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">
            {activeTab === 'records'
              ? "Log each student's TMA 1, 2, and 3 scores per course for better record keeping."
              : 'Upload source material and get AI-backed answers for tutor-marked assignment questions.'}
          </p>
        </div>
        {activeTab === 'assistant' && (
          <div className="tw:flex tw:gap-4">
            {[{ label: 'Sources', value: stats.totalSources }, { label: 'Chunks', value: stats.totalChunks }, { label: 'Linked', value: stats.linked }].map((stat) => (
              <div key={stat.label} className="tw:text-center">
                <strong className="tw:block tw:font-heading tw:text-lg tw:font-bold">{stat.value}</strong>
                <span className="tw:text-[11px] tw:text-slate-400">{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {activeTab === 'records' ? (
        <AdminTmaRecords />
      ) : (
        <>
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
            <div className="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3">
              <div className="tw:flex tw:items-start tw:gap-3">
                <span className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><FolderOpen className="tw:h-4.5 tw:w-4.5" /></span>
                <div>
                  <h2 className="tw:font-heading tw:text-sm tw:font-bold">Existing Sources</h2>
                  <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                    Pick a previously uploaded file to switch Answer Question to its course — no re-upload needed.
                  </p>
                </div>
              </div>
              <div className="tw:relative tw:w-full tw:max-w-[220px]">
                <Search className="tw:absolute tw:top-1/2 tw:left-3 tw:h-3.5 tw:w-3.5 tw:-translate-y-1/2 tw:text-slate-400" />
                <Input
                  type="search"
                  value={sourceSearch}
                  onChange={(event) => setSourceSearch(event.target.value)}
                  placeholder="Search by course or title"
                  className="tw:pl-8"
                />
              </div>
            </div>

            <div className="tw:mt-4 tw:max-h-72 tw:space-y-2 tw:overflow-y-auto">
              {sources.length === 0 ? (
                <p className="tw:py-6 tw:text-center tw:text-sm tw:text-slate-400">No sources uploaded yet — add one below to get started.</p>
              ) : filteredSources.length === 0 ? (
                <p className="tw:py-6 tw:text-center tw:text-sm tw:text-slate-400">No sources match "{sourceSearch}".</p>
              ) : (
                filteredSources.map((source) => {
                  const isActive = selectedSource
                    ? source._id === selectedSource._id
                    : source._id === sources[0]?._id;
                  const isDeleting = deletingSourceId === source._id;
                  return (
                    <div
                      key={source._id}
                      className={cn(
                        'tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:rounded-xl tw:border tw:p-3',
                        isActive
                          ? 'tw:border-brand-300 tw:bg-brand-50 tw:dark:border-brand-800 tw:dark:bg-brand-950/40'
                          : 'tw:border-slate-200/70 tw:dark:border-slate-800',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleUseSource(source)}
                        className="tw:flex tw:min-w-0 tw:flex-1 tw:items-start tw:gap-2.5 tw:text-left"
                      >
                        <FileText className="tw:mt-0.5 tw:h-4 tw:w-4 tw:shrink-0 tw:text-slate-400" />
                        <span className="tw:min-w-0">
                          <strong className="tw:block tw:truncate tw:text-sm">{source.title}</strong>
                          <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-2 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                            <span className="tw:font-semibold tw:text-brand-600">{sourceTypeLabels[source.sourceType] || source.sourceType}</span>
                            <span>{source.courseId?.courseCode || source.detectedCourseCode || 'Unlinked'}</span>
                            <span>{formatDate(source.createdAt)}</span>
                          </span>
                        </span>
                      </button>
                      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
                        {isActive && <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-brand-600"><CheckCircle2 className="tw:h-3.5 tw:w-3.5" /> In use</span>}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={isDeleting}
                          onClick={() => handleDeleteSource(source)}
                          aria-label={`Delete ${source.title}`}
                        >
                          {isDeleting ? <Loader2 className="tw:h-3.5 tw:w-3.5 tw:animate-spin" /> : <Trash2 className="tw:h-3.5 tw:w-3.5 tw:text-red-500" />}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-[1.4fr_1fr]">
            <Card className="tw:p-5">
              <div className="tw:flex tw:items-start tw:gap-3">
                <span className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><CheckCircle2 className="tw:h-4.5 tw:w-4.5" /></span>
                <div>
                  <h2 className="tw:font-heading tw:text-sm tw:font-bold">Answer Question</h2>
                  <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                    {currentCourse
                      ? `Scoped to ${currentCourse.code || 'the current course'} — searching ${currentCourseSourceCount} source${currentCourseSourceCount === 1 ? '' : 's'}.`
                      : `Searching across ${sources.length} source${sources.length === 1 ? '' : 's'}.`}
                  </p>
                </div>
              </div>

              <form onSubmit={handleAnswer} className="tw:mt-4 tw:space-y-3">
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:justify-between tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">
                    Question <em className="tw:text-slate-400 tw:not-italic">{answerForm.question.length} characters</em>
                  </span>
                  <textarea
                    value={answerForm.question}
                    onChange={(event) => setAnswerForm((current) => ({ ...current, question: event.target.value }))}
                    placeholder="Paste the full TMA question here"
                    rows={3}
                    required
                    className={textareaClass}
                  />
                </label>

                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:justify-between tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">
                    Options <em className="tw:text-slate-400 tw:not-italic">{answerOptionsCount} entered</em>
                  </span>
                  <textarea
                    value={answerForm.optionsText}
                    onChange={(event) => setAnswerForm((current) => ({ ...current, optionsText: event.target.value }))}
                    placeholder={'A. Option one\nB. Option two\nC. Option three\nD. Option four'}
                    rows={3}
                    className={textareaClass}
                  />
                </label>

                <Button type="submit" disabled={answering || !answerForm.question.trim()} className="tw:w-full">
                  {answering ? <><Loader2 className="tw:h-4 tw:w-4 tw:animate-spin" /> Answering...</> : <><CheckCircle2 className="tw:h-4 tw:w-4" /> Answer</>}
                </Button>
              </form>

              {answerResult && (
                <div className="tw:mt-4 tw:space-y-3 tw:rounded-2xl tw:border tw:border-slate-200/70 tw:p-4 tw:dark:border-slate-800">
                  <div className="tw:flex tw:items-center tw:justify-between tw:text-xs tw:font-semibold tw:text-slate-500 tw:dark:text-slate-400">
                    <span>Answer result</span>
                    <strong className="tw:text-slate-900 tw:dark:text-slate-100">{answerResult.confidence || 0}% confidence</strong>
                  </div>
                  <div className="tw:h-1.5 tw:w-full tw:overflow-hidden tw:rounded-full tw:bg-slate-100 tw:dark:bg-slate-800">
                    <span className="tw:block tw:h-full tw:rounded-full tw:bg-brand-600" style={{ width: `${Math.min(Math.max(answerResult.confidence || 0, 0), 100)}%` }} />
                  </div>
                  <div>
                    <span className="tw:text-xs tw:font-semibold tw:text-slate-500 tw:dark:text-slate-400">Suggested answer</span>
                    <h3 className="tw:font-heading tw:text-base tw:font-bold">{answerResult.answer}</h3>
                  </div>
                  <p className="tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">{answerResult.explanation}</p>
                  {Array.isArray(answerResult.evidence) && answerResult.evidence.length > 0 && (
                    <div className="tw:space-y-2">
                      <h4 className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-slate-400 tw:uppercase">Supporting Evidence</h4>
                      {answerResult.evidence.map((item, index) => (
                        <article key={`${item.sourceId}-${index}`} className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-900">
                          <span className="tw:text-[11px] tw:font-semibold tw:text-brand-600">{sourceTypeLabels[item.sourceType] || item.sourceType}</span>
                          <strong className="tw:block tw:text-sm">{item.title}</strong>
                          <p className="tw:mt-1 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{item.excerpt}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card className="tw:p-5">
              <div className="tw:flex tw:items-start tw:gap-3">
                <span className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><UploadCloud className="tw:h-4.5 tw:w-4.5" /></span>
                <div>
                  <h2 className="tw:font-heading tw:text-sm tw:font-bold">Add Source</h2>
                  <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Files are saved after extraction completes.</p>
                </div>
              </div>

              <div className="tw:mt-4">
                {startingNewCourse || !currentCourse ? (
                  <div className="tw:flex tw:items-start tw:gap-2.5 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-900">
                    <PlusCircle className="tw:h-4 tw:w-4 tw:shrink-0 tw:translate-y-0.5 tw:text-brand-600" />
                    <div>
                      <strong className="tw:block tw:text-sm">Ready for a new course</strong>
                      <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Upload a document below to begin — the course is detected automatically.</p>
                    </div>
                  </div>
                ) : (
                  <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-900">
                    <div>
                      <span className="tw:block tw:text-[11px] tw:font-semibold tw:text-slate-400 tw:uppercase">Currently working on</span>
                      <strong className="tw:text-sm">{currentCourse.code || 'Unlinked course'}{currentCourse.name ? ` — ${currentCourse.name}` : ''}</strong>
                      {currentCourse.updatedAt && <small className="tw:block tw:text-xs tw:text-slate-400">Last updated {formatDate(currentCourse.updatedAt)}</small>}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setStartingNewCourse(true); setSelectedSourceId(null); }}
                    >
                      <PlusCircle className="tw:h-3.5 tw:w-3.5" /> Start New Course
                    </Button>
                  </div>
                )}
              </div>

              <form onSubmit={handleUpload} className="tw:mt-4 tw:space-y-3">
                <div className="tw:grid tw:grid-cols-2 tw:gap-3">
                  <label className="tw:block tw:space-y-1.5">
                    <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Title</span>
                    <Input
                      type="text"
                      value={uploadForm.title}
                      onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="e.g. GST 105 TMA 1"
                    />
                  </label>
                  <label className="tw:block tw:space-y-1.5">
                    <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Type</span>
                    <select
                      aria-label="TMA source type"
                      value={uploadForm.sourceType}
                      onChange={(event) => setUploadForm((current) => ({ ...current, sourceType: event.target.value }))}
                      className={selectClass}
                    >
                      {sourceTypes.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label htmlFor="tma-source-file" className="tw:block tw:space-y-1.5">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Document</span>
                  <div className="tw:flex tw:flex-col tw:items-center tw:gap-1 tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:p-5 tw:text-center tw:dark:border-slate-700">
                    <FileText className="tw:h-6 tw:w-6 tw:text-slate-400" />
                    <strong className="tw:text-sm">{uploadForm.file?.name || 'Choose source document'}</strong>
                    <small className="tw:text-xs tw:text-slate-400">PDF, DOC, DOCX, or TXT</small>
                  </div>
                  <input
                    id="tma-source-file"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                    className="tw:hidden"
                  />
                </label>

                <Button type="submit" disabled={uploading} className="tw:w-full">
                  {uploading ? <><Loader2 className="tw:h-4 tw:w-4 tw:animate-spin" /> Reading...</> : <><UploadCloud className="tw:h-4 tw:w-4" /> Upload Source</>}
                </Button>
              </form>
            </Card>
          </div>
        </>
      )}

      {activeTab === 'assistant' && (
        <Dialog open={!!duplicateConflict} onOpenChange={(open) => { if (!open) handleKeepExisting(); }}>
          <DialogPopup showClose={false}>
            {duplicateConflict && (
              <>
                <DialogHeader>
                  <DialogTitle>Course already uploaded</DialogTitle>
                </DialogHeader>
                <p className="tw:mt-2 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">
                  <strong>{duplicateConflict.course?.courseCode}</strong>
                  {duplicateConflict.course?.courseName ? ` — ${duplicateConflict.course.courseName}` : ''} already has{' '}
                  {duplicateConflict.existingSources?.length || 0} source{(duplicateConflict.existingSources?.length || 0) === 1 ? '' : 's'} uploaded.
                </p>
                <ul className="tw:mt-3 tw:max-h-40 tw:space-y-2 tw:overflow-y-auto">
                  {(duplicateConflict.existingSources || []).map((item) => (
                    <li key={item._id} className="tw:rounded-xl tw:bg-slate-50 tw:p-2.5 tw:text-sm tw:dark:bg-slate-900">
                      <strong className="tw:block">{item.title}</strong>
                      <span className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{sourceTypeLabels[item.sourceType] || item.sourceType} · {formatDate(item.createdAt)}</span>
                    </li>
                  ))}
                </ul>
                <p className="tw:mt-3 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">Override to replace the existing source with this new one, or keep the existing source and cancel this upload.</p>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleKeepExisting} disabled={uploading}>
                    Keep Existing
                  </Button>
                  <Button type="button" onClick={handleConfirmOverride} disabled={uploading}>
                    {uploading ? <><Loader2 className="tw:h-4 tw:w-4 tw:animate-spin" /> Overriding...</> : 'Override'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogPopup>
        </Dialog>
      )}
    </div>
  );
};

export default AdminTma;
