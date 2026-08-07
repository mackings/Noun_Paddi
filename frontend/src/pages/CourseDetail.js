import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import { splitSummaryIntoSections, formatLine } from '../utils/formatSummary';
import { trackFeatureVisit } from '../utils/featureTracking';
import SEO from '../components/SEO';
import {
  BookOpen,
  FileText,
  LayoutGrid,
  Share2,
  Clock,
  User,
  Award,
  Loader2,
} from 'lucide-react';
import ShellHeader from '../shell/ShellHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
// The dense summary prose (module/unit titles, key terms, bullets, numbered lists) keeps
// its existing typographic styling here — a distinct, purely-text-formatting concern
// from the page chrome restyled below with the new design system.
import './CourseDetail.css';

const READING_ACTIVITY_TIMEOUT_MS = 15000;
const READING_TICK_MS = 1000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const estimateRequiredActiveSeconds = (wordCount) => {
  const expectedSeconds = wordCount > 0 ? Math.round((wordCount / 220) * 60) : 45;
  return clamp(Math.round(expectedSeconds * 0.45), 45, 240);
};

const CourseDetail = () => {
  const { courseId } = useParams();
  const location = useLocation();
  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summaries');
  const [shareState, setShareState] = useState({ loading: false, message: '', type: '' });
  const [readingStatus, setReadingStatus] = useState('');
  const summaryContentRef = useRef(null);
  const summaryTabsRef = useRef(null);
  const sectionRefs = useRef([]);
  const readingSessionRef = useRef(null);

  useEffect(() => {
    document.body.classList.add('disable-course-print');

    const handlePrintShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === 'p') {
        event.preventDefault();
        event.stopPropagation();
        setShareState({
          loading: false,
          message: 'Printing is disabled for this summary page.',
          type: 'error'
        });
      }
    };

    const handleBeforePrint = () => {
      setShareState({
        loading: false,
        message: 'Printing is disabled for this summary page.',
        type: 'error'
      });
    };

    window.addEventListener('keydown', handlePrintShortcut, true);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      document.body.classList.remove('disable-course-print');
      window.removeEventListener('keydown', handlePrintShortcut, true);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, []);

  const summarySections = useMemo(() => {
    if (!selectedMaterial?.hasSummary || !selectedMaterial?.summary) {
      return [];
    }
    return splitSummaryIntoSections(selectedMaterial.summary);
  }, [selectedMaterial?.hasSummary, selectedMaterial?.summary]);
  const selectedMaterialId = selectedMaterial?._id || null;

  useEffect(() => {
    const token = localStorage.getItem('token');
    const material = selectedMaterial;
    const container = summaryContentRef.current;
    const canTrack = Boolean(
      token &&
      activeTab === 'summaries' &&
      material?._id &&
      material?.hasSummary &&
      container &&
      summarySections.length > 0
    );

    if (!canTrack) {
      setReadingStatus('');
      return;
    }

    sectionRefs.current = sectionRefs.current.slice(0, summarySections.length);
    const wordCount = String(material.summary || '').trim().split(/\s+/).filter(Boolean).length;
    const requiredActiveSeconds = estimateRequiredActiveSeconds(wordCount);

    const session = {
      sessionId: `${material._id}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
      materialId: material._id,
      startedAt: Date.now(),
      activeMs: 0,
      lastInteractionAt: Date.now(),
      interactionCount: 0,
      maxScrollDepth: 0,
      seenSections: new Set(),
      submitted: false,
      wordCount,
      requiredActiveSeconds,
    };
    readingSessionRef.current = session;
    setReadingStatus(`Reading progress is being tracked. Minimum active reading time: ${requiredActiveSeconds}s.`);

    const markInteraction = () => {
      if (!readingSessionRef.current) return;
      const now = Date.now();
      readingSessionRef.current.lastInteractionAt = now;
      readingSessionRef.current.interactionCount += 1;
    };

    const updateScrollDepth = () => {
      if (!readingSessionRef.current || !container) return;
      const scrollableHeight = Math.max(container.scrollHeight - container.clientHeight, 0);
      const viewportDepth = container.scrollHeight > 0
        ? (container.scrollTop + container.clientHeight) / container.scrollHeight
        : 0;
      const depthByScroll = scrollableHeight > 0 ? container.scrollTop / scrollableHeight : 1;
      const depth = Math.max(depthByScroll, viewportDepth);
      readingSessionRef.current.maxScrollDepth = Math.max(
        readingSessionRef.current.maxScrollDepth,
        clamp(depth, 0, 1)
      );
    };

    const maybeSubmitCompletion = async () => {
      const current = readingSessionRef.current;
      if (!current || current.submitted) return;

      const totalSections = summarySections.length;
      const sectionCoverage = totalSections > 0 ? current.seenSections.size / totalSections : 0;
      const activeSeconds = Math.floor(current.activeMs / 1000);

      const complete =
        sectionCoverage >= 0.9 &&
        current.maxScrollDepth >= 0.95 &&
        activeSeconds >= current.requiredActiveSeconds &&
        current.interactionCount >= 8;

      if (!complete) return;

      current.submitted = true;
      try {
        const response = await api.post('/gamification/reading/complete', {
          courseId,
          materialId: current.materialId,
          metrics: {
            sessionId: current.sessionId,
            wordCount: current.wordCount,
            activeSeconds,
            scrollDepth: Number(current.maxScrollDepth.toFixed(4)),
            sectionCoverage: Number(sectionCoverage.toFixed(4)),
            interactionCount: current.interactionCount,
          },
        });

        const result = response?.data?.data;
        if (result?.alreadyAwarded) {
          setReadingStatus('Summary already counted for points.');
        } else if ((result?.pointsAwarded || 0) > 0) {
          setReadingStatus(`Summary completed. +${result.pointsAwarded} points added.`);
        } else {
          setReadingStatus('Summary completion saved.');
        }
      } catch (error) {
        current.submitted = false;
        console.error('Failed to submit reading completion:', error);
      }
    };

    const handleScroll = () => {
      markInteraction();
      updateScrollDepth();
      maybeSubmitCompletion();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('wheel', markInteraction, { passive: true });
    container.addEventListener('touchmove', markInteraction, { passive: true });
    container.addEventListener('mousemove', markInteraction);
    container.addEventListener('keydown', markInteraction);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!readingSessionRef.current) return;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
            const index = Number(entry.target.getAttribute('data-section-index'));
            if (Number.isFinite(index)) {
              readingSessionRef.current.seenSections.add(index);
            }
          }
        });
        maybeSubmitCompletion();
      },
      {
        root: container,
        threshold: [0.65],
      }
    );

    sectionRefs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    const ticker = window.setInterval(() => {
      const current = readingSessionRef.current;
      if (!current) return;
      const now = Date.now();
      if (
        document.visibilityState === 'visible' &&
        now - current.lastInteractionAt <= READING_ACTIVITY_TIMEOUT_MS
      ) {
        current.activeMs += READING_TICK_MS;
      }
      maybeSubmitCompletion();
    }, READING_TICK_MS);

    updateScrollDepth();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', markInteraction);
      container.removeEventListener('touchmove', markInteraction);
      container.removeEventListener('mousemove', markInteraction);
      container.removeEventListener('keydown', markInteraction);
      observer.disconnect();
      window.clearInterval(ticker);
      readingSessionRef.current = null;
    };
  }, [activeTab, courseId, selectedMaterial, summarySections]);

  const courseSeo = useMemo(() => {
    if (!course) return null;

    const descriptionParts = [
      `${course.courseCode} ${course.courseName}`,
      `${materials.length} material${materials.length === 1 ? '' : 's'} available`,
    ];

    if (selectedMaterial?.title) {
      descriptionParts.push(`Current summary: ${selectedMaterial.title}`);
    }

    return {
      title: `${course.courseCode} ${course.courseName} Summary - NounPaddi`,
      description: `${descriptionParts.join('. ')}. Access NOUN course summaries and study materials on NounPaddi.`,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: `${course.courseCode} ${course.courseName}`,
        description: `${course.courseName} study summaries and course materials on NounPaddi.`,
        provider: {
          '@type': 'EducationalOrganization',
          name: 'NounPaddi',
        },
      },
    };
  }, [course, materials.length, selectedMaterial?.title]);

  const blockCopy = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const blockCopyShortcuts = (event) => {
    if (event.ctrlKey || event.metaKey) {
      const key = event.key?.toLowerCase();
      if (key === 'c' || key === 'x' || key === 'v' || key === 'a' || key === 's' || key === 'p') {
        event.preventDefault();
        event.stopPropagation();
      }
    }
  };

  const fetchCourseDetails = useCallback(async () => {
    try {
      const response = await api.get(`/courses/${courseId}`);
      setCourse(response.data.data);
    } catch (error) {
      console.error('Error fetching course details:', error);
    }
  }, [courseId]);

  const fetchCourseMaterials = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/materials/course/${courseId}`);
      const materialList = Array.isArray(response.data.data) ? response.data.data : [];
      setMaterials(materialList);

      const params = new URLSearchParams(location.search);
      const requestedMaterialId = params.get('materialId');
      const requestedMaterial = requestedMaterialId
        ? materialList.find(m => m._id === requestedMaterialId)
        : null;

      // Auto-select requested material, then first with summary, then first item
      const materialWithSummary = materialList.find(m => m.hasSummary && m.summary);
      setSelectedMaterial(requestedMaterial || materialWithSummary || materialList[0] || null);
    } catch (error) {
      console.error('Error fetching course materials:', error);
    } finally {
      setLoading(false);
    }
  }, [courseId, location.search]);

  useEffect(() => {
    fetchCourseDetails();
    fetchCourseMaterials();
    trackFeatureVisit('summary');
  }, [fetchCourseDetails, fetchCourseMaterials]);

  useEffect(() => {
    if (activeTab !== 'summaries' || !selectedMaterialId) return;

    window.requestAnimationFrame(() => {
      summaryTabsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      if (summaryContentRef.current) {
        summaryContentRef.current.scrollTop = 0;
      }
    });
  }, [activeTab, selectedMaterialId]);

  const handleSharePdf = async () => {
    if (!selectedMaterial?._id) return;

    try {
      setShareState({ loading: true, message: '', type: '' });
      const response = await api.post(`/share/materials/${selectedMaterial._id}`);
      const shareUrl = response.data?.data?.shareUrl;

      if (!shareUrl) {
        setShareState({ loading: false, message: 'Unable to create share link.', type: 'error' });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareState({ loading: false, message: 'Share link copied to clipboard.', type: 'success' });
      } else {
        window.prompt('Copy this share link:', shareUrl);
        setShareState({ loading: false, message: 'Share link ready to copy.', type: 'success' });
      }
    } catch (error) {
      setShareState({
        loading: false,
        message: error.response?.data?.message || 'Failed to create share link.',
        type: 'error'
      });
    }
  };

  if (loading) {
    return (
      <div className="np-shell">
        <ShellHeader title="Course" />
        <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
          <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
          <p className="tw:text-sm">Loading course...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="np-shell">
      {courseSeo && (
        <SEO
          title={courseSeo.title}
          description={courseSeo.description}
          url={`/course/${courseId}`}
          keywords={`${course?.courseCode || ''}, ${course?.courseName || ''}, NOUN summary, course materials`}
          robots="index, follow"
          structuredData={courseSeo.structuredData}
        />
      )}
      <ShellHeader title={course?.courseCode || 'Course'} />

      <div className="tw:space-y-4 tw:p-4">
        {course && (
          <Card className="tw:flex tw:items-start tw:gap-3 tw:p-5">
            <span className="tw:flex tw:h-12 tw:w-12 tw:flex-none tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
              <BookOpen className="tw:h-6 tw:w-6" />
            </span>
            <div>
              <p className="tw:text-xs tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{course.courseCode}</p>
              <h1 className="tw:font-heading tw:text-lg tw:font-bold tw:tracking-tight">{course.courseName}</h1>
              <div className="tw:mt-2 tw:flex tw:flex-wrap tw:gap-3 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                <span className="tw:flex tw:items-center tw:gap-1"><Award className="tw:h-3.5 tw:w-3.5" /> {course.creditUnits || 3} Credit Units</span>
                <span className="tw:flex tw:items-center tw:gap-1"><FileText className="tw:h-3.5 tw:w-3.5" /> {materials.length} {materials.length === 1 ? 'Material' : 'Materials'}</span>
              </div>
            </div>
          </Card>
        )}

        <div ref={summaryTabsRef} className="tw:flex tw:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('summaries')}
            className={cn(
              'tw:flex tw:flex-1 tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-xl tw:border tw:px-3 tw:py-2.5 tw:text-sm tw:font-semibold tw:transition-colors',
              activeTab === 'summaries'
                ? 'tw:border-brand-600 tw:bg-brand-600 tw:text-white'
                : 'tw:border-slate-200 tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300',
            )}
          >
            <FileText className="tw:h-4 tw:w-4" /> Study Summaries
          </button>
          <Link
            to={`/practice?courseId=${courseId}`}
            className="tw:flex tw:flex-1 tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-xl tw:border tw:border-slate-200 tw:px-3 tw:py-2.5 tw:text-sm tw:font-semibold tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300"
          >
            <LayoutGrid className="tw:h-4 tw:w-4" /> Practice Exam
          </Link>
        </div>

        {activeTab === 'summaries' && (
          <>
            {materials.length === 0 ? (
              <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
                <FileText className="tw:h-10 tw:w-10 tw:text-slate-300 tw:dark:text-slate-600" />
                <h3 className="tw:font-heading tw:text-sm tw:font-bold">No Materials Available</h3>
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">There are no study materials uploaded for this course yet.</p>
              </Card>
            ) : (
              <div className="tw:space-y-4">
                <div className="tw:space-y-2">
                  <h3 className="tw:font-heading tw:text-sm tw:font-bold">Course Materials</h3>
                  <div className="tw:space-y-2">
                    {materials.map((material) => (
                      <button
                        key={material._id}
                        type="button"
                        onClick={() => setSelectedMaterial(material)}
                        className={cn(
                          'tw:block tw:w-full tw:rounded-xl tw:border tw:p-3 tw:text-left tw:transition-colors',
                          selectedMaterial?._id === material._id
                            ? 'tw:border-brand-500 tw:bg-brand-50 tw:dark:bg-brand-950/40'
                            : 'tw:border-slate-200 tw:dark:border-slate-800',
                        )}
                      >
                        <div className="tw:flex tw:items-center tw:gap-2">
                          <FileText className="tw:h-4 tw:w-4 tw:flex-none tw:text-brand-600 tw:dark:text-brand-400" />
                          <span className="tw:truncate tw:text-sm tw:font-semibold">{material.title}</span>
                        </div>
                        <div className="tw:mt-1.5 tw:flex tw:items-center tw:justify-between">
                          <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:text-slate-400">
                            <Clock className="tw:h-3 tw:w-3" /> {formatDate(material.createdAt)}
                          </span>
                          <span
                            className={cn(
                              'tw:rounded-full tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold',
                              material.hasSummary
                                ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                                : 'tw:bg-slate-100 tw:text-slate-500 tw:dark:bg-slate-800 tw:dark:text-slate-400',
                            )}
                          >
                            {material.hasSummary ? 'Has Summary' : 'No Summary'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Card className="tw:p-4">
                  {selectedMaterial ? (
                    <>
                      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
                        <h2 className="tw:font-heading tw:text-base tw:font-bold">{selectedMaterial.title}</h2>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSharePdf}
                          disabled={shareState.loading}
                          className="tw:flex-none"
                        >
                          <Share2 className="tw:h-3.5 tw:w-3.5" /> {shareState.loading ? 'Creating...' : 'Share PDF'}
                        </Button>
                      </div>
                      {shareState.message && (
                        <div
                          className={cn(
                            'tw:mt-3 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm',
                            shareState.type === 'success'
                              ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                              : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
                          )}
                        >
                          {shareState.message}
                        </div>
                      )}
                      {readingStatus && (
                        <div className="tw:mt-3 tw:rounded-xl tw:bg-emerald-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300">
                          {readingStatus}
                        </div>
                      )}

                      <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-3 tw:border-b tw:border-slate-100 tw:pb-3 tw:text-xs tw:text-slate-500 tw:dark:border-slate-800 tw:dark:text-slate-400">
                        <span className="tw:flex tw:items-center tw:gap-1"><User className="tw:h-3.5 tw:w-3.5" /> Uploaded by {selectedMaterial.uploadedBy?.name || 'Admin'}</span>
                        <span className="tw:flex tw:items-center tw:gap-1"><Clock className="tw:h-3.5 tw:w-3.5" /> {formatDate(selectedMaterial.createdAt)}</span>
                      </div>

                      {selectedMaterial.hasSummary ? (
                        <div
                          className="summary-content"
                          ref={summaryContentRef}
                          onCopy={blockCopy}
                          onCut={blockCopy}
                          onPaste={blockCopy}
                          onContextMenu={blockCopy}
                          onKeyDown={blockCopyShortcuts}
                          tabIndex={0}
                        >
                          {summarySections.map((section, index) => (
                            <div
                              key={index}
                              className="summary-section"
                              data-section-index={index}
                              ref={(node) => {
                                sectionRefs.current[index] = node;
                              }}
                            >
                              {section.title && <h3 className="section-title">{formatLine(section.title)}</h3>}
                              <div className="section-content">
                                {section.content.split('\n').map((line, lineIndex) => {
                                  const trimmedLine = line.trim();
                                  if (!trimmedLine) return null;

                                  const cleanedLine = formatLine(trimmedLine);
                                  const moduleMatch = cleanedLine.match(/^Module\s+\d+\s*:/i);
                                  const unitMatch = cleanedLine.match(/^Unit\s+\d+\s*:/i);
                                  const simpleMatch = cleanedLine.match(/^In simple terms[:,]/i);
                                  const termMatch = trimmedLine.match(/^\*\*(.+?)\*\*:\s*(.+)$/);

                                  if (moduleMatch) {
                                    return (
                                      <div key={lineIndex} className="module-title">
                                        {cleanedLine}
                                      </div>
                                    );
                                  }

                                  if (unitMatch) {
                                    return (
                                      <div key={lineIndex} className="unit-title">
                                        {cleanedLine}
                                      </div>
                                    );
                                  }

                                  if (simpleMatch) {
                                    return (
                                      <p key={lineIndex} className="simple-explain">
                                        {cleanedLine}
                                      </p>
                                    );
                                  }

                                  if (termMatch) {
                                    return (
                                      <p key={lineIndex} className="key-term">
                                        <span className="term">{formatLine(termMatch[1])}:</span> {formatLine(termMatch[2])}
                                      </p>
                                    );
                                  }

                                  // Check if line is a bullet point
                                  if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
                                    const cleanedText = formatLine(trimmedLine.replace(/^[-•*]\s*/, ''));
                                    if (!cleanedText || cleanedText === '-' || cleanedText === '--') {
                                      return null;
                                    }
                                    const bulletTermMatch = cleanedText.match(/^([^:]{2,80}):\s*(.+)$/);
                                    return (
                                      <div key={lineIndex} className="bullet-point">
                                        {bulletTermMatch ? (
                                          <div className="bullet-block">
                                            <div className="term">{bulletTermMatch[1]}:</div>
                                            <div className="bullet-body">{bulletTermMatch[2]}</div>
                                          </div>
                                        ) : (
                                          cleanedText
                                        )}
                                      </div>
                                    );
                                  }

                                  // Check if line is a numbered list
                                  const numberedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
                                  if (numberedMatch) {
                                    const number = trimmedLine.match(/^\d+\./)[0];
                                    const content = formatLine(numberedMatch[1]);
                                    return (
                                      <div key={lineIndex} className="numbered-item">
                                        <span className="number">{number}</span> {content}
                                      </div>
                                    );
                                  }

                                  // Regular paragraph
                                  return <p key={lineIndex}>{formatLine(trimmedLine)}</p>;
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-10 tw:text-center">
                          <FileText className="tw:h-8 tw:w-8 tw:text-slate-300 tw:dark:text-slate-600" />
                          <h3 className="tw:font-heading tw:text-sm tw:font-bold">No Summary Available</h3>
                          <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">A study summary has not been created for this material yet.</p>
                          <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">You can still download and read the original PDF file.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-10 tw:text-center">
                      <FileText className="tw:h-10 tw:w-10 tw:text-slate-300 tw:dark:text-slate-600" />
                      <h3 className="tw:font-heading tw:text-sm tw:font-bold">Select a Material</h3>
                      <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Choose a material from the list to view its system-generated summary.</p>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CourseDetail;
