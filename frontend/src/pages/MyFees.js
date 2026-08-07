import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import SEO from '../components/SEO';
import { trackFeatureVisit } from '../utils/featureTracking';
import {
  fetchFeeCheckerFaculties,
  fetchFeeCheckerLevels,
  fetchFeeCheckerPrograms,
  fetchFeeCheckerSemesters,
} from '../utils/feeCheckerApi';
import ShellHeader from '../shell/ShellHeader';
import { Card, CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';

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

  const selectClass = 'tw:h-11 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:disabled:opacity-50 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';

  return (
    <div className="np-shell">
      <SEO
        title="My Fees - NounPaddi"
        description="Check your NOUN fee breakdown by faculty, programme, level, and semester in one responsive page."
        url="/projects/my-fees"
      />
      <ShellHeader title="My Fees" />

      <div className="tw:space-y-4 tw:p-4">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">Projects Hub</p>
          <h1 className="tw:font-heading tw:mt-1 tw:text-xl tw:font-bold tw:tracking-tight">My fees</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">
            Pick your faculty, programme, level, and semester to see your current course list, school charges, exam fees, and overall payable total.
          </p>
          <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
            {['Faculty', 'Programme', 'Level', 'Semester'].map((label, index) => (
              <span
                key={label}
                className={cn(
                  'tw:flex tw:items-center tw:gap-1.5 tw:rounded-full tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-semibold',
                  stepStates[index]
                    ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                    : 'tw:bg-slate-100 tw:text-slate-500 tw:dark:bg-slate-800 tw:dark:text-slate-400',
                )}
              >
                {stepStates[index] ? <CheckCircle2 className="tw:h-3 tw:w-3" /> : <span>{index + 1}</span>}
                {label}
              </span>
            ))}
          </div>
        </div>

        <Card className="tw:flex tw:items-start tw:gap-3 tw:p-4">
          <ShieldCheck className="tw:h-6 tw:w-6 tw:flex-none tw:text-brand-600 tw:dark:text-brand-400" />
          <div>
            <h2 className="tw:font-heading tw:text-sm tw:font-bold">Live published fee data</h2>
            <p className="tw:mt-1 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
              This page reads the same public dataset used by the BBCNOUN fee checker and refreshes options as you move from faculty to semester.
            </p>
            <div className="tw:mt-2 tw:space-y-1 tw:text-xs">
              <p><span className="tw:text-slate-400">Selected faculty:</span> <strong>{selectedFaculty?.name || 'Not selected yet'}</strong></p>
              <p><span className="tw:text-slate-400">Selected programme:</span> <strong>{selectedProgram?.name || 'Not selected yet'}</strong></p>
            </div>
          </div>
        </Card>

        <Card>
          <CardContent className="tw:space-y-4 tw:p-5">
            <div className="tw:flex tw:items-center tw:justify-between">
              <div>
                <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">Step-by-step</p>
                <h2 className="tw:font-heading tw:text-base tw:font-bold">Choose your semester</h2>
              </div>
              <button type="button" onClick={resetSelections} className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
                <RefreshCw className="tw:h-3.5 tw:w-3.5" /> Reset
              </button>
            </div>

            <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Faculty</span>
                <select value={selection.facultyId} onChange={handleFacultyChange} disabled={loadingState.initial} className={selectClass}>
                  <option value="">Select faculty</option>
                  {faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
                </select>
              </label>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Programme</span>
                <select value={selection.programId} onChange={handleProgramChange} disabled={!selection.facultyId || loadingState.programs} className={selectClass}>
                  <option value="">Select programme</option>
                  {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                </select>
              </label>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Level</span>
                <select value={selection.levelId} onChange={handleLevelChange} disabled={!selection.programId || loadingState.levels} className={selectClass}>
                  <option value="">Select level</option>
                  {levels.map((level) => <option key={level.id} value={level.id}>{formatLevelLabel(level.name)}</option>)}
                </select>
              </label>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Semester</span>
                <select value={selection.semesterId} onChange={handleSemesterChange} disabled={!selection.levelId || loadingState.semesters} className={selectClass}>
                  <option value="">Select semester</option>
                  {semesters.map((semester) => <option key={semester.id} value={semester.id}>Semester {semester.id}</option>)}
                </select>
              </label>
            </div>

            {error && <div className="tw:rounded-xl tw:bg-red-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">{error}</div>}
          </CardContent>
        </Card>

        <Card className="tw:space-y-3 tw:p-4">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Layers className="tw:h-5 tw:w-5 tw:flex-none tw:text-brand-600 tw:dark:text-brand-400" />
            <div>
              <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">Before you submit</p>
              <h2 className="tw:font-heading tw:text-sm tw:font-bold">Elective guide</h2>
            </div>
          </div>
          <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
            Compulsory courses stay included. If your semester contains elective courses, leave on only the ones you plan to register so the total reflects your own selection.
          </p>
          <div className="tw:space-y-1.5 tw:text-xs tw:text-slate-600 tw:dark:text-slate-300">
            <p><strong>Undergraduate:</strong> When you see multiple electives, select only the allowed number for your semester.</p>
            <p><strong>Postgraduate:</strong> Use the elective toggles below if your programme offers optional courses.</p>
            <p><strong>Check twice:</strong> Compare the result with your portal before making payment decisions.</p>
          </div>
          <Link to="/projects/consultation" className="tw:flex tw:w-fit tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
            Need help with your project too? <ArrowRight className="tw:h-3.5 tw:w-3.5" />
          </Link>
        </Card>

        {isLoading && (
          <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
            <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
            <p className="tw:text-sm">Loading fee data...</p>
          </div>
        )}

        {!isLoading && !selectedSemester && (
          <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
            <BookOpen className="tw:h-8 tw:w-8 tw:text-slate-300 tw:dark:text-slate-600" />
            <h2 className="tw:font-heading tw:text-sm tw:font-bold">Your fee summary will appear here</h2>
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
              Complete the four selections above to load the semester breakdown, payable totals, and course list.
            </p>
          </Card>
        )}

        {!isLoading && selectedSemester && (
          <>
            <div className="tw:grid tw:grid-cols-2 tw:gap-3">
              <Card className="tw:col-span-2 tw:bg-brand-600 tw:p-4 tw:text-white tw:border-none">
                <span className="tw:text-xs tw:text-brand-100">Total payable</span>
                <p className="tw:font-heading tw:text-2xl tw:font-bold">{formatCurrency(summary.overallTotal)}</p>
                <p className="tw:text-xs tw:text-brand-100">Course fees + exam fees + semester charges</p>
              </Card>
              <Card className="tw:p-4">
                <span className="tw:text-xs tw:text-slate-400">Semester charges</span>
                <p className="tw:font-heading tw:text-lg tw:font-bold">{formatCurrency(summary.semesterFee)}</p>
              </Card>
              <Card className="tw:p-4">
                <span className="tw:text-xs tw:text-slate-400">Course fees</span>
                <p className="tw:font-heading tw:text-lg tw:font-bold">{formatCurrency(summary.courseTotal)}</p>
              </Card>
              <Card className="tw:col-span-2 tw:p-4">
                <span className="tw:text-xs tw:text-slate-400">Exam fees</span>
                <p className="tw:font-heading tw:text-lg tw:font-bold">{formatCurrency(summary.examTotal)}</p>
              </Card>
            </div>

            <Card>
              <CardContent className="tw:space-y-4 tw:p-5">
                <div className="tw:flex tw:items-center tw:justify-between">
                  <div>
                    <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">Current selection</p>
                    <h2 className="tw:font-heading tw:text-base tw:font-bold">Course and fee breakdown</h2>
                  </div>
                </div>
                <div className="tw:flex tw:gap-2">
                  <span className="tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300">{summary.unitsTotal} units selected</span>
                  <span className="tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300">{visibleCourses.length} courses</span>
                </div>

                {String(selectedSemester.bottomText || '').trim() && (
                  <p className="tw:rounded-xl tw:bg-amber-100 tw:px-3.5 tw:py-2.5 tw:text-xs tw:text-amber-700 tw:dark:bg-amber-500/15 tw:dark:text-amber-300">{selectedSemester.bottomText}</p>
                )}

                <div className="tw:grid tw:grid-cols-2 tw:gap-3">
                  <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
                    <span className="tw:text-xs tw:text-slate-400">Compulsory</span>
                    <p className="tw:font-heading tw:text-base tw:font-bold">{summary.compulsoryUnits} units</p>
                    <small className="tw:text-xs tw:text-slate-400">{summary.compulsoryCount} courses</small>
                  </div>
                  <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-800/60">
                    <span className="tw:text-xs tw:text-slate-400">Elective</span>
                    <p className="tw:font-heading tw:text-base tw:font-bold">{summary.electiveUnits} units</p>
                    <small className="tw:text-xs tw:text-slate-400">{summary.electiveCount} courses</small>
                  </div>
                </div>

                <div className="tw:space-y-2">
                  {allCourses.map((course) => {
                    const isIncluded = !course.isElective || selectedElectives[course.key] !== false;

                    return (
                      <div
                        key={course.key}
                        className={cn(
                          'tw:rounded-xl tw:border tw:p-3',
                          course.isElective ? 'tw:border-brand-200 tw:dark:border-brand-900' : 'tw:border-slate-200 tw:dark:border-slate-800',
                          !isIncluded && 'tw:opacity-50',
                        )}
                      >
                        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
                          {course.isElective ? (
                            <label className="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-semibold">
                              <input
                                type="checkbox"
                                checked={isIncluded}
                                onChange={() => {
                                  setSelectedElectives((current) => ({
                                    ...current,
                                    [course.key]: !(current[course.key] !== false),
                                  }));
                                }}
                                className="tw:h-4 tw:w-4 tw:accent-brand-600"
                              />
                              {course.code || 'No code'}
                            </label>
                          ) : (
                            <strong className="tw:text-sm">{course.code || 'No code'}</strong>
                          )}
                          {course.isElective && <em className="tw:text-[10px] tw:font-semibold tw:text-brand-600 tw:not-italic tw:dark:text-brand-400">Elective</em>}
                        </div>
                        <p className="tw:mt-1 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{course.title || 'Untitled course'}</p>
                        <div className="tw:mt-2 tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                          <span>{course.status || '-'}</span>
                          <span>{course.unit} unit{course.unit === 1 ? '' : 's'}</span>
                          <span className="tw:font-semibold tw:text-slate-700 tw:dark:text-slate-200">{formatCurrency(course.totalFee)}</span>
                          {course.link ? (
                            <a href={course.link} target="_blank" rel="noreferrer" className="tw:flex tw:items-center tw:gap-1 tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
                              Open <ExternalLink className="tw:h-3 tw:w-3" />
                            </a>
                          ) : (
                            <span className="tw:text-slate-300 tw:dark:text-slate-600">No file</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="tw:space-y-4 tw:p-5">
                <div>
                  <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">Quick recap</p>
                  <h2 className="tw:font-heading tw:text-base tw:font-bold">Your current view</h2>
                </div>

                <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:text-xs">
                  <p><span className="tw:text-slate-400">Faculty:</span> <strong className="tw:block tw:text-sm">{selectedFaculty?.name}</strong></p>
                  <p><span className="tw:text-slate-400">Programme:</span> <strong className="tw:block tw:text-sm">{selectedProgram?.name}</strong></p>
                  <p><span className="tw:text-slate-400">Level:</span> <strong className="tw:block tw:text-sm">{formatLevelLabel(selectedLevel?.name)}</strong></p>
                  <p><span className="tw:text-slate-400">Semester:</span> <strong className="tw:block tw:text-sm">Semester {selectedSemester.id}</strong></p>
                </div>

                <div className="tw:space-y-1.5 tw:border-t tw:border-slate-100 tw:pt-3 tw:text-sm tw:dark:border-slate-800">
                  <div className="tw:flex tw:justify-between"><span className="tw:text-slate-500 tw:dark:text-slate-400">Course total</span><strong>{formatCurrency(summary.courseTotal)}</strong></div>
                  <div className="tw:flex tw:justify-between"><span className="tw:text-slate-500 tw:dark:text-slate-400">Exam total</span><strong>{formatCurrency(summary.examTotal)}</strong></div>
                  <div className="tw:flex tw:justify-between"><span className="tw:text-slate-500 tw:dark:text-slate-400">Semester fee</span><strong>{formatCurrency(summary.semesterFee)}</strong></div>
                  <div className="tw:flex tw:justify-between tw:border-t tw:border-slate-100 tw:pt-1.5 tw:text-base tw:dark:border-slate-800">
                    <span className="tw:font-semibold">Grand total</span>
                    <strong className="tw:text-brand-600 tw:dark:text-brand-400">{formatCurrency(summary.overallTotal)}</strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default MyFees;
