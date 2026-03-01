import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import { trackFeatureVisit } from '../utils/featureTracking';
import {
  FiBook,
  FiBriefcase,
  FiLayers,
  FiFileText,
  FiGrid,
  FiUsers,
  FiTrendingUp,
  FiClock,
  FiRefreshCw,
  FiBell,
  FiSend,
} from 'react-icons/fi';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [apiUsage, setApiUsage] = useState(null);
  const [featureStats, setFeatureStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    url: '/explore',
  });

  useEffect(() => {
    fetchStats();
    fetchAPIUsage();
    fetchFeatureStats();
    trackFeatureVisit('admin_dashboard');
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stats/admin');
      setStats(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const fetchAPIUsage = async () => {
    try {
      const response = await api.get('/stats/api-usage');
      setApiUsage(response.data.data);
    } catch (error) {
      console.error('Error fetching API usage:', error);
    }
  };

  const fetchFeatureStats = async () => {
    try {
      const response = await api.get('/analytics/feature-stats');
      setFeatureStats(response.data.data);
    } catch (error) {
      console.error('Error fetching feature stats:', error);
    }
  };

  const onBroadcastInputChange = (event) => {
    const { name, value } = event.target;
    setBroadcastForm((prev) => ({ ...prev, [name]: value }));
  };

  const sendBroadcast = async (event) => {
    event.preventDefault();
    setSendingBroadcast(true);
    setBroadcastResult(null);

    try {
      const response = await api.post('/admin/notifications', broadcastForm);
      setBroadcastResult({
        type: 'success',
        text: `Sent to ${response?.data?.data?.sent || 0} subscription(s). Failed: ${response?.data?.data?.failed || 0}.`,
      });
      setBroadcastForm((prev) => ({ ...prev, title: '', message: '' }));
    } catch (error) {
      setBroadcastResult({
        type: 'error',
        text: error?.response?.data?.message || 'Broadcast failed. Please try again.',
      });
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard-container">
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
    <div className="admin-dashboard-container">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Overview of your educational platform</p>
          </div>
          <button onClick={fetchStats} className="btn btn-outline-primary">
            <FiRefreshCw /> Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card stat-card-purple">
            <div className="stat-icon">
              <FiBriefcase />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalFaculties || 0}</h3>
              <p>Faculties</p>
            </div>
          </div>

          <div className="stat-card stat-card-blue">
            <div className="stat-icon">
              <FiLayers />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalDepartments || 0}</h3>
              <p>Departments</p>
            </div>
          </div>

          <div className="stat-card stat-card-green">
            <div className="stat-icon">
              <FiBook />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalCourses || 0}</h3>
              <p>Courses</p>
            </div>
          </div>

          <div className="stat-card stat-card-orange">
            <div className="stat-icon">
              <FiFileText />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalMaterials || 0}</h3>
              <p>Materials Uploaded</p>
            </div>
          </div>

          <div className="stat-card stat-card-teal">
            <div className="stat-icon">
              <FiFileText />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalSummaries || 0}</h3>
              <p>Summaries Generated</p>
              <span className="stat-badge">{stats?.overview?.summaryPercentage || 0}% of materials</span>
            </div>
          </div>

          <div className="stat-card stat-card-pink">
            <div className="stat-icon">
              <FiGrid />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalQuestions || 0}</h3>
              <p>Practice Questions</p>
              <span className="stat-badge">{stats?.overview?.questionsPerMaterial || 0} per material</span>
            </div>
          </div>

          <div className="stat-card stat-card-indigo">
            <div className="stat-icon">
              <FiUsers />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.totalStudents || 0}</h3>
              <p>Registered Students</p>
            </div>
          </div>

          <div className="stat-card stat-card-cyan">
            <div className="stat-icon">
              <FiTrendingUp />
            </div>
            <div className="stat-details">
              <h3>{stats?.overview?.summaryPercentage || 0}%</h3>
              <p>Processing Rate</p>
              <span className="stat-badge">Materials with system summaries</span>
            </div>
          </div>
        </div>

        {/* Gemini API Usage */}
        {apiUsage && (
          <div className="api-usage-section">
            <h2>Gemini API Usage</h2>
            <div className="api-usage-grid">
              <div className="api-stat-card">
                <h3>{apiUsage.overview.totalAPICalls || 0}</h3>
                <p>Total API Calls</p>
              </div>
              <div className="api-stat-card">
                <h3>{apiUsage.overview.totalTokensUsed?.toLocaleString() || 0}</h3>
                <p>Total Tokens Used</p>
              </div>
              <div className="api-stat-card">
                <h3>{apiUsage.overview.successRate || 0}%</h3>
                <p>Success Rate</p>
              </div>
              <div className="api-stat-card">
                <h3>{apiUsage.overview.successfulCalls || 0} / {apiUsage.overview.failedCalls || 0}</h3>
                <p>Success / Failed</p>
              </div>
            </div>

            {/* Usage by Type */}
            {apiUsage.usageByType && apiUsage.usageByType.length > 0 && (
              <div className="usage-by-type">
                <h3>Usage by Operation</h3>
                <div className="usage-type-list">
                  {apiUsage.usageByType.map((type) => (
                    <div key={type._id} className="usage-type-item">
                      <div className="usage-type-header">
                        <span className="operation-name">
                          {type._id === 'summarize' ? 'Summarization' : 'Question Generation'}
                        </span>
                        <span className="operation-count">{type.count} calls</span>
                      </div>
                      <div className="usage-type-stats">
                        <span>{type.totalTokens?.toLocaleString()} tokens</span>
                        <span>•</span>
                        <span>{type.successCount} successful</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {featureStats && (
          <div className="api-usage-section">
            <h2>Most Visited Features</h2>
            <div className="api-usage-grid">
              {(featureStats.totals || []).slice(0, 6).map((item) => (
                <div key={item._id} className="api-stat-card">
                  <h3>{item.total}</h3>
                  <p>{item._id}</p>
                </div>
              ))}
              {featureStats.totals?.length === 0 && (
                <div className="api-stat-card">
                  <h3>0</h3>
                  <p>No visits tracked yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="broadcast-section">
          <h2>
            <FiBell /> Push Broadcast
          </h2>
          <p className="broadcast-subtitle">
            Send a notification to all subscribed users, including when the browser tab is closed.
          </p>

          <form className="broadcast-form" onSubmit={sendBroadcast}>
            <div className="broadcast-field">
              <label htmlFor="broadcast-title">Title</label>
              <input
                id="broadcast-title"
                name="title"
                type="text"
                value={broadcastForm.title}
                onChange={onBroadcastInputChange}
                placeholder="Important Update"
                required
                maxLength={120}
              />
            </div>

            <div className="broadcast-field">
              <label htmlFor="broadcast-message">Message</label>
              <textarea
                id="broadcast-message"
                name="message"
                value={broadcastForm.message}
                onChange={onBroadcastInputChange}
                placeholder="Write the message users should receive."
                required
                maxLength={300}
                rows={4}
              />
            </div>

            <div className="broadcast-field">
              <label htmlFor="broadcast-url">Open URL</label>
              <input
                id="broadcast-url"
                name="url"
                type="text"
                value={broadcastForm.url}
                onChange={onBroadcastInputChange}
                placeholder="/explore"
              />
            </div>

            <button type="submit" className="btn btn-primary broadcast-btn" disabled={sendingBroadcast}>
              <FiSend />
              {sendingBroadcast ? 'Sending...' : 'Send Broadcast'}
            </button>

            {broadcastResult && (
              <p className={`broadcast-result ${broadcastResult.type}`}>{broadcastResult.text}</p>
            )}
          </form>
        </div>

        {/* Recent Activity & Top Courses */}
        <div className="dashboard-content-grid">
          {/* Recent Materials */}
          <div className="dashboard-card">
            <h2>
              <FiClock /> Recent Materials
            </h2>
            <div className="materials-list">
              {stats?.recentMaterials && stats.recentMaterials.length > 0 ? (
                stats.recentMaterials.map((material) => (
                  <div key={material._id} className="material-row">
                    <div className="material-row-icon">
                      <FiFileText />
                    </div>
                    <div className="material-row-content">
                      <h4>{material.title}</h4>
                      <p>
                        {material.courseId?.courseCode} - {material.courseId?.courseName}
                      </p>
                      <span className="material-row-meta">
                        Uploaded by {material.uploadedBy?.name} • {formatDate(material.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-message">No materials uploaded yet</p>
              )}
            </div>
          </div>

          {/* Top Courses */}
          <div className="dashboard-card">
            <h2>
              <FiTrendingUp /> Top Courses by Materials
            </h2>
            <div className="top-courses-list">
              {stats?.topCourses && stats.topCourses.length > 0 ? (
                stats.topCourses.map((course, index) => (
                  <div key={course._id} className="top-course-row">
                    <div className="rank-badge">#{index + 1}</div>
                    <div className="top-course-content">
                      <h4>{course.courseCode}</h4>
                      <p>{course.courseName}</p>
                    </div>
                    <div className="material-count-badge">
                      {course.materialCount} {course.materialCount === 1 ? 'material' : 'materials'}
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-message">No course data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-section">
          <h2>Quick Actions</h2>
          <div className="quick-actions-grid">
            <Link to="/admin/upload" className="quick-action-card">
              <FiFileText size={32} />
              <h3>Upload Material</h3>
              <p>Upload new study materials and generate summaries</p>
            </Link>
            <Link to="/admin/materials" className="quick-action-card">
              <FiGrid size={32} />
              <h3>Manage Materials</h3>
              <p>Review, regenerate, or remove materials as needed</p>
            </Link>
            <Link to="/admin/users" className="quick-action-card">
              <FiUsers size={32} />
              <h3>View Users</h3>
              <p>Inspect student profiles and account details</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
