import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import { trackFeatureVisit } from '../utils/featureTracking';
import {
  FiFileText,
  FiGrid,
  FiTrash2,
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiClock
} from 'react-icons/fi';
import './AdminMaterials.css';

const AdminMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [processingType, setProcessingType] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchMaterials();
    trackFeatureVisit('admin_materials');
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const response = await api.get('/materials');
      setMaterials(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching materials:', error);
      setLoading(false);
    }
  };

  const handleGenerateSummary = async (materialId) => {
    try {
      setProcessingId(materialId);
      setProcessingType('summary');
      setMessage({ type: '', text: '' });

      await api.post(`/materials/${materialId}/summarize`);

      setMessage({ type: 'success', text: 'Summary generated successfully!' });
      fetchMaterials(); // Refresh list

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to generate summary'
      });
    } finally {
      setProcessingId(null);
      setProcessingType(null);
    }
  };

  const handleGenerateQuestions = async (materialId) => {
    try {
      setProcessingId(materialId);
      setProcessingType('questions');
      setMessage({ type: '', text: '' });

      await api.post(`/materials/${materialId}/generate-questions`);

      setMessage({ type: 'success', text: 'Questions generated successfully!' });
      fetchMaterials(); // Refresh list

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to generate questions'
      });
    } finally {
      setProcessingId(null);
      setProcessingType(null);
    }
  };

  const handleDelete = async (materialId, materialTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${materialTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/materials/${materialId}`);
      setMessage({ type: 'success', text: 'Material deleted successfully!' });
      fetchMaterials();

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to delete material'
      });
    }
  };

  if (loading) {
    return (
      <div className="admin-materials-container">
        <div className="container">
          <div className="materials-skeleton-shell" aria-hidden="true">
            <div className="materials-hero materials-skeleton-hero">
              <div className="materials-skeleton-copy">
                <span className="materials-skeleton-line title"></span>
                <span className="materials-skeleton-line text"></span>
              </div>
              <span className="materials-skeleton-button"></span>
            </div>

            <div className="materials-stats">
              {[0, 1, 2, 3].map((item) => (
                <div className="stat-card materials-skeleton-card" key={item}>
                  <span className="materials-skeleton-line label"></span>
                  <span className="materials-skeleton-line value"></span>
                </div>
              ))}
            </div>

            <div className="materials-skeleton-toolbar">
              <span className="materials-skeleton-search"></span>
              <span className="materials-skeleton-filter"></span>
              <span className="materials-skeleton-filter short"></span>
            </div>

            <div className="materials-grid">
              {[0, 1, 2].map((item) => (
                <div className="material-card materials-skeleton-card" key={item}>
                  <div className="materials-skeleton-card-head">
                    <span className="materials-skeleton-avatar"></span>
                    <div className="materials-skeleton-copy">
                      <span className="materials-skeleton-line text"></span>
                      <span className="materials-skeleton-line small"></span>
                    </div>
                  </div>
                  <span className="materials-skeleton-line full"></span>
                  <span className="materials-skeleton-line text"></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalMaterials = materials.length;
  const summaryCount = materials.filter((material) => material.hasSummary).length;
  const questionsCount = materials.filter((material) => material.questionsCount > 0).length;
  const completeCount = materials.filter(
    (material) => material.hasSummary && material.questionsCount > 0
  ).length;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredMaterials = materials.filter((material) => {
    const title = material.title || '';
    const courseCode = material.courseId?.courseCode || '';
    const courseName = material.courseId?.courseName || '';
    const matchesSearch = normalizedSearch.length === 0
      || `${title} ${courseCode} ${courseName}`.toLowerCase().includes(normalizedSearch);

    if (!matchesSearch) return false;

    if (statusFilter === 'needs-summary') {
      return !material.hasSummary;
    }
    if (statusFilter === 'needs-questions') {
      return material.hasSummary && material.questionsCount === 0;
    }
    if (statusFilter === 'complete') {
      return material.hasSummary && material.questionsCount > 0;
    }
    return true;
  });

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'needs-summary', label: 'Needs Summary' },
    { value: 'needs-questions', label: 'Needs Questions' },
    { value: 'complete', label: 'Complete' },
  ];

  return (
    <div className="admin-materials-container">
      <div className="container">
        <div className="materials-hero">
          <div className="materials-hero-text">
            <h1>Manage Materials</h1>
            <p>Generate summaries and questions for uploaded materials.</p>
          </div>
          <div className="materials-hero-actions">
            <button onClick={fetchMaterials} className="btn btn-outline-primary">
              <FiRefreshCw /> Refresh
            </button>
          </div>
        </div>

        <div className="materials-stats">
          <div className="stat-card">
            <span className="stat-label">Total Materials</span>
            <span className="stat-value">{totalMaterials}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Summaries Ready</span>
            <span className="stat-value">{summaryCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Questions Ready</span>
            <span className="stat-value">{questionsCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Complete</span>
            <span className="stat-value">{completeCount}</span>
          </div>
        </div>

        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
            {message.text}
          </div>
        )}

        <div className="materials-toolbar">
          <div className="materials-search">
            <FiFileText />
            <input
              type="text"
              placeholder="Search by title or course..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="materials-filters">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                className={`filter-chip ${statusFilter === option.value ? 'active' : ''}`}
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="materials-status-row">
          <div className="status-count">
            Showing <strong>{filteredMaterials.length}</strong> of <strong>{materials.length}</strong>
          </div>
          <div className="status-chips">
            <span className="status-chip">
              {materials.filter((item) => !item.hasSummary).length} missing summary
            </span>
            <span className="status-chip">
              {materials.filter((item) => item.hasSummary && item.questionsCount === 0).length} missing questions
            </span>
            <span className="status-chip">
              {materials.filter((item) => item.hasSummary && item.questionsCount > 0).length} complete
            </span>
          </div>
        </div>

        {filteredMaterials.length === 0 ? (
          <div className="empty-state">
            <FiFileText size={64} />
            <h3>No Materials Found</h3>
            <p>
              {materials.length === 0
                ? 'Upload materials to get started with system processing.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="materials-grid">
            {filteredMaterials.map((material, index) => {
              const courseCode = material.courseId?.courseCode || 'N/A';
              const courseName = material.courseId?.courseName || 'Unknown course';
              return (
                <div
                  key={material._id}
                  className="material-card"
                  style={{ '--delay': index }}
                >
                  <div className="material-card-header">
                    <div className="material-title">
                      <div className="material-title-icon">
                        <FiFileText />
                      </div>
                      <div>
                        <h3>{material.title}</h3>
                        <p>{courseCode} · {courseName}</p>
                      </div>
                    </div>
                    <div className="material-meta">
                      <FiClock size={14} />
                      <span>{formatDate(material.createdAt)}</span>
                    </div>
                  </div>

                  <div className="material-status">
                    <span className={`status-pill ${material.hasSummary ? 'status-success' : 'status-pending'}`}>
                      {material.hasSummary ? <FiCheckCircle /> : <FiXCircle />}
                      Summary {material.hasSummary ? 'Generated' : 'Missing'}
                    </span>
                    <span className={`status-pill ${material.questionsCount > 0 ? 'status-success' : 'status-pending'}`}>
                      {material.questionsCount > 0 ? <FiCheckCircle /> : <FiXCircle />}
                      {material.questionsCount > 0
                        ? `${material.questionsCount} Questions`
                        : 'Questions Missing'}
                    </span>
                  </div>

                  <div className="material-actions">
                    {!material.hasSummary && (
                      <button
                        onClick={() => handleGenerateSummary(material._id)}
                        className="btn btn-sm btn-primary"
                        disabled={processingId === material._id && processingType === 'summary'}
                      >
                        {processingId === material._id && processingType === 'summary' ? (
                          <>
                            <div className="spinner-small"></div> Generating...
                          </>
                        ) : (
                          <>
                            <FiFileText /> Summary
                          </>
                        )}
                      </button>
                    )}

                    {material.hasSummary && material.questionsCount === 0 && (
                      <button
                        onClick={() => handleGenerateQuestions(material._id)}
                        className="btn btn-sm btn-primary"
                        disabled={processingId === material._id && processingType === 'questions'}
                      >
                        {processingId === material._id && processingType === 'questions' ? (
                          <>
                            <div className="spinner-small"></div> Generating...
                          </>
                        ) : (
                          <>
                            <FiGrid /> Questions
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(material._id, material.title)}
                      className="btn btn-sm btn-danger"
                      disabled={processingId === material._id}
                    >
                      <FiTrash2 /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMaterials;
