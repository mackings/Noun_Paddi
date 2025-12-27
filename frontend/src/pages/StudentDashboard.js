import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import {
  FiBook,
  FiFileText,
  FiGrid,
  FiAward,
  FiTrendingUp,
  FiClock
} from 'react-icons/fi';
import './StudentDashboard.css';

const StudentDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
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

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
        <div className="progress-section">
          <div className="progress-card">
            <h2>
              <FiTrendingUp /> Learning Progress
            </h2>
            <div className="progress-items">
              <div className="progress-item">
                <div className="progress-item-header">
                  <span>Materials with Summaries</span>
                  <strong>{stats?.overview?.materialWithSummaries || 0}%</strong>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill progress-fill-blue"
                    style={{ width: `${stats?.overview?.materialWithSummaries || 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-item-header">
                  <span>Available Practice Questions</span>
                  <strong>{stats?.overview?.totalQuestions || 0} questions</strong>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill progress-fill-green"
                    style={{ width: '100%' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Materials */}
          <div className="progress-card">
            <h2>
              <FiClock /> Recently Added Materials
            </h2>
            <div className="recent-materials-list">
              {stats?.recentMaterials && stats.recentMaterials.length > 0 ? (
                stats.recentMaterials.map((material) => (
                  <Link
                    key={material._id}
                    to={`/course/${material.courseId?._id}`}
                    className="recent-material-item"
                  >
                    <div className="recent-material-icon">
                      <FiFileText />
                    </div>
                    <div className="recent-material-content">
                      <h4>{material.title}</h4>
                      <p>{material.courseId?.courseCode} - {material.courseId?.courseName}</p>
                      <span className="recent-material-date">
                        <FiClock size={12} />
                        {formatDate(material.createdAt)}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="empty-message">No materials available yet</p>
              )}
            </div>
          </div>
        </div>

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
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
