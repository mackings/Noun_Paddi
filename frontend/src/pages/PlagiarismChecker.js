import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import SEO from '../components/SEO';
import { trackFeatureVisit } from '../utils/featureTracking';
import {
  FiUpload, FiFileText, FiCheckCircle, FiAlertTriangle,
  FiAlertCircle, FiClock, FiTrash2, FiEye, FiX,
  FiExternalLink, FiRefreshCw, FiInfo, FiChevronDown,
  FiChevronUp, FiDownload
} from 'react-icons/fi';
import './PlagiarismChecker.css';

const PlagiarismChecker = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('upload');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [title, setTitle] = useState('');
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [expandedMatches, setExpandedMatches] = useState({});

  useEffect(() => {
    fetchFaculties();
    fetchReports();
    trackFeatureVisit('plagiarism');
  }, []);

  const fetchFaculties = async () => {
    try {
      const response = await api.get('/faculties');
      setFaculties(response.data.data || []);
    } catch (err) {
      console.error('Error fetching faculties:', err);
    }
  };

  const fetchDepartments = async (facultyId) => {
    try {
      const response = await api.get(`/faculties/${facultyId}/departments`);
      setDepartments(response.data.data || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
      setDepartments([]);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get('/plagiarism/reports');
      setReports(response.data.data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFacultyChange = (e) => {
    const facultyId = e.target.value;
    setSelectedFaculty(facultyId);
    setSelectedDepartment('');
    if (facultyId) {
      fetchDepartments(facultyId);
    } else {
      setDepartments([]);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (selectedFile) => {
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF or Word document (.pdf, .doc, .docx)');
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }

    setFile(selectedFile);
    setError('');
  };

  const pollForStatus = async (submissionId) => {
    const maxAttempts = 60; // Poll for up to 2 minutes (60 * 2s)
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await api.get(`/plagiarism/status/${submissionId}`);
        const submission = response.data.data;

        if (submission.status === 'completed') {
          setResult(submission);
          setActiveTab('result');
          fetchReports();
          setChecking(false);
          // Reset form
          setFile(null);
          setTitle('');
          setSelectedFaculty('');
          setSelectedDepartment('');
          return;
        }

        if (submission.status === 'failed') {
          setError(submission.errorMessage || 'Plagiarism check failed. Please try again.');
          setChecking(false);
          return;
        }

        // Still checking, poll again
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Poll every 2 seconds
        } else {
          setError('Check is taking longer than expected. Please check history for results.');
          setChecking(false);
        }
      } catch (err) {
        console.error('Poll error:', err);
        setError('Failed to get check status. Please check history for results.');
        setChecking(false);
      }
    };

    poll();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file to check');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a project title');
      return;
    }

    if (!selectedFaculty) {
      setError('Please select a faculty');
      return;
    }

    setChecking(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('facultyId', selectedFaculty);
      if (selectedDepartment) {
        formData.append('departmentId', selectedDepartment);
      }

      const response = await api.post('/plagiarism/check', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30s timeout for upload only
      });

      // Backend returns submissionId, start polling
      const submissionId = response.data.data.submissionId;
      pollForStatus(submissionId);

    } catch (err) {
      console.error('Plagiarism check error:', err);
      setError(err.response?.data?.message || 'Failed to upload document. Please try again.');
      setChecking(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;

    try {
      await api.delete(`/plagiarism/reports/${reportId}`);
      setReports(reports.filter(r => r._id !== reportId));
      if (selectedReport?._id === reportId) {
        setShowReportModal(false);
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete report');
    }
  };

  const openReportModal = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Moderate';
    return 'High Risk';
  };

  const toggleMatchExpand = (index) => {
    setExpandedMatches(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="plagiarism-checker-container">
      <SEO
        title="Plagiarism Checker - NounPaddi"
        description="Check your academic projects for plagiarism and system-detected content patterns"
      />

      <div className="plagiarism-header">
        <h1>Plagiarism Checker</h1>
        <p>Check your projects for system-detected content patterns and web matches</p>
      </div>

      <div className="plagiarism-tabs">
        <button
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <FiUpload /> Upload & Check
        </button>
        <button
          className={`tab-btn ${activeTab === 'result' ? 'active' : ''}`}
          onClick={() => setActiveTab('result')}
          disabled={!result}
        >
          <FiCheckCircle /> Latest Result
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <FiClock /> History ({reports.length})
        </button>
      </div>

      <div className="plagiarism-content">
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="upload-section">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Project Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter your project title"
                  disabled={checking}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Faculty *</label>
                  <select
                    value={selectedFaculty}
                    onChange={handleFacultyChange}
                    disabled={checking}
                  >
                    <option value="">Select Faculty</option>
                    {faculties.map(faculty => (
                      <option key={faculty._id} value={faculty._id}>
                        {faculty.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Department (Optional)</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    disabled={checking || !selectedFaculty}
                  >
                    <option value="">Select Department</option>
                    {departments.map(dept => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className={`file-upload-zone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-input"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  disabled={checking}
                />
                <label htmlFor="file-input">
                  {file ? (
                    <div className="file-selected">
                      <FiFileText size={40} />
                      <p className="file-name">{file.name}</p>
                      <p className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button
                        type="button"
                        className="remove-file-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          setFile(null);
                        }}
                      >
                        <FiX /> Remove
                      </button>
                    </div>
                  ) : (
                    <div className="upload-prompt">
                      <FiUpload size={40} />
                      <p>Drag & drop your document here</p>
                      <p className="upload-hint">or click to browse</p>
                      <p className="file-types">Supported: PDF, DOC, DOCX (Max 50MB)</p>
                    </div>
                  )}
                </label>
              </div>

              {error && (
                <div className="error-message">
                  <FiAlertCircle /> {error}
                </div>
              )}

              <button
                type="submit"
                className="check-btn"
                disabled={checking || !file || !title || !selectedFaculty}
              >
                {checking ? (
                  <>
                    <FiRefreshCw className="spinning" /> Checking... (This may take a minute)
                  </>
                ) : (
                  <>
                    <FiCheckCircle /> Check for Plagiarism
                  </>
                )}
              </button>
            </form>

            <div className="info-box">
              <FiInfo />
              <div>
                <strong>What we check:</strong>
                <ul>
                  <li>System-detected content patterns (including machine-generated text)</li>
                  <li>Web content matching and plagiarism</li>
                  <li>Paraphrased content identification</li>
                  <li>Personalized improvement suggestions</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Result Tab */}
        {activeTab === 'result' && result && (
          <div className="result-section">
            <div className="result-header">
              <h2>{result.title}</h2>
              <p className="result-date">Checked on {formatDate(result.plagiarismReport?.checkedAt)}</p>
            </div>

            <div className="scores-grid">
              <div className="score-card overall">
                <div
                  className="score-circle"
                  style={{
                    background: `conic-gradient(${getScoreColor(result.plagiarismReport?.overallScore)} ${result.plagiarismReport?.overallScore}%, #e5e7eb ${result.plagiarismReport?.overallScore}%)`
                  }}
                >
                  <div className="score-inner">
                    <span className="score-value">{result.plagiarismReport?.overallScore}%</span>
                    <span className="score-label">Original</span>
                  </div>
                </div>
                <h3>Overall Originality</h3>
                <span className={`score-badge ${getScoreLabel(result.plagiarismReport?.overallScore).toLowerCase().replace(' ', '-')}`}>
                  {getScoreLabel(result.plagiarismReport?.overallScore)}
                </span>
              </div>

              <div className="score-card ai-score">
                <div className="score-icon">
                  {result.plagiarismReport?.aiAnalysis?.isAiGenerated ?
                    <FiAlertTriangle color="#ef4444" size={32} /> :
                    <FiCheckCircle color="#10b981" size={32} />
                  }
                </div>
                <h3>System Detection</h3>
                <p className="score-percent">{100 - (result.plagiarismReport?.aiScore || 0)}% Human-Written</p>
                <p className="score-detail">
                  {result.plagiarismReport?.aiAnalysis?.isAiGenerated ?
                    'System patterns detected' : 'Appears human-written'}
                </p>
              </div>

              <div className="score-card web-score">
                <div className="score-icon">
                  <FiExternalLink size={32} />
                </div>
                <h3>Web Matches</h3>
                <p className="score-percent">{result.plagiarismReport?.webMatchScore || 0}% Matched</p>
                <p className="score-detail">
                  {result.plagiarismReport?.webMatches?.length || 0} source(s) found
                </p>
              </div>
            </div>

            {/* System Analysis Details */}
            {result.plagiarismReport?.aiAnalysis?.indicators?.length > 0 && (
              <div className="analysis-section">
                <h3><FiAlertTriangle /> System Content Indicators</h3>
                <ul className="indicators-list">
                  {result.plagiarismReport.aiAnalysis.indicators.map((indicator, idx) => (
                    <li key={idx}>{indicator}</li>
                  ))}
                </ul>
                {result.plagiarismReport.aiAnalysis.details && (
                  <p className="analysis-details">{result.plagiarismReport.aiAnalysis.details}</p>
                )}
              </div>
            )}

            {/* Web Matches */}
            {result.plagiarismReport?.webMatches?.length > 0 && (
              <div className="analysis-section">
                <h3><FiExternalLink /> Web Matches Found</h3>
                <div className="matches-list">
                  {result.plagiarismReport.webMatches.map((match, idx) => (
                    <div key={idx} className="match-item">
                      <div
                        className="match-header"
                        onClick={() => toggleMatchExpand(idx)}
                      >
                        <div className="match-info">
                          <span className={`match-type ${match.matchType}`}>
                            {match.matchType}
                          </span>
                          <span className="match-title">{match.sourceTitle}</span>
                          <span className="match-percent">{match.matchPercentage}% match</span>
                        </div>
                        {expandedMatches[idx] ? <FiChevronUp /> : <FiChevronDown />}
                      </div>
                      {expandedMatches[idx] && (
                        <div className="match-details">
                          <p className="matched-text">"{match.matchedText}"</p>
                          {match.sourceUrl && match.sourceUrl !== 'Unknown' && (
                            <a
                              href={match.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="source-link"
                            >
                              <FiExternalLink /> View Source
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {result.plagiarismReport?.suggestions?.length > 0 && (
              <div className="analysis-section suggestions">
                <h3><FiInfo /> Improvement Suggestions</h3>
                <ul className="suggestions-list">
                  {result.plagiarismReport.suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="history-section">
            {loading ? (
              <div className="loading-state">
                <FiRefreshCw className="spinning" />
                <p>Loading reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="empty-state">
                <FiFileText size={48} />
                <h3>No Reports Yet</h3>
                <p>Upload a document to check for plagiarism</p>
                <button onClick={() => setActiveTab('upload')} className="primary-btn">
                  <FiUpload /> Upload Document
                </button>
              </div>
            ) : (
              <div className="reports-list">
                {reports.map(report => (
                  <div key={report._id} className="report-card">
                    <div className="report-info">
                      <h4>{report.title}</h4>
                      <p className="report-meta">
                        <span><FiClock /> {formatDate(report.createdAt)}</span>
                        <span><FiFileText /> {report.originalFilename}</span>
                      </p>
                    </div>
                    <div className="report-score">
                      <div
                        className="mini-score"
                        style={{ backgroundColor: getScoreColor(report.plagiarismReport?.overallScore) }}
                      >
                        {report.plagiarismReport?.overallScore || 0}%
                      </div>
                      <span className="score-text">Original</span>
                    </div>
                    <div className="report-actions">
                      <button
                        className="view-btn"
                        onClick={() => openReportModal(report)}
                      >
                        <FiEye /> View
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteReport(report._id)}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && selectedReport && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content report-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedReport.title}</h2>
              <button className="close-btn" onClick={() => setShowReportModal(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-scores">
                <div className="modal-score-item">
                  <span className="label">Originality</span>
                  <span
                    className="value"
                    style={{ color: getScoreColor(selectedReport.plagiarismReport?.overallScore) }}
                  >
                    {selectedReport.plagiarismReport?.overallScore || 0}%
                  </span>
                </div>
                <div className="modal-score-item">
                  <span className="label">System Score</span>
                  <span className="value">{100 - (selectedReport.plagiarismReport?.aiScore || 0)}% Human</span>
                </div>
                <div className="modal-score-item">
                  <span className="label">Web Matches</span>
                  <span className="value">{selectedReport.plagiarismReport?.webMatchScore || 0}%</span>
                </div>
              </div>

              {selectedReport.plagiarismReport?.suggestions?.length > 0 && (
                <div className="modal-suggestions">
                  <h4>Suggestions</h4>
                  <ul>
                    {selectedReport.plagiarismReport.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlagiarismChecker;
