import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import {
  FiBook,
  FiFileText,
  FiGrid,
  FiDownload,
  FiArrowLeft,
  FiClock,
  FiUser,
  FiAward
} from 'react-icons/fi';
import './CourseDetail.css';

const CourseDetail = () => {
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summaries');

  useEffect(() => {
    fetchCourseDetails();
    fetchCourseMaterials();
  }, [courseId]);

  const fetchCourseDetails = async () => {
    try {
      const response = await api.get(`/courses/${courseId}`);
      setCourse(response.data.data);
    } catch (error) {
      console.error('Error fetching course details:', error);
    }
  };

  const fetchCourseMaterials = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/materials/course/${courseId}`);
      setMaterials(response.data.data || []);

      // Auto-select first material with a summary
      const materialWithSummary = response.data.data.find(m => m.hasSummary);
      if (materialWithSummary) {
        setSelectedMaterial(materialWithSummary);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching course materials:', error);
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="course-detail-container">
        <div className="container">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading course materials...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="course-detail-container">
      <div className="container">
        {/* Breadcrumb */}
        <Link to="/explore" className="breadcrumb">
          <FiArrowLeft /> Back to Courses
        </Link>

        {/* Course Header */}
        {course && (
          <div className="course-detail-header">
            <div className="course-detail-icon">
              <FiBook size={40} />
            </div>
            <div>
              <div className="course-code-badge">{course.courseCode}</div>
              <h1>{course.courseName}</h1>
              <div className="course-meta">
                <span>
                  <FiAward size={16} />
                  {course.creditUnits || 3} Credit Units
                </span>
                <span>
                  <FiFileText size={16} />
                  {materials.length} {materials.length === 1 ? 'Material' : 'Materials'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="detail-tabs">
          <button
            className={`detail-tab ${activeTab === 'summaries' ? 'active' : ''}`}
            onClick={() => setActiveTab('summaries')}
          >
            <FiFileText />
            Study Summaries
          </button>
          <Link to="/practice" className="detail-tab">
            <FiGrid />
            Practice Questions
          </Link>
        </div>

        {/* Content */}
        {activeTab === 'summaries' && (
          <div className="summaries-content">
            {materials.length === 0 ? (
              <div className="empty-state">
                <FiFileText size={64} />
                <h3>No Materials Available</h3>
                <p>There are no study materials uploaded for this course yet.</p>
              </div>
            ) : (
              <div className="summaries-grid">
                {/* Materials List */}
                <div className="materials-sidebar">
                  <h3>Course Materials</h3>
                  <div className="materials-list">
                    {materials.map((material) => (
                      <button
                        key={material._id}
                        className={`material-item ${selectedMaterial?._id === material._id ? 'active' : ''} ${!material.hasSummary ? 'no-summary' : ''}`}
                        onClick={() => setSelectedMaterial(material)}
                      >
                        <div className="material-item-header">
                          <FiFileText />
                          <span className="material-title">{material.title}</span>
                        </div>
                        <div className="material-item-meta">
                          <span className="material-date">
                            <FiClock size={12} />
                            {formatDate(material.createdAt)}
                          </span>
                          {material.hasSummary ? (
                            <span className="summary-badge">Has Summary</span>
                          ) : (
                            <span className="no-summary-badge">No Summary</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary Display */}
                <div className="summary-display">
                  {selectedMaterial ? (
                    <>
                      <div className="summary-header">
                        <h2>{selectedMaterial.title}</h2>
                        <div className="summary-actions">
                          <a
                            href={selectedMaterial.cloudinaryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline-primary"
                          >
                            <FiDownload />
                            Download PDF
                          </a>
                        </div>
                      </div>

                      <div className="summary-meta">
                        <span>
                          <FiUser size={14} />
                          Uploaded by {selectedMaterial.uploadedBy?.name || 'Admin'}
                        </span>
                        <span>
                          <FiClock size={14} />
                          {formatDate(selectedMaterial.createdAt)}
                        </span>
                      </div>

                      {selectedMaterial.hasSummary ? (
                        <div className="summary-content">
                          <div className="summary-text">
                            {selectedMaterial.summary}
                          </div>
                        </div>
                      ) : (
                        <div className="no-summary-placeholder">
                          <FiFileText size={48} />
                          <h3>No Summary Available</h3>
                          <p>A study summary has not been created for this material yet.</p>
                          <p>You can still download and read the original PDF file.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="select-material-placeholder">
                      <FiFileText size={64} />
                      <h3>Select a Material</h3>
                      <p>Choose a material from the list to view its AI-generated summary.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseDetail;
