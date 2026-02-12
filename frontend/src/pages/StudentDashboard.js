import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import { trackFeatureVisit } from '../utils/featureTracking';
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
  FiPlus
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

const formatBytes = (bytes) => {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const v = n / Math.pow(1024, i);
  const digits = i === 0 ? 0 : (i === 1 ? 0 : 1);
  return `${v.toFixed(digits)} ${units[i]}`;
};

const StudentDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStep, setUploadStep] = useState(1); // 1: Faculty, 2: Department, 3: Course, 4: Material, 5: Processing
  const [uploadForm, setUploadForm] = useState({
    title: '',
    facultyId: '',
    departmentId: '',
    courseId: '',
    file: null
  });
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [uploadStats, setUploadStats] = useState(null);
  const [completedCourseId, setCompletedCourseId] = useState(null);
  const [completedMaterialId, setCompletedMaterialId] = useState(null);
  const [createdCourseId, setCreatedCourseId] = useState(null);
  const [pendingCourse, setPendingCourse] = useState(null);
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
    fetchStats();
    fetchFaculties();
    fetchUploadStats();
    trackFeatureVisit('dashboard');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('upload') === '1') {
      setShowUploadModal(true);
      setUploadStep(1);
    }
  }, [location.search]);

  const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
  const FACULTY_CACHE_KEY = 'np_faculties_cache_v1';
  const DEPT_CACHE_PREFIX = 'np_departments_cache_v1:';

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

  const fetchFaculties = async () => {
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
  };

  const fetchDepartments = async (facultyId) => {
    const cacheKey = `${DEPT_CACHE_PREFIX}${facultyId}`;
    const cached = readCache(cacheKey);
    if (cached) {
      setDepartments(cached);
      return;
    }
    try {
      const response = await api.get(`/faculties/${facultyId}/departments`);
      const data = response.data.data || [];
      setDepartments(data);
      writeCache(cacheKey, data);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };


  const fetchUploadStats = async () => {
    try {
      const response = await api.get('/materials/my-stats');
      setUploadStats(response.data.data);
    } catch (error) {
      console.error('Error fetching upload stats:', error);
    }
  };

  const handleFacultySelect = async (facultyId) => {
    setUploadForm({ ...uploadForm, facultyId, departmentId: '', courseId: '' });
    setUploadError(null);
    if (facultyId) {
      await fetchDepartments(facultyId);
      setUploadStep(2);
    }
  };

  const handleDepartmentSelect = async (departmentId) => {
    setUploadForm({ ...uploadForm, departmentId, courseId: '' });
    setUploadError(null);
    if (departmentId) {
      setUploadStep(3);
    }
  };

  const handleCourseSelect = (courseId) => {
    setUploadForm({ ...uploadForm, courseId });
    setUploadError(null);
    if (courseId && courseId !== 'new') {
      setUploadStep(4);
    }
  };

  const createCourse = async () => {
    const normalizedCode = normalizeCourseCode(newCourse.courseCode);
    const parsedCreditUnits = Number(newCourse.creditUnits);
    const normalizedCreditUnits =
      Number.isFinite(parsedCreditUnits) && parsedCreditUnits >= 1 && parsedCreditUnits <= 6
        ? parsedCreditUnits
        : 3;
    if (!normalizedCode) {
      setUploadError('Course code must be 3 letters and 3 numbers (e.g., BIO 101)');
      return;
    }
    if (!newCourse.courseName.trim()) {
      setUploadError('Please enter course name');
      return;
    }

    const existingCourse = await checkCourseExists({
      normalizedCode,
      courseName: newCourse.courseName,
      departmentId: uploadForm.departmentId,
      creditUnits: normalizedCreditUnits,
    });
    if (existingCourse) {
      setDuplicateInfo({
        kind: 'course',
        courseId: existingCourse._id,
        title: existingCourse.courseCode,
        name: existingCourse.courseName,
      });
      setPendingCourse(null);
      setUploadForm({ ...uploadForm, courseId: '' });
      return;
    }

    setPendingCourse({
      ...newCourse,
      courseCode: normalizedCode,
      creditUnits: normalizedCreditUnits,
    });
    setUploadForm({ ...uploadForm, courseId: 'new' });
    setUploadError(null);
    setUploadStep(4);
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

  const startStatusStream = (materialId) => {
    closeStatusStream();
    const token = localStorage.getItem('token');
    const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').trim();

    if (!token) {
      pollProcessingStatus(materialId);
      return;
    }

    const streamUrl = `${baseUrl}/materials/${materialId}/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);
    sseRef.current = source;

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
    if (!uploadForm.courseId) {
      setUploadError('Please select a course');
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

    const needsTitle = createdCourseId !== uploadForm.courseId;
    const fallbackTitle = uploadForm.file.name.replace(/\.[^/.]+$/, '');
    const resolvedTitle = needsTitle
      ? (uploadForm.title || fallbackTitle)
      : fallbackTitle;
    if (needsTitle && !resolvedTitle.trim()) {
      setUploadError('Please enter a material title');
      return;
    }

    if (uploadForm.courseId === 'new' && !pendingCourse) {
      setUploadError('Please enter course details before uploading');
      setUploadStep(3);
      return;
    }

    if (uploadForm.courseId === 'new' && pendingCourse) {
      const existingCourse = await checkCourseExists({
        normalizedCode: pendingCourse.courseCode,
        courseName: pendingCourse.courseName,
        departmentId: uploadForm.departmentId,
        creditUnits: pendingCourse.creditUnits,
      });
      if (existingCourse) {
        setDuplicateInfo({
          kind: 'course',
          courseId: existingCourse._id,
          title: existingCourse.courseCode,
          name: existingCourse.courseName,
        });
        setPendingCourse(null);
        setUploadForm({ ...uploadForm, courseId: '' });
        return;
      }
    }

    setUploading(true);
    autoNavigateRef.current = false;
    setUploadError(null);
    setUploadSuccess(null);

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

      if (resolvedCourseId === 'new') {
        const response = await api.post('/courses', {
          ...pendingCourse,
          departmentId: uploadForm.departmentId
        });
        resolvedCourseId = response.data.data._id;
        setCreatedCourseId(resolvedCourseId);
        setUploadForm((prev) => ({ ...prev, courseId: resolvedCourseId }));
        setPendingCourse(null);
        setNewCourse({ courseCode: '', courseName: '', creditUnits: 3 });
      }

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
        title: resolvedTitle,
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
          setPendingCourse(null);
          setUploadForm({ ...uploadForm, courseId: '' });
          setProcessingStatus({ stage: '', progress: 0, message: '' });
          setUploadStep(3);
          return;
        }

        const existing = error.response?.data?.existingMaterial || {};
        setDuplicateInfo({
          kind: 'material',
          courseId: resolvedCourseId !== 'new' ? resolvedCourseId : uploadForm.courseId,
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
    setUploadStep(1);
    setUploadForm({ title: '', facultyId: '', departmentId: '', courseId: '', file: null });
    setUploadError(null);
    setUploadSuccess(null);
    setProcessingStatus({ stage: '', progress: 0, message: '' });
    setNewCourse({ courseCode: '', courseName: '', creditUnits: 3 });
    setCompletedCourseId(null);
    setCompletedMaterialId(null);
    uploadTargetRef.current = { courseId: null, materialId: null };
    setCreatedCourseId(null);
    setPendingCourse(null);
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
              onClick={() => {
                setShowUploadModal(true);
                setUploadStep(1);
              }}
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

        {/* Learning Progress */}
        <div className="modern-section learning-progress-section">
          <div className="section-header">
            <div className="section-title-group">
              <FiTrendingUp size={24} className="section-icon" />
              <div>
                <h2>Learning Progress</h2>
                <p>Track your study journey and achievements</p>
              </div>
            </div>
          </div>

          <div className="progress-cards-grid">
            <div className="modern-progress-card card-summaries">
              <div className="progress-card-header">
                <div className="progress-icon-wrapper">
                  <FiBook size={20} />
                </div>
                <div className="progress-stats">
                  <span className="progress-percentage">{stats?.overview?.materialWithSummaries || 0}%</span>
                  <span className="progress-label">Completion</span>
                </div>
              </div>
              <h3>Materials with Summaries</h3>
              <div className="modern-progress-bar">
                <div
                  className="modern-progress-fill fill-blue"
                  style={{ width: `${stats?.overview?.materialWithSummaries || 0}%` }}
                >
                  <span className="progress-shimmer"></span>
                </div>
              </div>
              <div className="progress-footer">
                <span>{stats?.overview?.totalSummaries || 0} of {stats?.overview?.totalMaterials || 0} materials</span>
              </div>
            </div>

            <div className="modern-progress-card card-questions">
              <div className="progress-card-header">
                <div className="progress-icon-wrapper">
                  <FiGrid size={20} />
                </div>
                <div className="progress-stats">
                  <span className="progress-percentage">{stats?.overview?.totalQuestions || 0}</span>
                  <span className="progress-label">Questions</span>
                </div>
              </div>
              <h3>Practice Questions Available</h3>
              <div className="modern-progress-bar">
                <div className="modern-progress-fill fill-green" style={{ width: '100%' }}>
                  <span className="progress-shimmer"></span>
                </div>
              </div>
              <div className="progress-footer">
                <span>Avg {stats?.overview?.avgQuestionsPerCourse || 0} per course</span>
              </div>
            </div>

            <div className="modern-progress-card card-courses">
              <div className="progress-card-header">
                <div className="progress-icon-wrapper">
                  <FiBook size={20} />
                </div>
                <div className="progress-stats">
                  <span className="progress-percentage">{stats?.overview?.totalCourses || 0}</span>
                  <span className="progress-label">Courses</span>
                </div>
              </div>
              <h3>Available Courses</h3>
              <div className="modern-progress-bar">
                <div className="modern-progress-fill fill-purple" style={{ width: '100%' }}>
                  <span className="progress-shimmer"></span>
                </div>
              </div>
              <div className="progress-footer">
                <span>Ready to explore</span>
              </div>
            </div>
          </div>
        </div>

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
                <button onClick={() => setShowUploadModal(true)} className="empty-state-button">
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

        {/* Quick Actions */}
        <div className="quick-actions-section">
          <h2>Quick Actions</h2>
          <div className="quick-actions-grid">
            <Link to="/explore" className="quick-action-card">
              <FiBook size={32} />
              <h3>Explore Courses</h3>
              <p>Browse available courses and study materials</p>
            </Link>

            <Link to="/practice" className="quick-action-card">
              <FiGrid size={32} />
              <h3>Practice Questions</h3>
              <p>Test your knowledge with practice questions</p>
            </Link>

            <button
              onClick={() => {
                setShowUploadModal(true);
                setUploadStep(1);
              }}
              className="quick-action-card upload-card"
            >
              <FiUpload size={32} />
              <h3>Upload Material</h3>
              <p>Share course materials and earn points</p>
            </button>
          </div>
        </div>

        {/* Upload Modal - Multi-Step */}
        {showUploadModal && (
          <div className="modal-overlay">
            <div className="modal-content upload-wizard" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{uploadStep === 5 ? 'Processing Material' : `Upload Material - Step ${uploadStep}/4`}</h2>
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="modal-close"
                  aria-label="Close upload dialog"
                >
                  <FiX />
                </button>
              </div>

              {/* Progress Steps */}
              {uploadStep !== 5 && (
                <div className="upload-steps">
                  <div className={`step ${uploadStep >= 1 ? 'active' : ''}`}>Faculty</div>
                  <div className={`step ${uploadStep >= 2 ? 'active' : ''}`}>Department</div>
                  <div className={`step ${uploadStep >= 3 ? 'active' : ''}`}>Course</div>
                  <div className={`step ${uploadStep >= 4 ? 'active' : ''}`}>Material</div>
                </div>
              )}

              <div className="upload-form">
                {/* Step 1: Faculty Selection */}
                {uploadStep === 1 && (
                  <div className="step-content">
                    <h3>Select Faculty</h3>
                    <p className="step-description">Choose the faculty for your material</p>

                    <div className="selection-grid">
                      {faculties.map((faculty) => (
                        <button
                          key={faculty._id}
                          className={`selection-card ${uploadForm.facultyId === faculty._id ? 'selected' : ''}`}
                          onClick={() => handleFacultySelect(faculty._id)}
                        >
                          <FiBook size={24} />
                          <span>{faculty.name}</span>
                        </button>
                      ))}
                    </div>

                    {faculties.length === 0 && (
                      <div className="empty-message">
                        <FiBook size={48} />
                        <p>No faculties available. Please contact an administrator to add faculties.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Department Selection */}
                {uploadStep === 2 && (
                  <div className="step-content">
                    <h3>Select Department</h3>
                    <p className="step-description">Choose the department for your material</p>

                    <div className="selection-grid">
                      {departments.map((dept) => (
                        <button
                          key={dept._id}
                          className={`selection-card ${uploadForm.departmentId === dept._id ? 'selected' : ''}`}
                          onClick={() => handleDepartmentSelect(dept._id)}
                        >
                          <FiBook size={24} />
                          <span>{dept.name}</span>
                          <small>{dept.code}</small>
                        </button>
                      ))}
                    </div>

                    {departments.length === 0 && (
                      <div className="empty-message">
                        <FiBook size={48} />
                        <p>No departments in this faculty. Please contact an administrator to add departments.</p>
                      </div>
                    )}

                    <button onClick={() => setUploadStep(1)} className="btn btn-secondary btn-back">
                      <FiArrowLeft size={16} /> Back to Faculty
                    </button>
                  </div>
                )}

                {/* Step 3: Course Creation */}
                {uploadStep === 3 && (
                  <div className="step-content">
                    <h3>Create Course</h3>
                    <p className="step-description">Add a new course for this department</p>

                    <div className="selection-grid create-only">
                      <button
                        className={`selection-card create-new ${uploadForm.courseId === 'new' ? 'selected' : ''}`}
                        onClick={() => handleCourseSelect('new')}
                      >
                        <FiPlus size={24} />
                        <span>Create New Course</span>
                      </button>
                    </div>

                    {uploadForm.courseId === 'new' && (
                      <div className="create-form">
                        <h4>Create New Course</h4>
                        <input
                          type="text"
                          value={newCourse.courseCode}
                          onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value.toUpperCase() })}
                          placeholder="Course code (e.g., BIO101)"
                          className="form-input"
                        />
                        <input
                          type="text"
                          value={newCourse.courseName}
                          onChange={(e) => setNewCourse({ ...newCourse, courseName: e.target.value })}
                          placeholder="Course name (e.g., Introduction to Biology)"
                          className="form-input"
                        />
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
                          placeholder="Credit units"
                          className="form-input"
                          min="1"
                          max="6"
                          step="1"
                        />
                        <div className="form-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setUploadForm({ ...uploadForm, courseId: '' });
                              setPendingCourse(null);
                            }}
                            className="btn btn-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={createCourse}
                            className="btn btn-primary"
                            disabled={!newCourse.courseCode.trim() || !newCourse.courseName.trim()}
                          >
                            Continue to Upload
                          </button>
                        </div>
                      </div>
                    )}

                    {uploadForm.courseId && uploadForm.courseId !== 'new' && (
                      <div className="empty-message">
                        <FiBook size={48} />
                        <p>Course created for this department. Click "Create New Course" to add another.</p>
                      </div>
                    )}

                    <button onClick={() => setUploadStep(2)} className="btn btn-secondary btn-back">
                      <FiArrowLeft size={16} /> Back to Department
                    </button>
                  </div>
                )}

                {/* Step 4: Material Upload */}
                {uploadStep === 4 && (
                  <form onSubmit={handleUploadSubmit} className="step-content">
                    <h3>Upload Course Material</h3>

                    {createdCourseId !== uploadForm.courseId && (
                      <div className="form-group">
                        <label>Material Title</label>
                        <input
                          type="text"
                          value={uploadForm.title}
                          onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                          placeholder="e.g., Biology 101 - Chapter 1 Notes"
                          className="form-input"
                          required
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label>PDF File</label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (!file) {
                            setUploadForm({ ...uploadForm, file: null });
                            return;
                          }
                          if (file.type !== 'application/pdf') {
                            setUploadError('Only PDF files are allowed');
                            setUploadForm({ ...uploadForm, file: null });
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
                            setUploadForm({ ...uploadForm, file: null });
                            e.target.value = '';
                            return;
                          }
                          // Cloudinary raw upload limit is 10MB on the current plan.
                          setUploadError(null);
                          setUploadForm({ ...uploadForm, file });
                        }}
                        required
                      />
                      {uploadForm.file && (
                        <p className="file-selected">{uploadForm.file.name}</p>
                      )}
                    </div>

                    {createdCourseId === uploadForm.courseId && (
                      <div className="upload-info">
                        <p><strong>Note:</strong> Your material title will be set from the file name.</p>
                      </div>
                    )}

                    {uploadError && (
                      <div className="upload-error">
                        <FiX /> {uploadError}
                      </div>
                    )}

                    <div className="modal-actions">
                      <button
                        type="button"
                        onClick={() => setUploadStep(3)}
                        className="btn btn-secondary"
                        disabled={uploading}
                      >
                        Back to Course
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={
                          uploading ||
                          !uploadForm.file ||
                          (createdCourseId !== uploadForm.courseId && !uploadForm.title)
                        }
                      >
                        {uploading ? 'Uploading...' : 'Upload Material'}
                      </button>
                    </div>

                    <div className="upload-info">
                      <p><strong>Note:</strong> Our system will generate summaries and practice questions automatically. You'll earn 10 points!</p>
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

                {uploadError && uploadStep < 4 && (
                  <div className="upload-error">
                    <FiX /> {uploadError}
                  </div>
                )}
              </div>

              {duplicateInfo && (
                <div className="duplicate-dialog-overlay">
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
