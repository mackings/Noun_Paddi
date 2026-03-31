import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiExternalLink,
  FiLayers,
  FiLoader,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi';
import SEO from '../components/SEO';
import { trackFeatureVisit } from '../utils/featureTracking';
import {
  fetchFeeCheckerFaculties,
  fetchFeeCheckerLevels,
  fetchFeeCheckerPrograms,
  fetchFeeCheckerSemesters,
} from '../utils/feeCheckerApi';
import './MyFees.css';

const ELECTIVE_STATUSES = new Set(['E', 'ELECTIVE']);

const formatCurrency = (value) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatLevelLabel = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Select level';
  return normalized.endsWith('L') ? normalized : `${normalized}L`;
};

const toAmount = (value) => {
  const numeric = Number(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const toCourseList = (semester) => {
  if (!semester) return [];

  return Object.entries(semester)
    .filter(([key, value]) => /^\d+$/.test(key) && value && typeof value === 'object')
    .map(([key, value]) => {
      const status = String(value.status || '').trim().toUpperCase();
      const unit = Number(value.unit || 0);
      const courseFee = toAmount(value.courseFee);
      const examFee = toAmount(value.examFee);

      return {
        key,
        sn: Number(value.sn || key),
        code: String(value.code || '').replace(/\s+/g, ' ').trim(),
        title: String(value.title || '').replace(/\s+/g, ' ').trim(),
        status,
        unit,
        link: String(value.link || '').trim(),
        courseFee,
        examFee,
        totalFee: courseFee + examFee,
        isElective: ELECTIVE_STATUSES.has(status),
      };
    })
    .sort((a, b) => a.sn - b.sn);
};

const buildSummary = (courses, semesterFee) => {
  const compulsoryCourses = courses.filter((course) => !course.isElective);
  const electiveCourses = courses.filter((course) => course.isElective);
  const compulsoryUnits = compulsoryCourses.reduce((sum, course) => sum + course.unit, 0);
  const electiveUnits = electiveCourses.reduce((sum, course) => sum + course.unit, 0);
  const courseTotal = courses.reduce((sum, course) => sum + course.courseFee, 0);
  const examTotal = courses.reduce((sum, course) => sum + course.examFee, 0);
  const unitsTotal = courses.reduce((sum, course) => sum + course.unit, 0);

  return {
    compulsoryUnits,
    electiveUnits,
    compulsoryCount: compulsoryCourses.length,
    electiveCount: electiveCourses.length,
    courseTotal,
    examTotal,
    semesterFee,
    unitsTotal,
    overallTotal: courseTotal + examTotal + semesterFee,
  };
};

const MyFees = () => {
  const [faculties, setFaculties] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [levels, setLevels] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selection, setSelection] = useState({
    facultyId: '',
    programId: '',
    levelId: '',
    semesterId: '',
  });
  const [selectedElectives, setSelectedElectives] = useState({});
  const [loadingState, setLoadingState] = useState({
    initial: true,
    programs: false,
    levels: false,
    semesters: false,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    trackFeatureVisit('my-fees');
  }, []);

  useEffect(() => {
    let active = true;

    const loadFaculties = async () => {
      try {
        setError('');
        setLoadingState((current) => ({ ...current, initial: true }));
        const response = await fetchFeeCheckerFaculties();
        if (!active) return;
        setFaculties(response);
      } catch (requestError) {
        if (!active) return;
        setError(requestError.message || 'Failed to load faculties.');
      } finally {
        if (active) {
          setLoadingState((current) => ({ ...current, initial: false }));
        }
      }
    };

    loadFaculties();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selection.facultyId) {
      setPrograms([]);
      return undefined;
    }

    let active = true;

    const loadPrograms = async () => {
      try {
        setError('');
        setLoadingState((current) => ({ ...current, programs: true }));
        const response = await fetchFeeCheckerPrograms(selection.facultyId);
        if (!active) return;
        setPrograms(response);
      } catch (requestError) {
        if (!active) return;
        setError(requestError.message || 'Failed to load programmes.');
      } finally {
        if (active) {
          setLoadingState((current) => ({ ...current, programs: false }));
        }
      }
    };

    loadPrograms();

    return () => {
      active = false;
    };
  }, [selection.facultyId]);

  useEffect(() => {
    if (!selection.facultyId || !selection.programId) {
      setLevels([]);
      return undefined;
    }

    let active = true;

    const loadLevels = async () => {
      try {
        setError('');
        setLoadingState((current) => ({ ...current, levels: true }));
        const response = await fetchFeeCheckerLevels(selection.facultyId, selection.programId);
        if (!active) return;
        setLevels(response);
      } catch (requestError) {
        if (!active) return;
        setError(requestError.message || 'Failed to load levels.');
      } finally {
        if (active) {
          setLoadingState((current) => ({ ...current, levels: false }));
        }
      }
    };

    loadLevels();

    return () => {
      active = false;
    };
  }, [selection.facultyId, selection.programId]);

  useEffect(() => {
    if (!selection.facultyId || !selection.programId || !selection.levelId) {
      setSemesters([]);
      return undefined;
    }

    let active = true;

    const loadSemesters = async () => {
      try {
        setError('');
        setLoadingState((current) => ({ ...current, semesters: true }));
        const response = await fetchFeeCheckerSemesters(
          selection.facultyId,
          selection.programId,
          selection.levelId
        );
        if (!active) return;
        setSemesters(response);
      } catch (requestError) {
        if (!active) return;
        setError(requestError.message || 'Failed to load semesters.');
      } finally {
        if (active) {
          setLoadingState((current) => ({ ...current, semesters: false }));
        }
      }
    };

    loadSemesters();

    return () => {
      active = false;
    };
  }, [selection.facultyId, selection.programId, selection.levelId]);

  const selectedFaculty = useMemo(
    () => faculties.find((item) => item.id === selection.facultyId) || null,
    [faculties, selection.facultyId]
  );
  const selectedProgram = useMemo(
    () => programs.find((item) => item.id === selection.programId) || null,
    [programs, selection.programId]
  );
  const selectedLevel = useMemo(
    () => levels.find((item) => item.id === selection.levelId) || null,
    [levels, selection.levelId]
  );
  const selectedSemester = useMemo(
    () => semesters.find((item) => item.id === selection.semesterId) || null,
    [semesters, selection.semesterId]
  );

  const allCourses = useMemo(() => toCourseList(selectedSemester), [selectedSemester]);

  useEffect(() => {
    if (!selectedSemester) {
      setSelectedElectives({});
      return;
    }

    setSelectedElectives((current) => {
      const next = {};

      allCourses.forEach((course) => {
        if (!course.isElective) return;
        next[course.key] = Object.prototype.hasOwnProperty.call(current, course.key)
          ? current[course.key]
          : true;
      });

      return next;
    });
  }, [allCourses, selectedSemester]);

  const visibleCourses = useMemo(
    () => allCourses.filter((course) => !course.isElective || selectedElectives[course.key] !== false),
    [allCourses, selectedElectives]
  );

  const summary = useMemo(
    () => buildSummary(visibleCourses, toAmount(selectedSemester?.fees)),
    [selectedSemester, visibleCourses]
  );

  const handleFacultyChange = (event) => {
    const facultyId = event.target.value;
    setSelection({
      facultyId,
      programId: '',
      levelId: '',
      semesterId: '',
    });
    setPrograms([]);
    setLevels([]);
    setSemesters([]);
    setSelectedElectives({});
  };

  const handleProgramChange = (event) => {
    const programId = event.target.value;
    setSelection((current) => ({
      ...current,
      programId,
      levelId: '',
      semesterId: '',
    }));
    setLevels([]);
    setSemesters([]);
    setSelectedElectives({});
  };

  const handleLevelChange = (event) => {
    const levelId = event.target.value;
    setSelection((current) => ({
      ...current,
      levelId,
      semesterId: '',
    }));
    setSemesters([]);
    setSelectedElectives({});
  };

  const handleSemesterChange = (event) => {
    setSelection((current) => ({
      ...current,
      semesterId: event.target.value,
    }));
  };

  const resetSelections = () => {
    setSelection({
      facultyId: '',
      programId: '',
      levelId: '',
      semesterId: '',
    });
    setPrograms([]);
    setLevels([]);
    setSemesters([]);
    setSelectedElectives({});
    setError('');
  };

  const stepStates = [
    Boolean(selection.facultyId),
    Boolean(selection.programId),
    Boolean(selection.levelId),
    Boolean(selection.semesterId),
  ];

  const isLoading =
    loadingState.initial ||
    loadingState.programs ||
    loadingState.levels ||
    loadingState.semesters;

  return (
    <div className="my-fees-page">
      <SEO
        title="My Fees - NounPaddi"
        description="Check your NOUN fee breakdown by faculty, programme, level, and semester in one responsive page."
        url="/projects/my-fees"
      />

      <div className="container">
        <section className="my-fees-hero">
          <div className="my-fees-hero-copy">
            <p className="my-fees-kicker">Projects Hub</p>
            <h1>My fees</h1>
            <p className="my-fees-lead">
              Pick your faculty, programme, level, and semester to see your current course list,
              school charges, exam fees, and overall payable total in one clean view.
            </p>
            <div className="my-fees-progress">
              {['Faculty', 'Programme', 'Level', 'Semester'].map((label, index) => (
                <div
                  key={label}
                  className={`my-fees-progress-chip ${stepStates[index] ? 'complete' : ''}`}
                >
                  {stepStates[index] ? <FiCheckCircle /> : <span>{index + 1}</span>}
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="my-fees-hero-card">
            <div className="my-fees-hero-card-top">
              <FiShield />
              <div>
                <h2>Live published fee data</h2>
                <p>
                  This page reads the same public dataset used by the BBCNOUN fee checker and
                  refreshes options as you move from faculty to semester.
                </p>
              </div>
            </div>
            <div className="my-fees-hero-meta">
              <div>
                <span>Selected faculty</span>
                <strong>{selectedFaculty?.name || 'Not selected yet'}</strong>
              </div>
              <div>
                <span>Selected programme</span>
                <strong>{selectedProgram?.name || 'Not selected yet'}</strong>
              </div>
            </div>
          </aside>
        </section>

        <section className="my-fees-layout">
          <div className="my-fees-panel my-fees-controls">
            <div className="my-fees-panel-header">
              <div>
                <p className="my-fees-section-kicker">Step-by-step</p>
                <h2>Choose your semester</h2>
              </div>
              <button type="button" className="my-fees-reset" onClick={resetSelections}>
                <FiRefreshCw />
                Reset
              </button>
            </div>

            <div className="my-fees-field-grid">
              <label className="my-fees-field">
                <span>Faculty</span>
                <select
                  value={selection.facultyId}
                  onChange={handleFacultyChange}
                  disabled={loadingState.initial}
                >
                  <option value="">Select faculty</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="my-fees-field">
                <span>Programme</span>
                <select
                  value={selection.programId}
                  onChange={handleProgramChange}
                  disabled={!selection.facultyId || loadingState.programs}
                >
                  <option value="">Select programme</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="my-fees-field">
                <span>Level</span>
                <select
                  value={selection.levelId}
                  onChange={handleLevelChange}
                  disabled={!selection.programId || loadingState.levels}
                >
                  <option value="">Select level</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {formatLevelLabel(level.name)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="my-fees-field">
                <span>Semester</span>
                <select
                  value={selection.semesterId}
                  onChange={handleSemesterChange}
                  disabled={!selection.levelId || loadingState.semesters}
                >
                  <option value="">Select semester</option>
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      Semester {semester.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error && <div className="my-fees-error">{error}</div>}

            <div className="my-fees-selection-summary">
              <div>
                <span>Faculty</span>
                <strong>{selectedFaculty?.name || 'Waiting for selection'}</strong>
              </div>
              <div>
                <span>Programme</span>
                <strong>{selectedProgram?.name || 'Waiting for selection'}</strong>
              </div>
              <div>
                <span>Level</span>
                <strong>{selectedLevel ? formatLevelLabel(selectedLevel.name) : 'Waiting for selection'}</strong>
              </div>
              <div>
                <span>Semester</span>
                <strong>{selectedSemester ? `Semester ${selectedSemester.id}` : 'Waiting for selection'}</strong>
              </div>
            </div>
          </div>

          <aside className="my-fees-panel my-fees-aside">
            <div className="my-fees-panel-header">
              <div>
                <p className="my-fees-section-kicker">Before you submit</p>
                <h2>Elective guide</h2>
              </div>
              <FiLayers className="my-fees-aside-icon" />
            </div>

            <p className="my-fees-aside-copy">
              Compulsory courses stay included. If your semester contains elective courses, leave on
              only the ones you plan to register so the total reflects your own selection.
            </p>

            <div className="my-fees-tip-list">
              <div>
                <strong>Undergraduate:</strong>
                <span>When you see multiple electives, select only the allowed number for your semester.</span>
              </div>
              <div>
                <strong>Postgraduate:</strong>
                <span>Use the elective toggles below if your programme offers optional courses.</span>
              </div>
              <div>
                <strong>Check twice:</strong>
                <span>Compare the result with your portal before making payment decisions.</span>
              </div>
            </div>

            <Link to="/projects/consultation" className="my-fees-side-link">
              Need help with your project too?
              <FiArrowRight />
            </Link>
          </aside>
        </section>

        {isLoading && (
          <div className="my-fees-loading">
            <FiLoader className="spin" />
            <span>Loading fee data...</span>
          </div>
        )}

        {!isLoading && !selectedSemester && (
          <section className="my-fees-empty">
            <FiBookOpen />
            <div>
              <h2>Your fee summary will appear here</h2>
              <p>
                Complete the four selections above to load the semester breakdown, payable totals,
                and course list.
              </p>
            </div>
          </section>
        )}

        {!isLoading && selectedSemester && (
          <>
            <section className="my-fees-summary-grid">
              <article className="my-fees-summary-card highlight">
                <span>Total payable</span>
                <strong>{formatCurrency(summary.overallTotal)}</strong>
                <p>Course fees + exam fees + semester charges</p>
              </article>
              <article className="my-fees-summary-card">
                <span>Semester charges</span>
                <strong>{formatCurrency(summary.semesterFee)}</strong>
                <p>Published semester fee for this selection</p>
              </article>
              <article className="my-fees-summary-card">
                <span>Course fees</span>
                <strong>{formatCurrency(summary.courseTotal)}</strong>
                <p>Based on the currently selected courses</p>
              </article>
              <article className="my-fees-summary-card">
                <span>Exam fees</span>
                <strong>{formatCurrency(summary.examTotal)}</strong>
                <p>Computed from your visible course list</p>
              </article>
            </section>

            <section className="my-fees-results-grid">
              <div className="my-fees-panel my-fees-breakdown">
                <div className="my-fees-panel-header">
                  <div>
                    <p className="my-fees-section-kicker">Current selection</p>
                    <h2>Course and fee breakdown</h2>
                  </div>
                  <div className="my-fees-badges">
                    <span>{summary.unitsTotal} units selected</span>
                    <span>{visibleCourses.length} courses</span>
                  </div>
                </div>

                {String(selectedSemester.bottomText || '').trim() && (
                  <div className="my-fees-note">
                    {selectedSemester.bottomText}
                  </div>
                )}

                <div className="my-fees-mini-stats">
                  <div>
                    <span>Compulsory</span>
                    <strong>{summary.compulsoryUnits} units</strong>
                    <small>{summary.compulsoryCount} courses</small>
                  </div>
                  <div>
                    <span>Elective</span>
                    <strong>{summary.electiveUnits} units</strong>
                    <small>{summary.electiveCount} courses</small>
                  </div>
                </div>

                <div className="my-fees-course-table">
                  <div className="my-fees-course-head">
                    <span>Course</span>
                    <span>Status</span>
                    <span>Units</span>
                    <span>Fees</span>
                    <span>Material</span>
                  </div>

                  {allCourses.map((course) => {
                    const isIncluded = !course.isElective || selectedElectives[course.key] !== false;

                    return (
                      <article
                        key={course.key}
                        className={`my-fees-course-row ${course.isElective ? 'elective' : ''} ${isIncluded ? '' : 'muted'}`}
                      >
                        <div className="my-fees-course-main">
                          <div className="my-fees-course-title-row">
                            {course.isElective ? (
                              <label className="my-fees-elective-toggle">
                                <input
                                  type="checkbox"
                                  checked={isIncluded}
                                  onChange={() => {
                                    setSelectedElectives((current) => ({
                                      ...current,
                                      [course.key]: !(current[course.key] !== false),
                                    }));
                                  }}
                                />
                                <span>{course.code || 'No code'}</span>
                              </label>
                            ) : (
                              <strong>{course.code || 'No code'}</strong>
                            )}
                            {course.isElective && <em>Elective</em>}
                          </div>
                          <p>{course.title || 'Untitled course'}</p>
                        </div>

                        <div className="my-fees-course-meta">
                          <span>{course.status || '-'}</span>
                          <span>{course.unit}</span>
                          <span>{formatCurrency(course.totalFee)}</span>
                          {course.link ? (
                            <a href={course.link} target="_blank" rel="noreferrer">
                              Open
                              <FiExternalLink />
                            </a>
                          ) : (
                            <span className="my-fees-link-muted">No file</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <aside className="my-fees-panel my-fees-side-summary">
                <div className="my-fees-panel-header">
                  <div>
                    <p className="my-fees-section-kicker">Quick recap</p>
                    <h2>Your current view</h2>
                  </div>
                </div>

                <div className="my-fees-recap-list">
                  <div>
                    <span>Faculty</span>
                    <strong>{selectedFaculty?.name}</strong>
                  </div>
                  <div>
                    <span>Programme</span>
                    <strong>{selectedProgram?.name}</strong>
                  </div>
                  <div>
                    <span>Level</span>
                    <strong>{formatLevelLabel(selectedLevel?.name)}</strong>
                  </div>
                  <div>
                    <span>Semester</span>
                    <strong>Semester {selectedSemester.id}</strong>
                  </div>
                </div>

                <div className="my-fees-total-stack">
                  <div>
                    <span>Course total</span>
                    <strong>{formatCurrency(summary.courseTotal)}</strong>
                  </div>
                  <div>
                    <span>Exam total</span>
                    <strong>{formatCurrency(summary.examTotal)}</strong>
                  </div>
                  <div>
                    <span>Semester fee</span>
                    <strong>{formatCurrency(summary.semesterFee)}</strong>
                  </div>
                  <div className="grand-total">
                    <span>Grand total</span>
                    <strong>{formatCurrency(summary.overallTotal)}</strong>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default MyFees;
