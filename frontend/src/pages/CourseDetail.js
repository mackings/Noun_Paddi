import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import { splitSummaryIntoSections, formatLine } from '../utils/formatSummary';
import { trackFeatureVisit } from '../utils/featureTracking';
import SEO from '../components/SEO';
import {
  FiBook,
  FiFileText,
  FiGrid,
  FiShare2,
  FiArrowLeft,
  FiClock,
  FiUser,
  FiAward
} from 'react-icons/fi';
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
  const sectionRefs = useRef([]);
  const readingSessionRef = useRef(null);

  useEffect(() => {
    fetchCourseDetails();
    fetchCourseMaterials();
    trackFeatureVisit('summary');
  }, [courseId]);

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

  const fetchCourseDetails = async () => {
    try {
      const response = await api.get(`/courses/${courseId}`);
      setCourse(response.data.data);
    } catch (error) {
      console.error('Error fetching course details:', error);
    }
  };

  const fetchCourseMaterials = async () => {
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
  };

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
      <div className="course-detail-container">
        <div className="container">
          <div className="course-loading">
            <div className="skeleton-card header">
              <div className="skeleton-icon"></div>
              <div className="skeleton-lines">
                <div className="skeleton-line wide"></div>
                <div className="skeleton-line medium"></div>
                <div className="skeleton-line short"></div>
              </div>
            </div>
            <div className="skeleton-tabs">
              <div className="skeleton-pill"></div>
              <div className="skeleton-pill"></div>
              <div className="skeleton-pill"></div>
            </div>
            <div className="skeleton-content">
              <div className="skeleton-panel">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="skeleton-list-item">
                    <div className="skeleton-line wide"></div>
                    <div className="skeleton-line short"></div>
                  </div>
                ))}
              </div>
              <div className="skeleton-panel">
                <div className="skeleton-line wide"></div>
                <div className="skeleton-line medium"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line short"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="course-detail-container">
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
      <div className="container">
        {/* Breadcrumb */}
        <Link to="/explore" className="breadcrumb">
          <FiArrowLeft /> Back to Courses
        </Link>

        {/* Course Header */}
        {course && (
          <div className="course-detail-header">
            <div className="course-detail-icon">
              <FiBook size={40} />
            </div>
            <div>
              <div className="course-code-badge">{course.courseCode}</div>
              <h1>{course.courseName}</h1>
              <div className="course-meta">
                <span>
                  <FiAward size={16} />
                  {course.creditUnits || 3} Credit Units
                </span>
                <span>
                  <FiFileText size={16} />
                  {materials.length} {materials.length === 1 ? 'Material' : 'Materials'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="detail-tabs">
          <button
            className={`detail-tab ${activeTab === 'summaries' ? 'active' : ''}`}
            onClick={() => setActiveTab('summaries')}
          >
            <FiFileText />
            Study Summaries
          </button>
          <Link to={`/practice?courseId=${courseId}`} className="detail-tab">
            <FiGrid />
            Practice Questions
          </Link>
        </div>

        {/* Content */}
        {activeTab === 'summaries' && (
          <div className="summaries-content">
            {materials.length === 0 ? (
              <div className="empty-state">
                <FiFileText size={64} />
                <h3>No Materials Available</h3>
                <p>There are no study materials uploaded for this course yet.</p>
              </div>
            ) : (
              <div className="summaries-grid">
                {/* Materials List */}
                <div className="materials-sidebar">
                  <h3>Course Materials</h3>
                  <div className="materials-list">
                    {materials.map((material) => (
                      <button
                        key={material._id}
                        className={`material-item ${selectedMaterial?._id === material._id ? 'active' : ''} ${!material.hasSummary ? 'no-summary' : ''}`}
                        onClick={() => setSelectedMaterial(material)}
                      >
                        <div className="material-item-header">
                          <FiFileText />
                          <span className="material-title">{material.title}</span>
                        </div>
                        <div className="material-item-meta">
                          <span className="material-date">
                            <FiClock size={12} />
                            {formatDate(material.createdAt)}
                          </span>
                          {material.hasSummary ? (
                            <span className="summary-badge">Has Summary</span>
                          ) : (
                            <span className="no-summary-badge">No Summary</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary Display */}
                <div className="summary-display">
                  {selectedMaterial ? (
                    <>
                      <div className="summary-header">
                        <h2>{selectedMaterial.title}</h2>
                        <div className="summary-actions">
                          <button
                            type="button"
                            className="btn btn-outline-primary"
                            onClick={handleSharePdf}
                            disabled={shareState.loading}
                          >
                            <FiShare2 />
                            {shareState.loading ? 'Creating Link...' : 'Share PDF'}
                          </button>
                        </div>
                      </div>
                      {shareState.message && (
                        <div className={`alert ${shareState.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                          {shareState.message}
                        </div>
                      )}
                      {readingStatus && (
                        <div className="alert alert-success">
                          {readingStatus}
                        </div>
                      )}

                      <div className="summary-meta">
                        <span>
                          <FiUser size={14} />
                          Uploaded by {selectedMaterial.uploadedBy?.name || 'Admin'}
                        </span>
                        <span>
                          <FiClock size={14} />
                          {formatDate(selectedMaterial.createdAt)}
                        </span>
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
                                    const cleanedText = formatLine(trimmedLine.replace(/^[•\-\*]\s*/, ''));
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
                        <div className="no-summary-placeholder">
                          <FiFileText size={48} />
                          <h3>No Summary Available</h3>
                          <p>A study summary has not been created for this material yet.</p>
                          <p>You can still download and read the original PDF file.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="select-material-placeholder">
                      <FiFileText size={64} />
                      <h3>Select a Material</h3>
                      <p>Choose a material from the list to view its system-generated summary.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseDetail;
