import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import { trackFeatureVisit } from '../utils/featureTracking';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen,
  FileText,
  LayoutGrid,
  Award,
  TrendingUp,
  Clock,
  Upload,
  X,
  CheckCircle2,
  ChevronRight,
  User,
  Loader2,
} from 'lucide-react';
import ShellHeader from '../shell/ShellHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogPopup, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Sheet, SheetPopup, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { cn } from '../lib/utils';

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
      <div className="np-shell tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
        <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
        <p className="tw:text-sm">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="np-shell tw:space-y-4 tw:p-4">
      <SEO
        title="Student Dashboard - NounPaddi"
        description="Student dashboard for NounPaddi activity, uploads, summaries, and leaderboard progress."
        url="/dashboard"
        keywords="student dashboard, nounpaddi dashboard, uploads, leaderboard"
        robots="noindex, nofollow"
      />

      <ShellHeader title="My Learning Dashboard" className="tw:-mx-4 tw:-mt-4" />

      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Track your progress and explore study materials</p>
        <Link
          to="/profile"
          className="tw:flex tw:flex-none tw:items-center tw:gap-1.5 tw:rounded-xl tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300"
        >
          <User className="tw:h-3.5 tw:w-3.5" /> Profile
        </Link>
      </div>

      <Card className="tw:space-y-3 tw:border-brand-200 tw:bg-brand-50 tw:p-4 tw:dark:border-brand-900 tw:dark:bg-brand-950/40">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">Need a course summary?</p>
          <h2 className="tw:font-heading tw:mt-1 tw:text-base tw:font-bold">Get Course Summary &amp; Questions</h2>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">
            Upload your course material once and we will generate a clean summary plus exam questions.
          </p>
        </div>
        <Button onClick={openUploadModal} className="tw:w-full">
          <Upload className="tw:h-4 tw:w-4" /> Get Course Summary
        </Button>
      </Card>

      <div className="tw:grid tw:grid-cols-2 tw:gap-2.5">
        <Card className="tw:flex tw:items-center tw:gap-3 tw:p-3.5">
          <span className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-blue-100 tw:text-blue-600 tw:dark:bg-blue-500/15 tw:dark:text-blue-300"><BookOpen className="tw:h-4 tw:w-4" /></span>
          <div>
            <h3 className="tw:font-heading tw:text-lg tw:font-bold tw:leading-none">{stats?.overview?.totalCourses || 0}</h3>
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Available Courses</p>
          </div>
        </Card>
        <Card className="tw:flex tw:items-center tw:gap-3 tw:p-3.5">
          <span className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><FileText className="tw:h-4 tw:w-4" /></span>
          <div>
            <h3 className="tw:font-heading tw:text-lg tw:font-bold tw:leading-none">{stats?.overview?.totalMaterials || 0}</h3>
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Study Materials</p>
          </div>
        </Card>
        <Card className="tw:flex tw:items-center tw:gap-3 tw:p-3.5">
          <span className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-emerald-100 tw:text-emerald-600 tw:dark:bg-emerald-950 tw:dark:text-emerald-300"><FileText className="tw:h-4 tw:w-4" /></span>
          <div>
            <h3 className="tw:font-heading tw:text-lg tw:font-bold tw:leading-none">{stats?.overview?.totalSummaries || 0}</h3>
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Summaries</p>
            <p className="tw:text-[11px] tw:text-slate-400">{stats?.overview?.materialWithSummaries || 0}% of materials</p>
          </div>
        </Card>
        <Card className="tw:flex tw:items-center tw:gap-3 tw:p-3.5">
          <span className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-amber-100 tw:text-amber-600 tw:dark:bg-amber-500/15 tw:dark:text-amber-300"><LayoutGrid className="tw:h-4 tw:w-4" /></span>
          <div>
            <h3 className="tw:font-heading tw:text-lg tw:font-bold tw:leading-none">{stats?.overview?.totalQuestions || 0}</h3>
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Practice Questions</p>
            <p className="tw:text-[11px] tw:text-slate-400">{stats?.overview?.avgQuestionsPerCourse || 0} per course</p>
          </div>
        </Card>
      </div>

      {gamificationData && (
        <div className="tw:space-y-3">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Award className="tw:h-5 tw:w-5 tw:text-brand-600 tw:dark:text-brand-400" />
            <div>
              <h2 className="tw:font-heading tw:text-base tw:font-bold">Gamification</h2>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Your points, activity, and leaderboard position</p>
            </div>
          </div>

          <div className="tw:grid tw:grid-cols-2 tw:gap-2.5">
            <Card className="tw:p-3.5 tw:text-center">
              <h3 className="tw:font-heading tw:text-lg tw:font-bold">{gamificationData?.totals?.totalPoints || 0}</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Total Points</p>
            </Card>
            <Card className="tw:p-3.5 tw:text-center">
              <h3 className="tw:font-heading tw:text-lg tw:font-bold">{gamificationData?.totals?.practicePoints || 0}</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Practice Points</p>
            </Card>
            <Card className="tw:p-3.5 tw:text-center">
              <h3 className="tw:font-heading tw:text-lg tw:font-bold">{gamificationData?.totals?.readingPoints || 0}</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Reading Points</p>
            </Card>
            <Card className="tw:p-3.5 tw:text-center">
              <h3 className="tw:font-heading tw:text-lg tw:font-bold">{gamificationData?.totals?.summariesCompleted || 0}</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Summaries Completed</p>
            </Card>
          </div>

          <Card className="tw:space-y-2 tw:p-4">
            <div>
              <h3 className="tw:font-heading tw:text-sm tw:font-bold">Overall Toppers</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Top students by total gamification points</p>
            </div>
            <div className="tw:space-y-1.5">
              {(gamificationData?.leaderboards?.overall || []).slice(0, 10).map((entry) => (
                <div
                  key={`${entry.studentId}-overall`}
                  className={cn(
                    'tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:p-2.5 tw:text-sm',
                    entry.isMe ? 'tw:bg-brand-50 tw:dark:bg-brand-950/40' : 'tw:bg-slate-50 tw:dark:bg-slate-800/60',
                  )}
                >
                  <span className="tw:w-6 tw:flex-none tw:text-center tw:text-xs tw:font-bold">{rankLabel(entry.rank)}</span>
                  <span className="tw:flex-1 tw:truncate">{entry.studentName}</span>
                  <strong className="tw:text-xs tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{entry.totalPoints} pts</strong>
                  <span className="tw:text-[11px] tw:text-slate-400">{entry.attempts || 0} activities</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:sm:grid-cols-2">
            <Card className="tw:space-y-2 tw:p-4">
              <h3 className="tw:font-heading tw:text-sm tw:font-bold">Practice Leaders</h3>
              <div className="tw:space-y-1.5">
                {(gamificationData?.leaderboards?.practice || []).slice(0, 5).map((entry) => (
                  <div key={`${entry.studentId}-practice`} className={cn('tw:flex tw:items-center tw:justify-between tw:rounded-lg tw:px-2.5 tw:py-1.5 tw:text-xs', entry.isMe && 'tw:bg-brand-50 tw:dark:bg-brand-950/40')}>
                    <span>{rankLabel(entry.rank)} {entry.studentName}</span>
                    <strong>{entry.totalPoints} pts</strong>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="tw:space-y-2 tw:p-4">
              <h3 className="tw:font-heading tw:text-sm tw:font-bold">Top Readers</h3>
              <div className="tw:space-y-1.5">
                {(gamificationData?.leaderboards?.readers || []).slice(0, 5).map((entry) => (
                  <div key={`${entry.studentId}-readers`} className={cn('tw:flex tw:items-center tw:justify-between tw:rounded-lg tw:px-2.5 tw:py-1.5 tw:text-xs', entry.isMe && 'tw:bg-brand-50 tw:dark:bg-brand-950/40')}>
                    <span>{rankLabel(entry.rank)} {entry.studentName}</span>
                    <strong>{entry.totalPoints} pts</strong>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="tw:space-y-2 tw:p-4">
            <h3 className="tw:font-heading tw:text-sm tw:font-bold">Recent Activity</h3>
            {gamificationData?.recentActivities?.length > 0 ? (
              <div className="tw:space-y-1.5">
                {gamificationData.recentActivities.slice(0, 8).map((activity) => (
                  <div key={activity._id} className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:rounded-lg tw:bg-slate-50 tw:p-2.5 tw:dark:bg-slate-800/60">
                    <div>
                      <strong className="tw:block tw:text-xs tw:font-semibold">{describeActivity(activity)}</strong>
                      <p className="tw:text-[11px] tw:text-slate-500 tw:dark:text-slate-400">
                        {activity.course
                          ? `${activity.course.courseCode} - ${activity.course.courseName}`
                          : 'General activity'}
                      </p>
                    </div>
                    <span className="tw:flex-none tw:text-xs tw:font-bold tw:text-emerald-600 tw:dark:text-emerald-400">+{activity.points || 0}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">No activity yet. Start practicing or complete a summary.</p>
            )}
          </Card>
        </div>
      )}

      <div className="tw:space-y-2.5">
        <div className="tw:flex tw:items-center tw:justify-between">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Clock className="tw:h-5 tw:w-5 tw:text-brand-600 tw:dark:text-brand-400" />
            <div>
              <h2 className="tw:font-heading tw:text-base tw:font-bold">Recently Added Materials</h2>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Latest study materials uploaded to the platform</p>
            </div>
          </div>
          <Link to="/explore" className="tw:flex tw:flex-none tw:items-center tw:gap-0.5 tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
            View All <ChevronRight className="tw:h-3.5 tw:w-3.5" />
          </Link>
        </div>

        {stats?.recentMaterials && stats.recentMaterials.length > 0 ? (
          <div className="tw:space-y-2.5">
            {stats.recentMaterials.slice(0, 6).map((material) => (
              <Link key={material._id} to={`/course/${material.courseId?._id}`}>
                <Card interactive className="tw:flex tw:items-start tw:gap-3 tw:p-3.5">
                  <span className="tw:flex tw:h-10 tw:w-10 tw:flex-none tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                    <FileText className="tw:h-4.5 tw:w-4.5" />
                  </span>
                  <div className="tw:min-w-0 tw:flex-1">
                    <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
                      <h3 className="tw:truncate tw:text-sm tw:font-bold">{material.title}</h3>
                      <span className="tw:flex-none tw:rounded-full tw:bg-emerald-100 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-bold tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300">New</span>
                    </div>
                    <p className="tw:truncate tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                      {material.courseId?.courseCode} - {material.courseId?.courseName}
                    </p>
                    <div className="tw:mt-1.5 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-[11px] tw:text-slate-400">
                      <span className="tw:flex tw:items-center tw:gap-1"><Clock className="tw:h-3 tw:w-3" /> {formatDate(material.createdAt)}</span>
                      {material.hasSummary && <span className="tw:flex tw:items-center tw:gap-1 tw:text-brand-600 tw:dark:text-brand-400"><BookOpen className="tw:h-3 tw:w-3" /> Summary</span>}
                      {material.hasQuestions && <span className="tw:flex tw:items-center tw:gap-1 tw:text-amber-600 tw:dark:text-amber-400"><LayoutGrid className="tw:h-3 tw:w-3" /> Questions</span>}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
            <FileText className="tw:h-8 tw:w-8 tw:text-slate-300 tw:dark:text-slate-600" />
            <h3 className="tw:font-heading tw:text-sm tw:font-bold">No materials available yet</h3>
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Be the first to upload study materials!</p>
            <Button onClick={openUploadModal} size="sm"><Upload className="tw:h-3.5 tw:w-3.5" /> Upload Material</Button>
          </Card>
        )}
      </div>

      {uploadStats && uploadStats.totalUploads > 0 && (
        <div className="tw:space-y-2.5">
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Award className="tw:h-5 tw:w-5 tw:text-brand-600 tw:dark:text-brand-400" />
              <div>
                <h2 className="tw:font-heading tw:text-base tw:font-bold">My Contributions</h2>
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Thank you for contributing to the community!</p>
              </div>
            </div>
            <span className="tw:flex tw:flex-none tw:items-center tw:gap-1 tw:rounded-full tw:bg-emerald-100 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-bold tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300">
              <TrendingUp className="tw:h-3 tw:w-3" /> Active
            </span>
          </div>

          <div className="tw:grid tw:grid-cols-2 tw:gap-2.5">
            <Card className="tw:space-y-2 tw:p-3.5">
              <FileText className="tw:h-5 tw:w-5 tw:text-brand-600 tw:dark:text-brand-400" />
              <h3 className="tw:font-heading tw:text-lg tw:font-bold tw:leading-none">{uploadStats.totalUploads}</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Materials Uploaded</p>
              <div className="tw:h-1.5 tw:overflow-hidden tw:rounded-full tw:bg-slate-100 tw:dark:bg-slate-800">
                <div className="tw:h-full tw:rounded-full tw:bg-brand-500" style={{ width: `${Math.min((uploadStats.totalUploads / 10) * 100, 100)}%` }} />
              </div>
              <p className="tw:text-[11px] tw:text-slate-400">
                {uploadStats.totalUploads >= 10 ? 'Goal reached!' : `${10 - uploadStats.totalUploads} more to unlock Bronze Badge`}
              </p>
            </Card>
            <Card className="tw:space-y-2 tw:p-3.5">
              <Award className="tw:h-5 tw:w-5 tw:text-amber-600 tw:dark:text-amber-400" />
              <h3 className="tw:font-heading tw:text-lg tw:font-bold tw:leading-none">{uploadStats.totalPoints}</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Points Earned</p>
              <p className="tw:text-[11px] tw:text-slate-400">+10 pts per upload</p>
            </Card>
            <Card className="tw:space-y-2 tw:p-3.5">
              <CheckCircle2 className="tw:h-5 tw:w-5 tw:text-emerald-600 tw:dark:text-emerald-400" />
              <h3 className="tw:font-heading tw:text-lg tw:font-bold tw:leading-none">{uploadStats.completed}</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Processed Successfully</p>
              <p className="tw:text-[11px] tw:text-slate-400">
                {uploadStats.totalUploads > 0
                  ? `${Math.round((uploadStats.completed / uploadStats.totalUploads) * 100)}% success rate`
                  : '0% success rate'}
              </p>
            </Card>
            <Card className="tw:space-y-2 tw:p-3.5">
              <Clock className="tw:h-5 tw:w-5 tw:text-slate-500 tw:dark:text-slate-400" />
              <h3 className="tw:font-heading tw:text-lg tw:font-bold tw:leading-none">{uploadStats.pending || 0}</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Processing</p>
              <p className="tw:text-[11px] tw:text-slate-400">Auto-generating content...</p>
            </Card>
          </div>

          {uploadStats.totalUploads >= 10 && (
            <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-xl tw:bg-amber-100 tw:p-3 tw:text-xs tw:font-semibold tw:text-amber-700 tw:dark:bg-amber-500/15 tw:dark:text-amber-300">
              <Award className="tw:h-4 tw:w-4 tw:flex-none" /> Congratulations! You've unlocked the Bronze Contributor badge!
            </div>
          )}
        </div>
      )}

      {/* Upload Modal - Multi-Step */}
      <Dialog open={showUploadModal} onOpenChange={(open) => { if (!open) closeUploadModal(); }}>
        <DialogPopup className="tw:max-w-md">
          <DialogHeader>
            <DialogTitle>{uploadStep === 5 ? 'Processing Material' : 'Upload Material'}</DialogTitle>
          </DialogHeader>

          <div className="tw:mt-3 tw:max-h-[70vh] tw:space-y-4 tw:overflow-y-auto tw:pr-0.5">
            {uploadStep === 4 && (
              <form onSubmit={handleUploadSubmit} className="tw:space-y-3.5">
                <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:text-xs tw:dark:bg-slate-800/60">
                  <div>
                    <span className="tw:block tw:text-slate-400">Faculty</span>
                    <strong className="tw:block tw:truncate">{uploadContext.facultyName || 'Not available'}</strong>
                  </div>
                  <div>
                    <span className="tw:block tw:text-slate-400">Department</span>
                    <strong className="tw:block tw:truncate">{uploadContext.departmentName || 'Not available'}</strong>
                  </div>
                </div>

                {!uploadForm.departmentId && (
                  <div className="tw:space-y-2 tw:rounded-xl tw:bg-amber-50 tw:p-3 tw:text-xs tw:text-amber-700 tw:dark:bg-amber-500/10 tw:dark:text-amber-300">
                    <p>We could not detect your upload department from your profile.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openProfileFallbackSheet()}
                      disabled={profileFallbackSaving}
                    >
                      Select faculty and department
                    </Button>
                  </div>
                )}

                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Course Code</span>
                  <Input
                    type="text"
                    value={newCourse.courseCode}
                    onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value.toUpperCase() })}
                    placeholder="e.g., GST 105"
                    required
                  />
                </label>

                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Course Name</span>
                  <Input
                    type="text"
                    value={newCourse.courseName}
                    onChange={(e) => setNewCourse({ ...newCourse, courseName: e.target.value })}
                    placeholder="e.g., Use of English and Communication Skills"
                    required
                  />
                </label>

                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Course Unit</span>
                  <Input
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
                    min="1"
                    max="6"
                    step="1"
                    required
                  />
                </label>

                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Attach Material</span>
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
                    className="tw:block tw:w-full tw:text-xs tw:text-slate-500 tw:file:mr-3 tw:file:rounded-lg tw:file:border-0 tw:file:bg-brand-50 tw:file:px-3 tw:file:py-2 tw:file:text-xs tw:file:font-semibold tw:file:text-brand-700 tw:dark:file:bg-brand-950 tw:dark:file:text-brand-300"
                  />
                  {uploadForm.file && (
                    <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{uploadForm.file.name}</p>
                  )}
                </label>

                {uploadError && (
                  <div className="tw:flex tw:items-start tw:gap-2 tw:rounded-xl tw:bg-red-100 tw:p-3 tw:text-xs tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">
                    <X className="tw:h-3.5 tw:w-3.5 tw:flex-none" /> <div>{uploadError}</div>
                  </div>
                )}

                <div className="tw:flex tw:gap-2">
                  <Button type="button" onClick={closeUploadModal} variant="outline" disabled={uploading} className="tw:flex-1">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="tw:flex-1"
                    disabled={
                      uploading ||
                      !uploadForm.departmentId ||
                      !uploadForm.file ||
                      !newCourse.courseCode.trim() ||
                      !newCourse.courseName.trim()
                    }
                  >
                    {uploading ? 'Uploading...' : 'Upload Material'}
                  </Button>
                </div>

                <p className="tw:text-[11px] tw:text-slate-400">
                  <strong>Tip:</strong> Keep your PDF under {formatBytes(MAX_CLOUDINARY_RAW_UPLOAD_BYTES)}. If it is larger, compress it and re-upload using:{' '}
                  {PDF_COMPRESS_SITES.map((s, idx) => (
                    <span key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="tw:text-brand-600 tw:dark:text-brand-400">{s.label}</a>
                      {idx === PDF_COMPRESS_SITES.length - 1 ? '' : ', '}
                    </span>
                  ))}
                  .
                </p>
              </form>
            )}

            {uploadStep === 5 && (
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-3 tw:text-center">
                {processingStatus.stage === 'completed' ? (
                  <span className="tw:flex tw:h-14 tw:w-14 tw:items-center tw:justify-center tw:rounded-full tw:bg-emerald-100 tw:text-emerald-600 tw:dark:bg-emerald-950 tw:dark:text-emerald-300"><CheckCircle2 className="tw:h-7 tw:w-7" /></span>
                ) : processingStatus.stage === 'failed' ? (
                  <span className="tw:flex tw:h-14 tw:w-14 tw:items-center tw:justify-center tw:rounded-full tw:bg-red-100 tw:text-red-600 tw:dark:bg-red-500/15 tw:dark:text-red-300"><X className="tw:h-7 tw:w-7" /></span>
                ) : (
                  <span className="tw:flex tw:h-14 tw:w-14 tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><Loader2 className="tw:h-7 tw:w-7 tw:animate-spin" /></span>
                )}

                <h3 className="tw:font-heading tw:text-base tw:font-bold">
                  {processingStatus.stage === 'completed' ? 'Upload Complete!' : processingStatus.stage === 'failed' ? 'Processing Failed' : 'Processing Your Material'}
                </h3>
                <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">{processingStatus.message}</p>

                {processingStatus.stage !== 'failed' && (
                  <div className="tw:flex tw:w-full tw:items-center tw:gap-2">
                    <div className="tw:h-1.5 tw:flex-1 tw:overflow-hidden tw:rounded-full tw:bg-slate-100 tw:dark:bg-slate-800">
                      <div className="tw:h-full tw:rounded-full tw:bg-brand-500 tw:transition-all" style={{ width: `${processingStatus.progress}%` }} />
                    </div>
                    <span className="tw:flex-none tw:text-xs tw:font-bold">{processingStatus.progress}%</span>
                  </div>
                )}

                <div className="tw:grid tw:w-full tw:grid-cols-2 tw:gap-2 tw:text-left">
                  {[
                    { icon: Upload, label: 'Uploading file', done: processingStatus.progress >= 10 },
                    { icon: FileText, label: 'Generating summary', done: processingStatus.progress >= 35, active: processingStatus.stage === 'generating-summary' },
                    { icon: LayoutGrid, label: 'Creating questions', done: processingStatus.progress >= 65, active: processingStatus.stage === 'generating-questions' },
                    { icon: CheckCircle2, label: 'Complete', done: processingStatus.progress >= 100 },
                  ].map(({ icon: StageIcon, label, done, active }) => (
                    <div
                      key={label}
                      className={cn(
                        'tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:p-2 tw:text-[11px] tw:font-medium',
                        done
                          ? 'tw:bg-emerald-50 tw:text-emerald-700 tw:dark:bg-emerald-950/40 tw:dark:text-emerald-300'
                          : active
                          ? 'tw:bg-brand-50 tw:text-brand-700 tw:dark:bg-brand-950/40 tw:dark:text-brand-300'
                          : 'tw:bg-slate-50 tw:text-slate-400 tw:dark:bg-slate-800/60 tw:dark:text-slate-500',
                      )}
                    >
                      <StageIcon className="tw:h-3.5 tw:w-3.5 tw:flex-none" /> {label}
                    </div>
                  ))}
                </div>

                {processingStatus.stage === 'failed' && (
                  <Button
                    onClick={() => {
                      closeStatusStream();
                      setProcessingStatus({ stage: '', progress: 0, message: '' });
                      setUploadStep(4);
                    }}
                    className="tw:w-full"
                  >
                    Try Again
                  </Button>
                )}

                {processingStatus.stage === 'completed' && (
                  <Button onClick={handleCompletionClose} className="tw:w-full">View Material</Button>
                )}

                {processingStatus.stage !== 'completed' && processingStatus.stage !== 'failed' && (
                  <p className="tw:text-[11px] tw:text-slate-400">Please wait while our system processes your material. This may take a few minutes.</p>
                )}
              </div>
            )}
          </div>
        </DialogPopup>
      </Dialog>

      <Sheet
        open={showProfileFallbackSheet}
        onOpenChange={(open) => { if (!open && !profileFallbackSaving) closeProfileFallbackSheet(); }}
      >
        <SheetPopup>
          <SheetHeader>
            <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">Profile Check</p>
            <SheetTitle>Select your faculty and department</SheetTitle>
            <SheetDescription>
              We will save this to your profile and refresh the upload form in the background so you can continue.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleProfileFallbackSubmit} className="tw:mt-4 tw:space-y-3.5">
            <label className="tw:block tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Faculty</span>
              <select
                value={profileFallbackForm.facultyId}
                onChange={handleProfileFallbackFacultyChange}
                disabled={profileFallbackSaving}
                required
                className="tw:h-11 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100"
              >
                <option value="">Select faculty</option>
                {faculties.map((faculty) => (
                  <option key={faculty._id} value={faculty._id}>{faculty.name}</option>
                ))}
              </select>
            </label>

            <label className="tw:block tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Department</span>
              <select
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
                className="tw:h-11 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100"
              >
                <option value="">
                  {profileFallbackForm.facultyId
                    ? profileFallbackLoading
                      ? 'Loading departments...'
                      : 'Select department'
                    : 'Select faculty first'}
                </option>
                {profileFallbackDepartments.map((department) => (
                  <option key={department._id} value={department._id}>{department.name}</option>
                ))}
              </select>
            </label>

            {profileFallbackError && (
              <div className="tw:rounded-xl tw:bg-red-100 tw:p-3 tw:text-xs tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">{profileFallbackError}</div>
            )}

            <div className="tw:flex tw:gap-2">
              <Button type="button" variant="outline" onClick={closeProfileFallbackSheet} disabled={profileFallbackSaving} className="tw:flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                className="tw:flex-1"
                disabled={
                  profileFallbackSaving ||
                  profileFallbackLoading ||
                  !profileFallbackForm.facultyId ||
                  !profileFallbackForm.departmentId
                }
              >
                {profileFallbackSaving ? 'Saving...' : 'Save and continue'}
              </Button>
            </div>
          </form>
        </SheetPopup>
      </Sheet>

      <Dialog open={!!duplicateInfo} onOpenChange={(open) => { if (!open) setDuplicateInfo(null); }}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{duplicateInfo?.kind === 'course' ? 'Course Already Exists' : 'Material Already Uploaded'}</DialogTitle>
          </DialogHeader>
          <p className="tw:mt-2 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">
            {duplicateInfo?.kind === 'course'
              ? `"${duplicateInfo?.title || 'This course'}"${duplicateInfo?.name ? ` (${duplicateInfo.name})` : ''} already exists.`
              : `"${duplicateInfo?.title || 'This material'}" has already been uploaded for this course.`}
          </p>
          <div className="tw:mt-4 tw:flex tw:gap-2">
            <Button variant="outline" onClick={() => setDuplicateInfo(null)} className="tw:flex-1">Close</Button>
            <Button
              onClick={() => {
                const courseId = duplicateInfo?.courseId;
                setDuplicateInfo(null);
                if (courseId && courseId !== 'new') {
                  navigate(`/course/${courseId}`);
                }
              }}
              className="tw:flex-1"
            >
              Go to Course
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
    </div>
  );
};

export default StudentDashboard;
