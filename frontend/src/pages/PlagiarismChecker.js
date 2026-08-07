import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import SEO from '../components/SEO';
import { trackFeatureVisit } from '../utils/featureTracking';
import {
  Upload, FileText, CheckCircle2, AlertTriangle,
  AlertCircle, Clock, Trash2, Eye, X,
  ExternalLink, RefreshCw, Info, ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ShellHeader from '../shell/ShellHeader';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogPopup, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { cn } from '../lib/utils';

const PlagiarismChecker = () => {
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

  const getScoreVariant = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'danger';
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

  const TABS = [
    { id: 'upload', label: 'Upload & Check', icon: Upload },
    { id: 'result', label: 'Latest Result', icon: CheckCircle2, disabled: !result },
    { id: 'history', label: `History (${reports.length})`, icon: Clock },
  ];

  return (
    <div className="np-shell">
      <SEO
        title="Plagiarism Checker - NounPaddi"
        description="Check your academic projects for plagiarism and system-detected content patterns"
      />
      <ShellHeader title="Plagiarism Checker" />

      <div className="tw:space-y-4 tw:p-4">
        <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Check your projects for system-detected content patterns and web matches.</p>

        <div className="tw:flex tw:gap-2 tw:overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon, disabled }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              disabled={disabled}
              className={cn(
                'tw:flex tw:flex-none tw:items-center tw:gap-1.5 tw:rounded-xl tw:border tw:px-3 tw:py-2 tw:text-xs tw:font-semibold tw:whitespace-nowrap tw:transition-colors tw:disabled:opacity-40',
                activeTab === id
                  ? 'tw:border-brand-600 tw:bg-brand-600 tw:text-white'
                  : 'tw:border-slate-200 tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300',
              )}
            >
              <Icon className="tw:h-3.5 tw:w-3.5" /> {label}
            </button>
          ))}
        </div>

        {activeTab === 'upload' && (
          <div className="tw:space-y-4">
            <Card>
              <CardContent className="tw:space-y-4 tw:p-5">
                <form onSubmit={handleSubmit} className="tw:space-y-4">
                  <label className="tw:block tw:space-y-1.5">
                    <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Project Title *</span>
                    <Input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter your project title"
                      disabled={checking}
                    />
                  </label>

                  <div className="tw:grid tw:grid-cols-2 tw:gap-3">
                    <label className="tw:block tw:space-y-1.5">
                      <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Faculty *</span>
                      <select
                        value={selectedFaculty}
                        onChange={handleFacultyChange}
                        disabled={checking}
                        className="tw:h-11 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100"
                      >
                        <option value="">Select Faculty</option>
                        {faculties.map(faculty => (
                          <option key={faculty._id} value={faculty._id}>{faculty.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="tw:block tw:space-y-1.5">
                      <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Department</span>
                      <select
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        disabled={checking || !selectedFaculty}
                        className="tw:h-11 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:disabled:opacity-50 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100"
                      >
                        <option value="">Select Department</option>
                        {departments.map(dept => (
                          <option key={dept._id} value={dept._id}>{dept.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={cn(
                      'tw:relative tw:rounded-2xl tw:border-2 tw:border-dashed tw:p-6 tw:text-center tw:transition-colors',
                      dragActive ? 'tw:border-brand-500 tw:bg-brand-50 tw:dark:bg-brand-950/30' : 'tw:border-slate-200 tw:dark:border-slate-800',
                      file && 'tw:border-emerald-400 tw:bg-emerald-50 tw:dark:bg-emerald-950/20',
                    )}
                  >
                    <input
                      type="file"
                      id="file-input"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileSelect(e.target.files[0])}
                      disabled={checking}
                      className="tw:absolute tw:inset-0 tw:h-full tw:w-full tw:cursor-pointer tw:opacity-0"
                    />
                    <label htmlFor="file-input" className="tw:pointer-events-none tw:flex tw:flex-col tw:items-center tw:gap-1.5">
                      {file ? (
                        <>
                          <FileText className="tw:h-8 tw:w-8 tw:text-emerald-600" />
                          <p className="tw:text-sm tw:font-semibold">{file.name}</p>
                          <p className="tw:text-xs tw:text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setFile(null); }}
                            className="tw:pointer-events-auto tw:mt-1 tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-red-600 tw:dark:text-red-400"
                          >
                            <X className="tw:h-3.5 tw:w-3.5" /> Remove
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload className="tw:h-8 tw:w-8 tw:text-slate-400" />
                          <p className="tw:text-sm tw:font-semibold">Drag &amp; drop your document here</p>
                          <p className="tw:text-xs tw:text-slate-400">or click to browse</p>
                          <p className="tw:text-xs tw:text-slate-400">Supported: PDF, DOC, DOCX (Max 50MB)</p>
                        </>
                      )}
                    </label>
                  </div>

                  {error && (
                    <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-xl tw:bg-red-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">
                      <AlertCircle className="tw:h-4 tw:w-4 tw:flex-none" /> {error}
                    </div>
                  )}

                  <Button type="submit" disabled={checking || !file || !title || !selectedFaculty} className="tw:w-full">
                    {checking ? (
                      <><RefreshCw className="tw:h-4 tw:w-4 tw:animate-spin" /> Checking... (This may take a minute)</>
                    ) : (
                      <><CheckCircle2 className="tw:h-4 tw:w-4" /> Check for Plagiarism</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="tw:flex tw:items-start tw:gap-3 tw:p-4">
              <Info className="tw:h-5 tw:w-5 tw:flex-none tw:text-brand-600 tw:dark:text-brand-400" />
              <div>
                <strong className="tw:text-sm tw:font-semibold">What we check:</strong>
                <ul className="tw:mt-1.5 tw:list-disc tw:space-y-1 tw:pl-4 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                  <li>System-detected content patterns (including machine-generated text)</li>
                  <li>Web content matching and plagiarism</li>
                  <li>Paraphrased content identification</li>
                  <li>Personalized improvement suggestions</li>
                </ul>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'result' && result && (
          <div className="tw:space-y-4">
            <div>
              <h2 className="tw:font-heading tw:text-lg tw:font-bold">{result.title}</h2>
              <p className="tw:text-xs tw:text-slate-400">Checked on {formatDate(result.plagiarismReport?.checkedAt)}</p>
            </div>

            <div className="tw:grid tw:grid-cols-1 tw:gap-3">
              <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-5 tw:text-center">
                <div
                  className="tw:flex tw:h-24 tw:w-24 tw:items-center tw:justify-center tw:rounded-full"
                  style={{
                    background: `conic-gradient(${getScoreColor(result.plagiarismReport?.overallScore)} ${result.plagiarismReport?.overallScore}%, #e5e7eb ${result.plagiarismReport?.overallScore}%)`,
                  }}
                >
                  <div className="tw:flex tw:h-[76px] tw:w-[76px] tw:flex-col tw:items-center tw:justify-center tw:rounded-full tw:bg-white tw:dark:bg-slate-900">
                    <span className="tw:font-heading tw:text-xl tw:font-bold">{result.plagiarismReport?.overallScore}%</span>
                    <span className="tw:text-[10px] tw:text-slate-400">Original</span>
                  </div>
                </div>
                <h3 className="tw:font-heading tw:text-sm tw:font-bold">Overall Originality</h3>
                <Badge variant={getScoreVariant(result.plagiarismReport?.overallScore)}>{getScoreLabel(result.plagiarismReport?.overallScore)}</Badge>
              </Card>

              <Card className="tw:flex tw:items-center tw:gap-3 tw:p-4">
                {result.plagiarismReport?.aiAnalysis?.isAiGenerated
                  ? <AlertTriangle className="tw:h-7 tw:w-7 tw:flex-none tw:text-red-500" />
                  : <CheckCircle2 className="tw:h-7 tw:w-7 tw:flex-none tw:text-emerald-500" />}
                <div>
                  <h3 className="tw:font-heading tw:text-sm tw:font-bold">System Detection</h3>
                  <p className="tw:text-sm tw:font-semibold">{100 - (result.plagiarismReport?.aiScore || 0)}% Human-Written</p>
                  <p className="tw:text-xs tw:text-slate-400">
                    {result.plagiarismReport?.aiAnalysis?.isAiGenerated ? 'System patterns detected' : 'Appears human-written'}
                  </p>
                </div>
              </Card>

              <Card className="tw:flex tw:items-center tw:gap-3 tw:p-4">
                <ExternalLink className="tw:h-7 tw:w-7 tw:flex-none tw:text-brand-500" />
                <div>
                  <h3 className="tw:font-heading tw:text-sm tw:font-bold">Web Matches</h3>
                  <p className="tw:text-sm tw:font-semibold">{result.plagiarismReport?.webMatchScore || 0}% Matched</p>
                  <p className="tw:text-xs tw:text-slate-400">{result.plagiarismReport?.webMatches?.length || 0} source(s) found</p>
                </div>
              </Card>
            </div>

            {result.plagiarismReport?.aiAnalysis?.indicators?.length > 0 && (
              <Card className="tw:space-y-2 tw:p-4">
                <h3 className="tw:flex tw:items-center tw:gap-1.5 tw:font-heading tw:text-sm tw:font-bold"><AlertTriangle className="tw:h-4 tw:w-4 tw:text-amber-500" /> System Content Indicators</h3>
                <ul className="tw:list-disc tw:space-y-1 tw:pl-4 tw:text-xs tw:text-slate-600 tw:dark:text-slate-300">
                  {result.plagiarismReport.aiAnalysis.indicators.map((indicator, idx) => (
                    <li key={idx}>{indicator}</li>
                  ))}
                </ul>
                {result.plagiarismReport.aiAnalysis.details && (
                  <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{result.plagiarismReport.aiAnalysis.details}</p>
                )}
              </Card>
            )}

            {result.plagiarismReport?.webMatches?.length > 0 && (
              <Card className="tw:space-y-2 tw:p-4">
                <h3 className="tw:flex tw:items-center tw:gap-1.5 tw:font-heading tw:text-sm tw:font-bold"><ExternalLink className="tw:h-4 tw:w-4 tw:text-brand-500" /> Web Matches Found</h3>
                <div className="tw:space-y-2">
                  {result.plagiarismReport.webMatches.map((match, idx) => (
                    <div key={idx} className="tw:rounded-xl tw:bg-slate-50 tw:dark:bg-slate-800/60">
                      <button
                        type="button"
                        onClick={() => toggleMatchExpand(idx)}
                        className="tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-2 tw:p-3 tw:text-left"
                      >
                        <div className="tw:min-w-0 tw:flex-1">
                          <Badge variant="neutral" className="tw:capitalize">{match.matchType}</Badge>
                          <p className="tw:mt-1 tw:truncate tw:text-xs tw:font-semibold">{match.sourceTitle}</p>
                          <p className="tw:text-xs tw:text-slate-400">{match.matchPercentage}% match</p>
                        </div>
                        {expandedMatches[idx] ? <ChevronUp className="tw:h-4 tw:w-4 tw:flex-none" /> : <ChevronDown className="tw:h-4 tw:w-4 tw:flex-none" />}
                      </button>
                      {expandedMatches[idx] && (
                        <div className="tw:space-y-2 tw:border-t tw:border-slate-200 tw:p-3 tw:dark:border-slate-700">
                          <p className="tw:text-xs tw:text-slate-600 tw:italic tw:dark:text-slate-300">&quot;{match.matchedText}&quot;</p>
                          {match.sourceUrl && match.sourceUrl !== 'Unknown' && (
                            <a
                              href={match.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="tw:flex tw:w-fit tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400"
                            >
                              <ExternalLink className="tw:h-3 tw:w-3" /> View Source
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {result.plagiarismReport?.suggestions?.length > 0 && (
              <Card className="tw:space-y-2 tw:p-4">
                <h3 className="tw:flex tw:items-center tw:gap-1.5 tw:font-heading tw:text-sm tw:font-bold"><Info className="tw:h-4 tw:w-4 tw:text-brand-500" /> Improvement Suggestions</h3>
                <ul className="tw:list-disc tw:space-y-1 tw:pl-4 tw:text-xs tw:text-slate-600 tw:dark:text-slate-300">
                  {result.plagiarismReport.suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {loading ? (
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
                <RefreshCw className="tw:h-6 tw:w-6 tw:animate-spin" />
                <p className="tw:text-sm">Loading reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
                <FileText className="tw:h-8 tw:w-8 tw:text-slate-300 tw:dark:text-slate-600" />
                <h3 className="tw:font-heading tw:text-sm tw:font-bold">No Reports Yet</h3>
                <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Upload a document to check for plagiarism</p>
                <Button size="sm" onClick={() => setActiveTab('upload')} className="tw:mt-2">
                  <Upload className="tw:h-3.5 tw:w-3.5" /> Upload Document
                </Button>
              </Card>
            ) : (
              <div className="tw:space-y-2">
                {reports.map(report => (
                  <Card key={report._id} className="tw:flex tw:items-center tw:gap-3 tw:p-3">
                    <div
                      className="tw:flex tw:h-11 tw:w-11 tw:flex-none tw:items-center tw:justify-center tw:rounded-full tw:text-xs tw:font-bold tw:text-white"
                      style={{ backgroundColor: getScoreColor(report.plagiarismReport?.overallScore) }}
                    >
                      {report.plagiarismReport?.overallScore || 0}%
                    </div>
                    <div className="tw:min-w-0 tw:flex-1">
                      <h4 className="tw:truncate tw:text-sm tw:font-semibold">{report.title}</h4>
                      <p className="tw:flex tw:flex-wrap tw:gap-2 tw:text-[11px] tw:text-slate-400">
                        <span className="tw:flex tw:items-center tw:gap-1"><Clock className="tw:h-3 tw:w-3" /> {formatDate(report.createdAt)}</span>
                        <span className="tw:flex tw:items-center tw:gap-1 tw:truncate"><FileText className="tw:h-3 tw:w-3" /> {report.originalFilename}</span>
                      </p>
                    </div>
                    <div className="tw:flex tw:flex-none tw:items-center tw:gap-1">
                      <button
                        type="button"
                        onClick={() => openReportModal(report)}
                        className="tw:rounded-lg tw:p-2 tw:text-slate-500 tw:hover:bg-slate-100 tw:dark:text-slate-400 tw:dark:hover:bg-slate-800"
                        aria-label="View report"
                      >
                        <Eye className="tw:h-4 tw:w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReport(report._id)}
                        className="tw:rounded-lg tw:p-2 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-600 tw:dark:hover:bg-red-500/10 tw:dark:hover:text-red-400"
                        aria-label="Delete report"
                      >
                        <Trash2 className="tw:h-4 tw:w-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogPopup>
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedReport.title}</DialogTitle>
              </DialogHeader>
              <div className="tw:mt-4 tw:space-y-4">
                <div className="tw:grid tw:grid-cols-3 tw:gap-2 tw:text-center">
                  <div className="tw:rounded-xl tw:bg-slate-50 tw:p-2.5 tw:dark:bg-slate-800/60">
                    <p className="tw:text-[10px] tw:text-slate-400">Originality</p>
                    <p
                      className="tw:font-heading tw:text-base tw:font-bold"
                      style={{ color: getScoreColor(selectedReport.plagiarismReport?.overallScore) }}
                    >
                      {selectedReport.plagiarismReport?.overallScore || 0}%
                    </p>
                  </div>
                  <div className="tw:rounded-xl tw:bg-slate-50 tw:p-2.5 tw:dark:bg-slate-800/60">
                    <p className="tw:text-[10px] tw:text-slate-400">System Score</p>
                    <p className="tw:font-heading tw:text-base tw:font-bold">{100 - (selectedReport.plagiarismReport?.aiScore || 0)}%</p>
                  </div>
                  <div className="tw:rounded-xl tw:bg-slate-50 tw:p-2.5 tw:dark:bg-slate-800/60">
                    <p className="tw:text-[10px] tw:text-slate-400">Web Matches</p>
                    <p className="tw:font-heading tw:text-base tw:font-bold">{selectedReport.plagiarismReport?.webMatchScore || 0}%</p>
                  </div>
                </div>

                {selectedReport.plagiarismReport?.suggestions?.length > 0 && (
                  <div>
                    <h4 className="tw:font-heading tw:text-sm tw:font-bold">Suggestions</h4>
                    <ul className="tw:mt-1.5 tw:list-disc tw:space-y-1 tw:pl-4 tw:text-xs tw:text-slate-600 tw:dark:text-slate-300">
                      {selectedReport.plagiarismReport.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogPopup>
      </Dialog>
    </div>
  );
};

export default PlagiarismChecker;
