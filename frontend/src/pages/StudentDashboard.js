import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import { trackFeatureVisit } from '../utils/featureTracking';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import {
  FiBook,
  FiFileText,
  FiGrid,
  FiAward,
  FiTrendingUp,
  FiClock,
  FiUpload,
  FiX,
  FiCheckCircle,
  FiArrowLeft,
  FiUser,
  FiLoader,
} from 'react-icons/fi';
import './StudentDashboard.css';

// Upload flow:
// 1) If PDF <= 10MB: upload directly to Cloudinary (raw upload).
// 2) If PDF > 10MB: block upload and send the user to a PDF compression site.
const MAX_CLOUDINARY_RAW_UPLOAD_BYTES = 10 * 1024 * 1024;
const PDF_COMPRESS_SITES = [
  { label: 'iLovePDF', url: 'https://www.ilovepdf.com/compress_pdf' },
  { label: 'Smallpdf', url: 'https://smallpdf.com/compress-pdf' },
];
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FACULTY_CACHE_KEY = 'np_faculties_cache_v1';
const DEPT_CACHE_PREFIX = 'np_departments_cache_v1:';
const normalizeProfileText = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const formatBytes = (bytes) => {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const v = n / Math.pow(1024, i);
  const digits = i === 0 ? 0 : (i === 1 ? 0 : 1);
  return `${v.toFixed(digits)} ${units[i]}`;
};

const readCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.ts) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch (error) {
    return null;
  }
};

const writeCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch (error) {
    // Ignore cache write failures (e.g., private mode)
  }
};

