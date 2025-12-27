import React, { useState, useEffect } from 'react';
import api from '../utils/api';
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

  useEffect(() => {
    fetchMaterials();
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

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="admin-materials-container">
        <div className="container">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading materials...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-materials-container">
      <div className="container">
        <div className="materials-header">
          <div>
            <h1>Manage Materials</h1>
            <p>Generate summaries and questions for uploaded materials</p>
          </div>
          <button onClick={fetchMaterials} className="btn btn-outline-primary">
            <FiRefreshCw /> Refresh
          </button>
        </div>

        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
            {message.text}
          </div>
        )}

        {materials.length === 0 ? (
          <div className="empty-state">
            <FiFileText size={64} />
            <h3>No Materials Yet</h3>
            <p>Upload materials to get started with AI processing.</p>
          </div>
        ) : (
          <div className="materials-table-card">
            <div className="table-responsive">
              <table className="materials-table">
                <thead>
                  <tr>
                    <th>Material Title</th>
                    <th>Course</th>
                    <th>Uploaded</th>
                    <th>Summary</th>
                    <th>Questions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material) => (
                    <tr key={material._id}>
                      <td>
                        <div className="material-title-cell">
                          <FiFileText />
                          <span>{material.title}</span>
                        </div>
                      </td>
                      <td>
                        <div className="course-cell">
                          <strong>{material.courseId?.courseCode}</strong>
                          <span>{material.courseId?.courseName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="date-cell">
                          <FiClock size={14} />
                          {formatDate(material.createdAt)}
                        </div>
                      </td>
                      <td>
                        {material.hasSummary ? (
                          <span className="status-badge status-success">
                            <FiCheckCircle /> Generated
                          </span>
                        ) : (
                          <span className="status-badge status-pending">
                            <FiXCircle /> Not Generated
                          </span>
                        )}
                      </td>
                      <td>
                        {material.questionsCount > 0 ? (
                          <span className="status-badge status-success">
                            <FiCheckCircle /> {material.questionsCount} questions
                          </span>
                        ) : (
                          <span className="status-badge status-pending">
                            <FiXCircle /> Not Generated
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
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
                              className="btn btn-sm btn-success"
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMaterials;
