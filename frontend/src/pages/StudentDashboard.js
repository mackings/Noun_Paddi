import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
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
  FiLoader
} from 'react-icons/fi';
import './StudentDashboard.css';

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
  const [courses, setCourses] = useState([]);
  const [uploadStats, setUploadStats] = useState(null);

  // Processing state for progress tracking
  const [processingStatus, setProcessingStatus] = useState({
    stage: '', // 'uploading', 'generating-summary', 'generating-questions', 'completed', 'failed'
    progress: 0,
    message: ''
  });
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    fetchStats();
    fetchFaculties();
    fetchUploadStats();
  }, []);

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
    try {
      const response = await api.get('/faculties');
      setFaculties(response.data.data || []);
    } catch (error) {
      console.error('Error fetching faculties:', error);
    }
  };

  const fetchDepartments = async (facultyId) => {
    try {
      const response = await api.get(`/faculties/${facultyId}/departments`);
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };

  const fetchCourses = async (departmentId) => {
    try {
      const response = await api.get(`/courses/department/${departmentId}`);
      setCourses(response.data.data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
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
      await fetchCourses(departmentId);
      setUploadStep(3);
    }
  };

  const handleCourseSelect = (courseId) => {
    setUploadForm({ ...uploadForm, courseId });
    setUploadError(null);
    if (courseId) {
      setUploadStep(4);
    }
  };

  // Poll for material processing status
  const pollProcessingStatus = async (materialId) => {
    try {
      const response = await api.get(`/materials/${materialId}/status`);
      const { processingStatus: status, hasSummary, hasQuestions } = response.data.data;

      if (status === 'processing') {
        // Determine progress based on what's been generated
        if (hasSummary && !hasQuestions) {
          setProcessingStatus({
            stage: 'generating-questions',
            progress: 65,
            message: 'Generating practice questions...'
          });
        } else if (!hasSummary) {
          setProcessingStatus({
            stage: 'generating-summary',
            progress: 35,
            message: 'Generating AI summary...'
          });
        }
      } else if (status === 'completed') {
        setProcessingStatus({
          stage: 'completed',
          progress: 100,
          message: 'Processing complete! Summary and questions are ready.'
        });
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        // Refresh stats
        fetchUploadStats();
        fetchStats();
        // Show success for a bit then close
        setTimeout(() => {
          resetUploadModal();
        }, 3000);
      } else if (status === 'failed') {
        setProcessingStatus({
          stage: 'failed',
          progress: 0,
          message: response.data.data.processingError || 'Processing failed. Please try again.'
        });
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error polling status:', error);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    // Move to processing step
    setUploadStep(5);
    setProcessingStatus({
      stage: 'uploading',
      progress: 10,
      message: 'Uploading your file...'
    });

    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('title', uploadForm.title);
      formData.append('courseId', uploadForm.courseId);

      const response = await api.post('/materials/student-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const materialId = response.data.data._id;

      // Update progress - file uploaded, now processing
      setProcessingStatus({
        stage: 'generating-summary',
        progress: 25,
        message: 'File uploaded! Generating AI summary...'
      });

      // Start polling for processing status
      pollingIntervalRef.current = setInterval(() => {
        pollProcessingStatus(materialId);
      }, 3000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.response?.data?.message || 'Failed to upload material');
      setProcessingStatus({
        stage: 'failed',
        progress: 0,
        message: error.response?.data?.message || 'Failed to upload material'
      });
    } finally {
      setUploading(false);
    }
  };

  const resetUploadModal = () => {
    // Stop any ongoing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setShowUploadModal(false);
    setUploadStep(1);
    setUploadForm({ title: '', facultyId: '', departmentId: '', courseId: '', file: null });
    setUploadError(null);
    setUploadSuccess(null);
    setProcessingStatus({ stage: '', progress: 0, message: '' });
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
          <div className="modal-overlay" onClick={uploadStep !== 5 ? resetUploadModal : undefined}>
            <div className="modal-content upload-wizard" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{uploadStep === 5 ? 'Processing Material' : `Upload Material - Step ${uploadStep}/4`}</h2>
                {uploadStep !== 5 && (
                  <button onClick={resetUploadModal} className="modal-close">
                    <FiX />
                  </button>
                )}
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

                {/* Step 3: Course Selection */}
                {uploadStep === 3 && (
                  <div className="step-content">
                    <h3>Select Course</h3>
                    <p className="step-description">Choose the course for your material</p>

                    <div className="selection-grid">
                      {courses.map((course) => (
                        <button
                          key={course._id}
                          className={`selection-card ${uploadForm.courseId === course._id ? 'selected' : ''}`}
                          onClick={() => handleCourseSelect(course._id)}
                        >
                          <FiBook size={24} />
                          <span>{course.courseCode}</span>
                          <small>{course.courseName}</small>
                        </button>
                      ))}
                    </div>

                    {courses.length === 0 && (
                      <div className="empty-message">
                        <FiBook size={48} />
                        <p>No courses in this department. Please contact an administrator to add courses.</p>
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

                    <div className="form-group">
                      <label>PDF File</label>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
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
                        onClick={() => setUploadStep(3)}
                        className="btn btn-secondary"
                        disabled={uploading}
                      >
                        Back to Course
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={uploading || !uploadForm.file || !uploadForm.title}
                      >
                        {uploading ? 'Uploading...' : 'Upload Material'}
                      </button>
                    </div>

                    <div className="upload-info">
                      <p><strong>Note:</strong> Our AI will automatically generate summaries and practice questions. You'll earn 10 points!</p>
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
                        <button onClick={resetUploadModal} className="btn btn-primary" style={{ marginTop: '24px' }}>
                          Try Again
                        </button>
                      )}

                      {processingStatus.stage !== 'completed' && processingStatus.stage !== 'failed' && (
                        <p className="processing-note">Please wait while our AI processes your material. This may take a few minutes.</p>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