const StudentDashboard = () => {
  const { user, syncUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [gamificationData, setGamificationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStep, setUploadStep] = useState(4); // 4: Course + Material, 5: Processing
  const [uploadForm, setUploadForm] = useState({
    facultyId: '',
    departmentId: '',
    courseId: '',
    file: null
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [uploadContext, setUploadContext] = useState({ facultyName: '', departmentName: '' });
  const [showProfileFallbackSheet, setShowProfileFallbackSheet] = useState(false);
  const [profileFallbackForm, setProfileFallbackForm] = useState({ facultyId: '', departmentId: '' });
  const [profileFallbackDepartments, setProfileFallbackDepartments] = useState([]);
  const [profileFallbackLoading, setProfileFallbackLoading] = useState(false);
  const [profileFallbackSaving, setProfileFallbackSaving] = useState(false);
  const [profileFallbackError, setProfileFallbackError] = useState('');
  const [uploadStats, setUploadStats] = useState(null);
  const [completedCourseId, setCompletedCourseId] = useState(null);
  const [completedMaterialId, setCompletedMaterialId] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null);

  // New course form state
  const [newCourse, setNewCourse] = useState({ courseCode: '', courseName: '', creditUnits: 3 });

  // Processing state for progress tracking
  const [processingStatus, setProcessingStatus] = useState({
    stage: '', // 'uploading', 'generating-summary', 'generating-questions', 'completed', 'failed'
    progress: 0,
    message: ''
  });
  const pollingIntervalRef = useRef(null);
  const pollingTimeoutRef = useRef(null);
  const statusTimeoutRef = useRef(null);
  const sseRef = useRef(null);
  const pollStartRef = useRef(null);
  const pollDelayRef = useRef(3000);
  const lastPollStateRef = useRef({ hasSummary: null, questionsCount: 0 });
  const completionBeepedRef = useRef(false);
  const autoNavigateRef = useRef(false);
  const uploadTargetRef = useRef({ courseId: null, materialId: null });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('upload') === '1') {
      setShowUploadModal(true);
      setUploadStep(4);
    }
  }, [location.search]);

  const normalizeCourseCode = (value) => {
    const raw = String(value || '').trim().toUpperCase();
    const match = raw.match(/^([A-Z]{3})\s*([0-9]{3})$/);
    if (!match) return null;
    return `${match[1]} ${match[2]}`;
  };

  const checkCourseExists = async ({ normalizedCode, courseName, departmentId, creditUnits }) => {
    try {
      const response = await api.get(`/courses/search?query=${encodeURIComponent(normalizedCode)}`);
      const results = response.data.data || [];
      const normalizedName = String(courseName || '').trim().toLowerCase();
      const normalizedDepartmentId = String(departmentId || '');
      const normalizedCreditUnits = Number(creditUnits || 3);

      return results.find((course) => {
        const sameCode = (course.courseCode || '').toUpperCase() === normalizedCode;
        const sameName = String(course.courseName || '').trim().toLowerCase() === normalizedName;
        const sameDepartment = String(course.departmentId?._id || course.departmentId || '') === normalizedDepartmentId;
        const sameCredits = Number(course.creditUnits || 3) === normalizedCreditUnits;
        return sameCode && sameName && sameDepartment && sameCredits;
      }) || null;
    } catch (error) {
      console.error('Error checking course:', error);
      return null;
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stats/student');
      setStats(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const fetchGamificationDashboard = async () => {
    try {
      const response = await api.get('/gamification/dashboard');
      setGamificationData(response.data.data);
    } catch (error) {
      console.error('Error fetching gamification dashboard:', error);
      setGamificationData(null);
    }
  };

  const fetchFaculties = useCallback(async () => {
    const cached = readCache(FACULTY_CACHE_KEY);
    if (cached) {
      setFaculties(cached);
      return;
    }
    try {
      const response = await api.get('/faculties');
      const data = response.data.data || [];
      setFaculties(data);
      writeCache(FACULTY_CACHE_KEY, data);
    } catch (error) {
      console.error('Error fetching faculties:', error);
    }
  }, []);

  const fetchDepartments = useCallback(async (facultyId) => {
    const cacheKey = `${DEPT_CACHE_PREFIX}${facultyId}`;
    const cached = readCache(cacheKey);
    if (cached) {
      return cached;
    }
    try {
      const response = await api.get(`/faculties/${facultyId}/departments`);
      const data = response.data.data || [];
      writeCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching departments:', error);
      return [];
    }
  }, []);


  const fetchUploadStats = async () => {
    try {
      const response = await api.get('/materials/my-stats');
      setUploadStats(response.data.data);
    } catch (error) {
      console.error('Error fetching upload stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchGamificationDashboard();
    fetchFaculties();
    fetchUploadStats();
    trackFeatureVisit('dashboard');
  }, [fetchFaculties]);

  const loadProfileFallbackDepartments = useCallback(async (facultyId) => {
    if (!facultyId) {
      setProfileFallbackDepartments([]);
      return [];
    }

    setProfileFallbackLoading(true);
    try {
      const departments = await fetchDepartments(facultyId);
      setProfileFallbackDepartments(departments);
      return departments;
    } finally {
      setProfileFallbackLoading(false);
    }
  }, [fetchDepartments]);

  const closeProfileFallbackSheet = useCallback(() => {
    setShowProfileFallbackSheet(false);
    setProfileFallbackForm({ facultyId: '', departmentId: '' });
    setProfileFallbackDepartments([]);
    setProfileFallbackLoading(false);
    setProfileFallbackSaving(false);
    setProfileFallbackError('');
  }, []);

  const openProfileFallbackSheet = useCallback(async ({
    matchedFaculty = null,
    profileOverride = user,
    errorMessage = 'We could not detect your faculty and department from your profile. Select them below to continue.',
  } = {}) => {
    const initialFacultyId = matchedFaculty?._id || '';
    const departments = await loadProfileFallbackDepartments(initialFacultyId);
    const departmentLabel = normalizeProfileText(profileOverride?.department);
    const preselectedDepartment = departments.find((department) => {
      const name = normalizeProfileText(department?.name);
      const code = normalizeProfileText(department?.code);
      return name === departmentLabel || (code && code === departmentLabel);
    });

    setProfileFallbackForm({
      facultyId: initialFacultyId,
      departmentId: preselectedDepartment?._id || '',
    });
    setProfileFallbackError('');
    setShowProfileFallbackSheet(true);
    setUploadError(errorMessage);
  }, [loadProfileFallbackDepartments, user]);

  const resolveProfileUploadContext = useCallback(async (profileOverride = user) => {
    const facultyLabel = normalizeProfileText(profileOverride?.faculty);
    const departmentLabel = normalizeProfileText(profileOverride?.department);

    setUploadContext({
      facultyName: profileOverride?.faculty || '',
      departmentName: profileOverride?.department || '',
    });

    if (faculties.length === 0) {
      return;
    }

    if (!facultyLabel || !departmentLabel) {
      setUploadForm((current) => ({ ...current, facultyId: '', departmentId: '', courseId: '' }));
      await openProfileFallbackSheet({
        profileOverride,
        errorMessage: 'We could not detect your faculty and department from your profile. Select them below to continue.',
      });
      return;
    }

    let matchedFaculty = faculties.find((faculty) => {
      const name = normalizeProfileText(faculty?.name);
      const code = normalizeProfileText(faculty?.code);
      return name === facultyLabel || (code && code === facultyLabel);
    });

    let matchedDepartment = null;

    if (matchedFaculty?._id) {
      const nextDepartments = await fetchDepartments(matchedFaculty._id);
      matchedDepartment = nextDepartments.find((department) => {
        const name = normalizeProfileText(department?.name);
        const code = normalizeProfileText(department?.code);
        return name === departmentLabel || (code && code === departmentLabel);
      });
    }

    if (!matchedDepartment?._id) {
      try {
        const response = await api.get('/departments');
        const allDepartments = Array.isArray(response.data?.data) ? response.data.data : [];
        matchedDepartment = allDepartments.find((department) => {
          const name = normalizeProfileText(department?.name);
          const code = normalizeProfileText(department?.code);
          return name === departmentLabel || (code && code === departmentLabel);
        }) || null;

        const inferredFaculty = matchedDepartment?.facultyId;
        if (matchedDepartment?._id && inferredFaculty) {
          matchedFaculty = typeof inferredFaculty === 'object'
            ? inferredFaculty
            : faculties.find((faculty) => faculty._id === inferredFaculty) || matchedFaculty;
        }
      } catch (error) {
        console.error('Error inferring faculty from department:', error);
      }
    }

    if (!matchedDepartment?._id) {
      setUploadForm((current) => ({ ...current, facultyId: '', departmentId: '', courseId: '' }));
      setUploadContext({
        facultyName: matchedFaculty?.name || profileOverride?.faculty || 'Not available',
        departmentName: profileOverride?.department || 'Not available',
      });
      await openProfileFallbackSheet({
        matchedFaculty,
        profileOverride,
        errorMessage: 'We could not match your department from your profile. Select the correct details below to continue.',
      });
      return;
    }

    setUploadForm((current) => ({
      ...current,
      facultyId: matchedFaculty?._id || '',
      departmentId: matchedDepartment._id,
      courseId: '',
    }));
    setUploadContext({
      facultyName: matchedFaculty?.name || profileOverride?.faculty || 'Not available',
      departmentName: matchedDepartment?.name || profileOverride?.department || 'Not available',
    });
    closeProfileFallbackSheet();
    setUploadError(null);
  }, [closeProfileFallbackSheet, faculties, fetchDepartments, openProfileFallbackSheet, user]);

  useEffect(() => {
    if (!showUploadModal) return;
    resolveProfileUploadContext();
  }, [showUploadModal, resolveProfileUploadContext]);

  const handleProfileFallbackFacultyChange = async (event) => {
    const facultyId = event.target.value;
    setProfileFallbackForm({ facultyId, departmentId: '' });
    setProfileFallbackError('');
    await loadProfileFallbackDepartments(facultyId);
  };

  const handleProfileFallbackSubmit = async (event) => {
    event.preventDefault();

    if (!profileFallbackForm.facultyId || !profileFallbackForm.departmentId) {
      setProfileFallbackError('Select your faculty and department to continue.');
      return;
    }

    const selectedFaculty = faculties.find((faculty) => faculty._id === profileFallbackForm.facultyId);
    const selectedDepartment = profileFallbackDepartments.find(
      (department) => department._id === profileFallbackForm.departmentId
    );

    if (!selectedFaculty || !selectedDepartment) {
      setProfileFallbackError('We could not save your selection. Try choosing the options again.');
      return;
    }

    setProfileFallbackSaving(true);
    setProfileFallbackError('');
    setUploadError(null);
    setUploadContext({
      facultyName: selectedFaculty.name,
      departmentName: selectedDepartment.name,
    });
    setUploadForm((current) => ({
      ...current,
      facultyId: selectedFaculty._id,
      departmentId: selectedDepartment._id,
      courseId: '',
    }));

    try {
      const response = await api.put('/users/profile', {
        faculty: selectedFaculty.name,
        department: selectedDepartment.name,
      });
      const updatedProfile = response.data?.data || {
        ...user,
        faculty: selectedFaculty.name,
        department: selectedDepartment.name,
      };
      syncUser(updatedProfile);
      await resolveProfileUploadContext(updatedProfile);
    } catch (error) {
      setProfileFallbackError(
        error.response?.data?.message || 'We could not save your faculty and department. Please try again.'
      );
    } finally {
      setProfileFallbackSaving(false);
    }
  };

  const closeStatusStream = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
  };

  const playCompletionBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gain.gain.setValueAtTime(0.15, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.6);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.6);
      oscillator.onended = () => context.close();
    } catch (error) {
      console.error('Unable to play beep:', error);
    }
  };

  const applyStatusUpdate = (payload) => {
    const {
      processingStatus: status,
      hasSummary,
      questionsCount = 0,
      expectedQuestions = 70,
      processingError,
    } = payload || {};

    const hasAllQuestions = questionsCount >= expectedQuestions;
    const hasMinimumQuestions = questionsCount >= 10;

    let shouldContinue = true;
    const navigateToUploadedCourse = () => {
      const targetCourseId = completedCourseId || uploadTargetRef.current.courseId;
      const targetMaterialId = completedMaterialId || uploadTargetRef.current.materialId;
      if (autoNavigateRef.current || !targetCourseId) return;
      autoNavigateRef.current = true;
      const targetPath = targetMaterialId
        ? `/course/${targetCourseId}?materialId=${encodeURIComponent(targetMaterialId)}`
        : `/course/${targetCourseId}`;
      setTimeout(() => navigate(targetPath), 500);
    };

    if (status === 'processing') {
      if (hasSummary && hasMinimumQuestions) {
        setProcessingStatus({
          stage: 'completed',
          progress: 100,
          message: hasAllQuestions
            ? 'Processing complete! Summary and questions are ready.'
            : `Upload complete! Summary is ready. ${questionsCount}/${expectedQuestions} questions available while the rest continue in background.`
        });
        fetchUploadStats();
        fetchStats();
        fetchGamificationDashboard();
        navigateToUploadedCourse();
        if (!completionBeepedRef.current) {
          completionBeepedRef.current = true;
          playCompletionBeep();
        }
        shouldContinue = false;
      } else if (hasSummary) {
        setProcessingStatus({
          stage: 'generating-questions',
          progress: Math.min(95, 35 + Math.round((Math.min(questionsCount, 10) / 10) * 55)),
          message: `Summary ready. Generating first 10 questions... ${questionsCount}/10`
        });
      } else if (!hasSummary) {
        setProcessingStatus({
          stage: 'generating-summary',
          progress: 35,
          message: 'Generating summary...'
        });
      }
    } else if (status === 'completed' && hasSummary) {
      setProcessingStatus({
        stage: 'completed',
        progress: 100,
        message: hasAllQuestions
          ? 'Processing complete! Summary and questions are ready.'
          : `Upload complete! Summary is ready. ${questionsCount}/${expectedQuestions} questions available.`
      });
      fetchUploadStats();
      fetchStats();
      fetchGamificationDashboard();
      if (hasMinimumQuestions || hasAllQuestions) {
        navigateToUploadedCourse();
      }
      if (!completionBeepedRef.current) {
        completionBeepedRef.current = true;
        playCompletionBeep();
      }
      shouldContinue = false;
    } else if (status === 'failed') {
      setProcessingStatus({
        stage: 'failed',
        progress: 0,
        message: processingError || 'Processing failed. Please try again.'
      });
      shouldContinue = false;
    }

    const previous = lastPollStateRef.current;
    lastPollStateRef.current = { hasSummary, questionsCount };
    const progressed = previous.hasSummary !== hasSummary || previous.questionsCount !== questionsCount;
    return { shouldContinue, progressed };
  };

  // Poll for material processing status
  const pollProcessingStatus = async (materialId) => {
    try {
      const response = await api.get(`/materials/${materialId}/status`);
      const payload = response.data.data;
      const { shouldContinue, progressed } = applyStatusUpdate(payload);

      const now = Date.now();
      const elapsed = pollStartRef.current ? now - pollStartRef.current : 0;
      const timeoutMs = 9 * 60 * 1000;
      const shouldPoll = shouldContinue &&
        payload.processingStatus !== 'failed' &&
        !(payload.processingStatus === 'completed' && payload.hasSummary && payload.questionsCount >= (payload.expectedQuestions || 70));

      if (shouldPoll) {
        if (elapsed > timeoutMs) {
          setProcessingStatus({
            stage: 'failed',
            progress: 0,
            message: 'Processing took too long. Please try again later.'
          });
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
          }
          return;
        }
        if (progressed) {
          pollDelayRef.current = 3000;
        } else {
          pollDelayRef.current = Math.min(Math.round(pollDelayRef.current * 1.5), 15000);
        }
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
        }
        pollingTimeoutRef.current = setTimeout(() => {
          pollProcessingStatus(materialId);
        }, pollDelayRef.current);
      }
    } catch (error) {
      console.error('Error polling status:', error);
    }
  };

  const startStatusStream = async (materialId) => {
    closeStatusStream();
    const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').trim();

    try {
      const streamTokenRes = await api.post(`/materials/${materialId}/stream-token`);
      const streamToken = streamTokenRes?.data?.data?.token;
      if (!streamToken) {
        pollProcessingStatus(materialId);
        return;
      }

      const streamUrl = `${baseUrl}/materials/${materialId}/stream?token=${encodeURIComponent(streamToken)}`;
      const source = new EventSource(streamUrl);
      sseRef.current = source;
    } catch (error) {
      pollProcessingStatus(materialId);
      return;
    }
    const source = sseRef.current;
    if (!source) return;

    statusTimeoutRef.current = setTimeout(() => {
      setProcessingStatus({
        stage: 'failed',
        progress: 0,
        message: 'Processing took too long. Please try again later.'
      });
      closeStatusStream();
    }, 9 * 60 * 1000);

    const handlePayload = (payload) => {
      const { shouldContinue, progressed } = applyStatusUpdate(payload);
      if (progressed) {
        // Reset timeout on progress
        if (statusTimeoutRef.current) {
          clearTimeout(statusTimeoutRef.current);
        }
        statusTimeoutRef.current = setTimeout(() => {
          setProcessingStatus({
            stage: 'failed',
            progress: 0,
            message: 'Processing took too long. Please try again later.'
          });
          closeStatusStream();
        }, 9 * 60 * 1000);
      }
      if (!shouldContinue) {
        closeStatusStream();
      }
    };

    source.addEventListener('status', (event) => {
      try {
        handlePayload(JSON.parse(event.data));
      } catch (error) {
        console.error('Failed to parse status event:', error);
      }
    });

    source.addEventListener('done', (event) => {
      try {
        handlePayload(JSON.parse(event.data));
      } catch (error) {
        console.error('Failed to parse done event:', error);
      } finally {
        closeStatusStream();
      }
    });

    source.addEventListener('error', () => {
      closeStatusStream();
      pollProcessingStatus(materialId);
    });
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      closeStatusStream();
    };
  }, []);

  const computeFileHash = async (file) => {
    try {
      if (!window.crypto || !window.crypto.subtle) {
        return '';
      }
      const buffer = await file.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Error computing file hash:', error);
      return '';
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    const normalizedCode = normalizeCourseCode(newCourse.courseCode);
    const safeCourseName = String(newCourse.courseName || '').trim();
    const parsedCreditUnits = Number(newCourse.creditUnits);
    const normalizedCreditUnits =
      Number.isFinite(parsedCreditUnits) && parsedCreditUnits >= 1 && parsedCreditUnits <= 6
        ? parsedCreditUnits
        : 3;

    if (!uploadForm.departmentId) {
      setUploadError('We could not match your faculty and department from your profile. Select them below to continue.');
      openProfileFallbackSheet();
      return;
    }
    if (!normalizedCode) {
      setUploadError('Course code must be 3 letters and 3 numbers (e.g., BIO 101)');
      return;
    }
    if (!safeCourseName) {
      setUploadError('Please enter course name');
      return;
    }
    if (!uploadForm.file) {
      setUploadError('Please select a PDF file to upload');
      return;
    }

    if (uploadForm.file.type !== 'application/pdf') {
      setUploadError('Only PDF files are allowed');
      return;
    }
    if (uploadForm.file.size > MAX_CLOUDINARY_RAW_UPLOAD_BYTES) {
      setUploadError(
        <span>
          File is too large ({formatBytes(uploadForm.file.size)}). Maximum allowed is {formatBytes(MAX_CLOUDINARY_RAW_UPLOAD_BYTES)}. Compress it and re-upload using:{' '}
          {PDF_COMPRESS_SITES.map((s, idx) => (
            <span key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
              {idx === PDF_COMPRESS_SITES.length - 1 ? '' : ' or '}
            </span>
          ))}
          .
        </span>
      );
      return;
    }

    setUploading(true);
    autoNavigateRef.current = false;
    setUploadError(null);

    // Move to processing step
    setUploadStep(5);
    setProcessingStatus({
      stage: 'uploading',
      progress: 10,
      message: 'Uploading your file...'
    });

    let resolvedCourseId = uploadForm.courseId;

    try {
      // On Vercel we can't send large files to the API (body limits). Upload to storage first, then notify the API.
      const existingCourse = await checkCourseExists({
        normalizedCode,
        courseName: safeCourseName,
        departmentId: uploadForm.departmentId,
        creditUnits: normalizedCreditUnits,
      });

      if (existingCourse?._id) {
        resolvedCourseId = existingCourse._id;
      } else {
        const response = await api.post('/courses', {
          courseCode: normalizedCode,
          courseName: safeCourseName,
          creditUnits: normalizedCreditUnits,
          departmentId: uploadForm.departmentId,
        });
        resolvedCourseId = response.data.data._id;
      }

      setUploadForm((prev) => ({ ...prev, courseId: resolvedCourseId }));

      // Hash the uploaded PDF for duplicate detection.
      const fileHash = await computeFileHash(uploadForm.file);
      const fileToUpload = uploadForm.file;

      let cloudinaryUrl = '';
      let cloudinaryPublicId = '';

      const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.REACT_APP_CLOUDINARY_API_KEY;

      if (!cloudName || !apiKey) {
        throw new Error('Cloudinary configuration is missing on the frontend');
      }

      const signatureResponse = await api.post('/materials/upload-signature');
      const { timestamp, signature, folder } = signatureResponse.data.data;

      const cloudinaryData = new FormData();
      cloudinaryData.append('file', fileToUpload);
      cloudinaryData.append('api_key', apiKey);
      cloudinaryData.append('timestamp', timestamp);
      cloudinaryData.append('signature', signature);
      cloudinaryData.append('folder', folder);

      const cloudinaryResp = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
        { method: 'POST', body: cloudinaryData }
      );
      const cloudinaryJson = await cloudinaryResp.json().catch(() => null);
      if (!cloudinaryResp.ok) {
        const msg = cloudinaryJson?.error?.message || 'Failed to upload PDF to storage';
        throw new Error(msg);
      }

      cloudinaryUrl = cloudinaryJson?.secure_url;
      cloudinaryPublicId = cloudinaryJson?.public_id;

      if (!cloudinaryUrl || !cloudinaryPublicId) {
        throw new Error('Upload failed. Missing storage reference for uploaded file.');
      }

      const response = await api.post('/materials/student-upload', {
        title: safeCourseName,
        courseId: resolvedCourseId,
        cloudinaryUrl,
        cloudinaryPublicId,
        fileType: fileToUpload.type,
        originalFilename: fileToUpload.name,
        fileHash,
      });

      const materialId = response.data.data._id;
      setCompletedCourseId(resolvedCourseId);
      setCompletedMaterialId(materialId);
      uploadTargetRef.current = { courseId: resolvedCourseId, materialId };

      // Update progress - file uploaded, now processing
      setProcessingStatus({
        stage: 'generating-summary',
        progress: 25,
        message: 'File uploaded! Generating summary...'
      });

      // Start polling for processing status
      pollStartRef.current = Date.now();
      pollDelayRef.current = 3000;
      lastPollStateRef.current = { hasSummary: null, questionsCount: 0 };
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      startStatusStream(materialId);

    } catch (error) {
      console.error('Upload error:', error);
      const status = error.response?.status;
      const backendMessage = error.response?.data?.message;
      if (status === 409) {
        const existingCourse = error.response?.data?.data;
        if (backendMessage === 'Course already exists' && existingCourse?._id) {
          setDuplicateInfo({
            kind: 'course',
            courseId: existingCourse._id,
            title: existingCourse.courseCode,
            name: existingCourse.courseName,
          });
          setUploadForm((current) => ({ ...current, courseId: existingCourse._id }));
          setProcessingStatus({ stage: '', progress: 0, message: '' });
          setUploadStep(4);
          return;
        }

        const existing = error.response?.data?.existingMaterial || {};
      setDuplicateInfo({
          kind: 'material',
          courseId: resolvedCourseId || uploadForm.courseId,
          title: existing.title,
          uploadedBy: existing.uploadedBy?.name || existing.uploadedBy || 'another student',
          uploadDate: existing.uploadDate
        });
      setProcessingStatus({ stage: '', progress: 0, message: '' });
      setUploadStep(4);
      return;
      }

      const cloudinaryMessage = error.response?.data?.error?.message;
      const rawMessage = cloudinaryMessage || backendMessage || error.message || 'Failed to upload material';
      const normalizedMessage = String(rawMessage || '');

      setUploadError(normalizedMessage);

      setProcessingStatus({
        stage: 'failed',
        progress: 0,
        message: normalizedMessage || 'Failed to upload material'
      });
    } finally {
      setUploading(false);
    }
  };

  const resetUploadState = () => {
    // Stop any ongoing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    closeStatusStream();
    setUploadStep(4);
    setUploadForm({ facultyId: '', departmentId: '', courseId: '', file: null });
    setUploadContext({ facultyName: '', departmentName: '' });
    closeProfileFallbackSheet();
    setUploadError(null);
    setProcessingStatus({ stage: '', progress: 0, message: '' });
    setNewCourse({ courseCode: '', courseName: '', creditUnits: 3 });
    setCompletedCourseId(null);
    setCompletedMaterialId(null);
    uploadTargetRef.current = { courseId: null, materialId: null };
    setDuplicateInfo(null);
    completionBeepedRef.current = false;
    autoNavigateRef.current = false;
  };

  const closeUploadModal = () => {
    resetUploadState();
    setShowUploadModal(false);
  };

  const handleCompletionClose = () => {
    const courseId = completedCourseId || uploadTargetRef.current.courseId;
    const materialId = completedMaterialId || uploadTargetRef.current.materialId;
    if (courseId) {
      if (materialId) {
        navigate(`/course/${courseId}?materialId=${encodeURIComponent(materialId)}`);
      } else {
        navigate(`/course/${courseId}`);
      }
    }
  };

  const openUploadModal = () => {
    resetUploadState();
    setShowUploadModal(true);
    setUploadStep(4);
  };

  const describeActivity = (activity) => {
    if (!activity) return 'Activity';
    if (activity.type === 'practice_attempt') {
      const scoreText = activity.score?.max
        ? `${activity.score?.value || 0}/${activity.score.max}`
        : `${activity.score?.percentage?.toFixed ? activity.score.percentage.toFixed(1) : 0}%`;
      return `Practice attempt (${scoreText})`;
    }
    if (activity.type === 'summary_completion') {
      return 'Summary completed';
    }
    return 'Activity';
  };

  const rankLabel = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return (
      <div className="student-dashboard-container">
        <div className="container">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-dashboard-container">
      <SEO
        title="Student Dashboard - NounPaddi"
        description="Student dashboard for NounPaddi activity, uploads, summaries, and leaderboard progress."
        url="/dashboard"
        keywords="student dashboard, nounpaddi dashboard, uploads, leaderboard"
        robots="noindex, nofollow"
      />
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1>My Learning Dashboard</h1>
            <p>Track your progress and explore study materials</p>
          </div>
          <Link to="/profile" className="profile-link-button">
            <FiUser size={18} />
            My Profile
          </Link>
        </div>

        <div className="summary-cta">
          <div className="summary-cta-card">
            <div>
              <p className="summary-cta-kicker">Need a course summary?</p>
              <h2>Get Course Summary & Questions</h2>
              <p>Upload your course material once and we will generate a clean summary plus exam questions.</p>
            </div>
            <button
              className="summary-cta-button"
              onClick={openUploadModal}
            >
              <FiUpload size={18} />
              Get Course Summary
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card stat-card-blue">
            <div className="stat-icon">
              <FiBook />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalCourses || 0}</h3>
              <p>Available Courses</p>
            </div>
          </div>

          <div className="stat-card stat-card-purple">
            <div className="stat-icon">
              <FiFileText />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalMaterials || 0}</h3>
              <p>Study Materials</p>
            </div>
          </div>

          <div className="stat-card stat-card-green">
            <div className="stat-icon">
              <FiFileText />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalSummaries || 0}</h3>
              <p>Summaries Available</p>
              <span className="stat-badge">{stats?.overview?.materialWithSummaries || 0}% of materials</span>
            </div>
          </div>

          <div className="stat-card stat-card-orange">
            <div className="stat-icon">
              <FiGrid />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalQuestions || 0}</h3>
              <p>Practice Questions</p>
              <span className="stat-badge">{stats?.overview?.avgQuestionsPerCourse || 0} per course</span>
            </div>
          </div>
        </div>

        {gamificationData && (
          <div className="modern-section gamification-section">
            <div className="section-header">
              <div className="section-title-group">
                <FiAward size={24} className="section-icon" />
                <div>
                  <h2>Gamification</h2>
                  <p>Your points, activity, and leaderboard position</p>
                </div>
              </div>
            </div>

            <div className="gamification-totals-grid">
              <div className="gamification-total-card">
                <h3>{gamificationData?.totals?.totalPoints || 0}</h3>
                <p>Total Points</p>
              </div>
              <div className="gamification-total-card">
                <h3>{gamificationData?.totals?.practicePoints || 0}</h3>
                <p>Practice Points</p>
              </div>
              <div className="gamification-total-card">
                <h3>{gamificationData?.totals?.readingPoints || 0}</h3>
                <p>Reading Points</p>
              </div>
              <div className="gamification-total-card">
                <h3>{gamificationData?.totals?.summariesCompleted || 0}</h3>
                <p>Summaries Completed</p>
              </div>
            </div>

            <div className="gamification-content-grid">
              <div className="gamification-card overall-toppers-card">
                <div className="overall-toppers-header">
                  <h3>Overall Toppers</h3>
                  <p>Top students by total gamification points</p>
                </div>
                <div className="overall-toppers-table">
                  <div className="overall-toppers-row overall-toppers-head">
                    <span>Rank</span>
                    <span>Student</span>
                    <span>Points</span>
                    <span>Activities</span>
                  </div>
                  {(gamificationData?.leaderboards?.overall || []).slice(0, 10).map((entry) => (
                    <div key={`${entry.studentId}-overall`} className={`overall-toppers-row ${entry.isMe ? 'is-me' : ''}`}>
                      <span>{rankLabel(entry.rank)}</span>
                      <span>{entry.studentName}</span>
                      <strong>{entry.totalPoints}</strong>
                      <span>{entry.attempts || 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="gamification-side-stack">
                <div className="gamification-card">
                  <h3>Practice Leaders</h3>
                  <div className="gamification-leaderboard-list">
                    {(gamificationData?.leaderboards?.practice || []).slice(0, 5).map((entry) => (
                      <div key={`${entry.studentId}-practice`} className={`leaderboard-mini-row ${entry.isMe ? 'is-me' : ''}`}>
                        <span>{rankLabel(entry.rank)} {entry.studentName}</span>
                        <strong>{entry.totalPoints} pts</strong>
                      </div>
                    ))}
                  </div>

                  <h3>Top Readers</h3>
                  <div className="gamification-leaderboard-list">
                    {(gamificationData?.leaderboards?.readers || []).slice(0, 5).map((entry) => (
                      <div key={`${entry.studentId}-readers`} className={`leaderboard-mini-row ${entry.isMe ? 'is-me' : ''}`}>
                        <span>{rankLabel(entry.rank)} {entry.studentName}</span>
                        <strong>{entry.totalPoints} pts</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="gamification-card">
              <h3>Recent Activity</h3>
              {gamificationData?.recentActivities?.length > 0 ? (
                <div className="gamification-activity-list">
                  {gamificationData.recentActivities.slice(0, 8).map((activity) => (
                    <div key={activity._id} className="gamification-activity-item">
                      <div>
                        <strong>{describeActivity(activity)}</strong>
                        <p>
                          {activity.course
                            ? `${activity.course.courseCode} - ${activity.course.courseName}`
                            : 'General activity'}
                        </p>
                      </div>
                      <div className="gamification-points-chip">
                        +{activity.points || 0}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="gamification-empty-text">No activity yet. Start practicing or complete a summary.</p>
              )}
            </div>
          </div>
        )}

        {/* Recent Materials */}
        <div className="modern-section recent-materials-section">
          <div className="section-header">
            <div className="section-title-group">
              <FiClock size={24} className="section-icon" />
              <div>
                <h2>Recently Added Materials</h2>
                <p>Latest study materials uploaded to the platform</p>
              </div>
            </div>
            <Link to="/explore" className="view-all-button">
              View All
              <FiArrowLeft style={{ transform: 'rotate(180deg)' }} />
            </Link>
          </div>

          <div className="modern-materials-grid">
            {stats?.recentMaterials && stats.recentMaterials.length > 0 ? (
              stats.recentMaterials.slice(0, 6).map((material) => (
                <Link
                  key={material._id}
                  to={`/course/${material.courseId?._id}`}
                  className="modern-material-card"
                >
                  <div className="material-card-header">
                    <div className="material-icon-wrapper">
                      <FiFileText size={24} />
                    </div>
                    <span className="material-badge">New</span>
                  </div>
                  <div className="material-card-content">
                    <h3>{material.title}</h3>
                    <p className="material-course">
                      {material.courseId?.courseCode} - {material.courseId?.courseName}
                    </p>
                    <div className="material-card-footer">
                      <span className="material-date">
                        <FiClock size={14} />
                        {formatDate(material.createdAt)}
                      </span>
                      {material.hasSummary && (
                        <span className="material-tag summary-tag">
                          <FiBook size={12} />
                          Summary
                        </span>
                      )}
                      {material.hasQuestions && (
                        <span className="material-tag questions-tag">
                          <FiGrid size={12} />
                          Questions
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <FiFileText size={48} />
                <h3>No materials available yet</h3>
                <p>Be the first to upload study materials!</p>
                <button onClick={openUploadModal} className="empty-state-button">
                  <FiUpload size={18} />
                  Upload Material
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Upload Stats */}
        {uploadStats && uploadStats.totalUploads > 0 && (
          <div className="contributions-section">
            <div className="contributions-header">
              <div className="contributions-title">
                <FiAward size={28} className="contributions-icon" />
                <div>
                  <h2>My Contributions</h2>
                  <p>Thank you for contributing to the community!</p>
                </div>
              </div>
              <div className="contribution-badge">
                <FiTrendingUp size={16} />
                <span>Active Contributor</span>
              </div>
            </div>

            <div className="contributions-grid">
              <div className="contribution-card card-materials">
                <div className="contribution-icon-wrapper">
                  <FiFileText size={24} />
                </div>
                <div className="contribution-content">
                  <h3>{uploadStats.totalUploads}</h3>
                  <p>Materials Uploaded</p>
                  <div className="contribution-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min((uploadStats.totalUploads / 10) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="progress-label">
                      {uploadStats.totalUploads >= 10 ? 'Goal reached!' : `${10 - uploadStats.totalUploads} more to unlock Bronze Badge`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="contribution-card card-points">
                <div className="contribution-icon-wrapper">
                  <FiAward size={24} />
                </div>
                <div className="contribution-content">
                  <h3>{uploadStats.totalPoints}</h3>
                  <p>Points Earned</p>
                  <div className="points-breakdown">
                    <span className="points-rate">+10 pts per upload</span>
                  </div>
                </div>
              </div>

              <div className="contribution-card card-processed">
                <div className="contribution-icon-wrapper">
                  <FiCheckCircle size={24} />
                </div>
                <div className="contribution-content">
                  <h3>{uploadStats.completed}</h3>
                  <p>Processed Successfully</p>
                  <div className="success-rate">
                    <span className="rate-badge">
                      {uploadStats.totalUploads > 0
                        ? `${Math.round((uploadStats.completed / uploadStats.totalUploads) * 100)}% success rate`
                        : '0% success rate'
                      }
                    </span>
                  </div>
                </div>
              </div>

              <div className="contribution-card card-pending">
                <div className="contribution-icon-wrapper">
                  <FiClock size={24} />
                </div>
                <div className="contribution-content">
                  <h3>{uploadStats.pending || 0}</h3>
                  <p>Processing</p>
                  <div className="pending-info">
                    <span className="pending-label">Auto-generating content...</span>
                  </div>
                </div>
              </div>
            </div>

            {uploadStats.totalUploads >= 10 && (
              <div className="achievement-notification">
                <FiAward size={20} />
                <span>Congratulations! You've unlocked the Bronze Contributor badge!</span>
              </div>
            )}
          </div>
        )}

        {/* Upload Modal - Multi-Step */}
        {showUploadModal && (
          <div className="modal-overlay" onClick={closeUploadModal}>
            <div className="modal-content upload-wizard" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{uploadStep === 5 ? 'Processing Material' : 'Upload Material'}</h2>
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="modal-close"
                  aria-label="Close upload dialog"
                >
                  <FiX />
                </button>
              </div>

              <div className="upload-form">
                {uploadStep === 4 && (
                  <form onSubmit={handleUploadSubmit} className="step-content">
                    <h3>Course Details and Material</h3>

                    <div className="profile-context-card">
                      <div>
                        <span className="profile-context-label">Faculty</span>
                        <strong>{uploadContext.facultyName || 'Not available'}</strong>
                      </div>
                      <div>
                        <span className="profile-context-label">Department</span>
                        <strong>{uploadContext.departmentName || 'Not available'}</strong>
                      </div>
                    </div>

                    {!uploadForm.departmentId && (
                      <div className="profile-fallback-callout">
                        <p>We could not detect your upload department from your profile.</p>
                        <button
                          type="button"
                          className="btn btn-secondary profile-fallback-trigger"
                          onClick={() => openProfileFallbackSheet()}
                          disabled={profileFallbackSaving}
                        >
                          Select faculty and department
                        </button>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Course Code</label>
                      <input
                        type="text"
                        value={newCourse.courseCode}
                        onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value.toUpperCase() })}
                        placeholder="e.g., GST 105"
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Course Name</label>
                      <input
                        type="text"
                        value={newCourse.courseName}
                        onChange={(e) => setNewCourse({ ...newCourse, courseName: e.target.value })}
                        placeholder="e.g., Use of English and Communication Skills"
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Course Unit</label>
                      <input
                        type="number"
                        value={newCourse.creditUnits}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          if (nextValue === '') {
                            setNewCourse({ ...newCourse, creditUnits: '' });
                            return;
                          }
                          setNewCourse({ ...newCourse, creditUnits: nextValue });
                        }}
                        placeholder="e.g., 2"
                        className="form-input"
                        min="1"
                        max="6"
                        step="1"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Attach Material</label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (!file) {
                            setUploadForm((current) => ({ ...current, file: null }));
                            return;
                          }
                          if (file.type !== 'application/pdf') {
                            setUploadError('Only PDF files are allowed');
                            setUploadForm((current) => ({ ...current, file: null }));
                            e.target.value = '';
                            return;
                          }
                          if (file.size > MAX_CLOUDINARY_RAW_UPLOAD_BYTES) {
                            setUploadError(
                              <span>
                                File is too large ({formatBytes(file.size)}). Maximum allowed is {formatBytes(MAX_CLOUDINARY_RAW_UPLOAD_BYTES)}. Compress it and re-upload using:{' '}
                                {PDF_COMPRESS_SITES.map((s, idx) => (
                                  <span key={s.url}>
                                    <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
                                    {idx === PDF_COMPRESS_SITES.length - 1 ? '' : ' or '}
                                  </span>
                                ))}
                                .
                              </span>
                            );
                            setUploadForm((current) => ({ ...current, file: null }));
                            e.target.value = '';
                            return;
                          }
                          // Cloudinary raw upload limit is 10MB on the current plan.
                          setUploadError(null);
                          setUploadForm((current) => ({ ...current, file }));
                        }}
                        required
                      />
                      {uploadForm.file && (
                        <p className="file-selected">{uploadForm.file.name}</p>
                      )}
                    </div>

                    {uploadError && (
                      <div className="upload-error">
                        <FiX /> {uploadError}
                      </div>
                    )}

                    <div className="modal-actions">
                      <button
                        type="button"
                        onClick={closeUploadModal}
                        className="btn btn-secondary"
                        disabled={uploading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={
                          uploading ||
                          !uploadForm.departmentId ||
                          !uploadForm.file ||
                          !newCourse.courseCode.trim() ||
                          !newCourse.courseName.trim()
                        }
                      >
                        {uploading ? 'Uploading...' : 'Upload Material'}
                      </button>
                    </div>

                    <div className="upload-info">
                      <p>
                        <strong>Tip:</strong> Keep your PDF under {formatBytes(MAX_CLOUDINARY_RAW_UPLOAD_BYTES)}. If it is larger, compress it and re-upload using:{' '}
                        {PDF_COMPRESS_SITES.map((s, idx) => (
                          <span key={s.url}>
                            <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
                            {idx === PDF_COMPRESS_SITES.length - 1 ? '' : ', '}
                          </span>
                        ))}
                        .
                      </p>
                    </div>
                  </form>
                )}

                {/* Step 5: Processing Status */}
                {uploadStep === 5 && (
                  <div className="step-content processing-step">
                    <div className="processing-container">
                      {processingStatus.stage === 'completed' ? (
                        <div className="processing-icon success">
                          <FiCheckCircle size={64} />
                        </div>
                      ) : processingStatus.stage === 'failed' ? (
                        <div className="processing-icon error">
                          <FiX size={64} />
                        </div>
                      ) : (
                        <div className="processing-icon loading">
                          <FiLoader size={64} className="spin" />
                        </div>
                      )}

                      <h3>{processingStatus.stage === 'completed' ? 'Upload Complete!' : processingStatus.stage === 'failed' ? 'Processing Failed' : 'Processing Your Material'}</h3>
                      <p className="processing-message">{processingStatus.message}</p>

                      {processingStatus.stage !== 'failed' && (
                        <div className="processing-progress-container">
                          <div className="processing-progress-bar">
                            <div
                              className="processing-progress-fill"
                              style={{ width: `${processingStatus.progress}%` }}
                            ></div>
                          </div>
                          <span className="processing-percentage">{processingStatus.progress}%</span>
                        </div>
                      )}

                      <div className="processing-stages">
                        <div className={`processing-stage ${processingStatus.progress >= 10 ? 'completed' : ''}`}>
                          <FiUpload size={18} />
                          <span>Uploading file</span>
                        </div>
                        <div className={`processing-stage ${processingStatus.progress >= 35 ? 'completed' : ''} ${processingStatus.stage === 'generating-summary' ? 'active' : ''}`}>
                          <FiFileText size={18} />
                          <span>Generating summary</span>
                        </div>
                        <div className={`processing-stage ${processingStatus.progress >= 65 ? 'completed' : ''} ${processingStatus.stage === 'generating-questions' ? 'active' : ''}`}>
                          <FiGrid size={18} />
                          <span>Creating questions</span>
                        </div>
                        <div className={`processing-stage ${processingStatus.progress >= 100 ? 'completed' : ''}`}>
                          <FiCheckCircle size={18} />
                          <span>Complete</span>
                        </div>
                      </div>

                      {processingStatus.stage === 'failed' && (
                        <button
                          onClick={() => {
                            closeStatusStream();
                            setProcessingStatus({ stage: '', progress: 0, message: '' });
                            setUploadStep(4);
                          }}
                          className="btn btn-primary"
                          style={{ marginTop: '24px' }}
                        >
                          Try Again
                        </button>
                      )}

                      {processingStatus.stage === 'completed' && (
                        <button onClick={handleCompletionClose} className="btn btn-primary" style={{ marginTop: '24px' }}>
                          View Material
                        </button>
                      )}

                      {processingStatus.stage !== 'completed' && processingStatus.stage !== 'failed' && (
                        <p className="processing-note">Please wait while our system processes your material. This may take a few minutes.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {showProfileFallbackSheet && (
                <div
                  className="upload-profile-sheet-overlay"
                  role="presentation"
                  onClick={profileFallbackSaving ? undefined : closeProfileFallbackSheet}
                >
                  <div
                    className="upload-profile-sheet"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="upload-profile-sheet-title"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="upload-profile-sheet-close"
                      onClick={closeProfileFallbackSheet}
                      aria-label="Close profile selector"
                      disabled={profileFallbackSaving}
                    >
                      <FiX />
                    </button>
                    <p className="upload-profile-sheet-kicker">Profile Check</p>
                    <h3 id="upload-profile-sheet-title">Select your faculty and department</h3>
                    <p className="upload-profile-sheet-copy">
                      We will save this to your profile and refresh the upload form in the background so you can continue.
                    </p>

                    <form onSubmit={handleProfileFallbackSubmit} className="upload-profile-sheet-form">
                      <div className="form-group">
                        <label htmlFor="upload-profile-faculty">Faculty</label>
                        <select
                          id="upload-profile-faculty"
                          value={profileFallbackForm.facultyId}
                          onChange={handleProfileFallbackFacultyChange}
                          disabled={profileFallbackSaving}
                          required
                        >
                          <option value="">Select faculty</option>
                          {faculties.map((faculty) => (
                            <option key={faculty._id} value={faculty._id}>
                              {faculty.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="upload-profile-department">Department</label>
                        <select
                          id="upload-profile-department"
                          value={profileFallbackForm.departmentId}
                          onChange={(event) => {
                            setProfileFallbackForm((current) => ({
                              ...current,
                              departmentId: event.target.value,
                            }));
                            setProfileFallbackError('');
                          }}
                          disabled={!profileFallbackForm.facultyId || profileFallbackLoading || profileFallbackSaving}
                          required
                        >
                          <option value="">
                            {profileFallbackForm.facultyId
                              ? profileFallbackLoading
                                ? 'Loading departments...'
                                : 'Select department'
                              : 'Select faculty first'}
                          </option>
                          {profileFallbackDepartments.map((department) => (
                            <option key={department._id} value={department._id}>
                              {department.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {profileFallbackError && <div className="upload-error">{profileFallbackError}</div>}

                      <div className="upload-profile-sheet-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={closeProfileFallbackSheet}
                          disabled={profileFallbackSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={
                            profileFallbackSaving ||
                            profileFallbackLoading ||
                            !profileFallbackForm.facultyId ||
                            !profileFallbackForm.departmentId
                          }
                        >
                          {profileFallbackSaving ? 'Saving...' : 'Save and continue'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {duplicateInfo && (
                <div className="duplicate-dialog-overlay" onClick={() => setDuplicateInfo(null)}>
                  <div className="duplicate-dialog" onClick={(e) => e.stopPropagation()}>
                    <h3>
                      {duplicateInfo.kind === 'course'
                        ? 'Course Already Exists'
                        : 'Material Already Uploaded'}
                    </h3>
                    <p>
                      {duplicateInfo.kind === 'course'
                        ? `"${duplicateInfo.title || 'This course'}"${duplicateInfo.name ? ` (${duplicateInfo.name})` : ''} already exists.`
                        : `"${duplicateInfo.title || 'This material'}" has already been uploaded for this course.`}
                    </p>
                    <div className="dialog-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setDuplicateInfo(null)}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          const courseId = duplicateInfo.courseId;
                          setDuplicateInfo(null);
                          if (courseId && courseId !== 'new') {
                            navigate(`/course/${courseId}`);
                          }
                        }}
                      >
                        Go to Course
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
