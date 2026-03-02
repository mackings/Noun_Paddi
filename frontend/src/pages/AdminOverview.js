import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiActivity, FiBook, FiBriefcase, FiGrid, FiLayers, FiRefreshCw, FiShield, FiTrendingUp, FiUsers } from 'react-icons/fi';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import './AdminOverview.css';

const buildSeries = (users, viewMode) => {
  const now = new Date();
  const buckets = [];
  const bucketMap = new Map();

  if (viewMode === 'day') {
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      buckets.push({ key, label, value: 0 });
      bucketMap.set(key, buckets[buckets.length - 1]);
    }
    users.forEach((user) => {
      const createdAt = new Date(user.createdAt);
      const key = createdAt.toISOString().slice(0, 10);
      if (bucketMap.has(key)) bucketMap.get(key).value += 1;
    });
    return buckets;
  }

  if (viewMode === 'month') {
    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString([], { month: 'short' });
      buckets.push({ key, label, value: 0 });
      bucketMap.set(key, buckets[buckets.length - 1]);
    }
    users.forEach((user) => {
      const createdAt = new Date(user.createdAt);
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (bucketMap.has(key)) bucketMap.get(key).value += 1;
    });
    return buckets;
  }

  for (let i = 5; i >= 0; i -= 1) {
    const year = now.getFullYear() - i;
    const key = String(year);
    buckets.push({ key, label: key, value: 0 });
    bucketMap.set(key, buckets[buckets.length - 1]);
  }
  users.forEach((user) => {
    const key = String(new Date(user.createdAt).getFullYear());
    if (bucketMap.has(key)) bucketMap.get(key).value += 1;
  });
  return buckets;
};

const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [viewMode, setViewMode] = useState('month');
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [statsResponse, usersResponse] = await Promise.all([
        api.get('/stats/admin'),
        api.get('/users'),
      ]);
      setStats(statsResponse.data.data);
      setUsers(usersResponse.data.data || []);
    } catch (error) {
      console.error('Error fetching admin overview:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    trackFeatureVisit('admin_overview');
  }, []);

  const studentCount = useMemo(
    () => users.filter((item) => item.role === 'student').length,
    [users]
  );
  const adminCount = useMemo(
    () => users.filter((item) => item.role === 'admin').length,
    [users]
  );
  const chartData = useMemo(
    () => buildSeries(users, viewMode),
    [users, viewMode]
  );
  const chartMax = Math.max(...chartData.map((item) => item.value), 1);

  if (loading) {
    return (
      <div className="admin-overview-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-overview-page">
      <section className="overview-hero">
        <div>
          <p className="overview-kicker">NounPaddi Admin</p>
          <h1>Overview</h1>
          <p>Monitor your academic structure and user growth from one modern control surface.</p>
        </div>
        <button onClick={fetchStats} className="btn btn-outline-primary">
          <FiRefreshCw /> Refresh
        </button>
      </section>

      <section className="overview-stat-grid">
        <article className="overview-stat-card">
          <span className="overview-stat-icon purple"><FiBriefcase /></span>
          <h3>{stats?.overview?.totalFaculties || 0}</h3>
          <p>Faculties</p>
        </article>
        <article className="overview-stat-card">
          <span className="overview-stat-icon blue"><FiLayers /></span>
          <h3>{stats?.overview?.totalDepartments || 0}</h3>
          <p>Departments</p>
        </article>
        <article className="overview-stat-card">
          <span className="overview-stat-icon green"><FiBook /></span>
          <h3>{stats?.overview?.totalCourses || 0}</h3>
          <p>Courses</p>
        </article>
        <article className="overview-stat-card">
          <span className="overview-stat-icon orange"><FiUsers /></span>
          <h3>{studentCount}</h3>
          <p>Students</p>
        </article>
        <article className="overview-stat-card">
          <span className="overview-stat-icon pink"><FiGrid /></span>
          <h3>{users.length}</h3>
          <p>Total Users</p>
        </article>
        <article className="overview-stat-card">
          <span className="overview-stat-icon indigo"><FiShield /></span>
          <h3>{adminCount}</h3>
          <p>Admins</p>
        </article>
      </section>

      <section className="overview-content-grid">
        <article className="overview-panel chart-panel">
          <div className="chart-head">
            <h2><FiActivity /> User Registrations</h2>
            <div className="chart-toggle">
              <button
                className={viewMode === 'day' ? 'active' : ''}
                onClick={() => setViewMode('day')}
                type="button"
              >
                Date
              </button>
              <button
                className={viewMode === 'month' ? 'active' : ''}
                onClick={() => setViewMode('month')}
                type="button"
              >
                Month
              </button>
              <button
                className={viewMode === 'year' ? 'active' : ''}
                onClick={() => setViewMode('year')}
                type="button"
              >
                Year
              </button>
            </div>
          </div>
          <div
            className="bar-chart"
            style={{ gridTemplateColumns: `repeat(${chartData.length}, minmax(0, 1fr))` }}
          >
            {chartData.map((point) => (
              <div key={point.key} className="bar-chart-item">
                <div
                  className="bar-chart-fill"
                  style={{ height: `${Math.max((point.value / chartMax) * 100, point.value > 0 ? 8 : 2)}%` }}
                  title={`${point.label}: ${point.value}`}
                />
                <span className="bar-chart-label">{point.label}</span>
                <span className="bar-chart-value">{point.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="overview-panel">
          <h2><FiTrendingUp /> User Role Mix</h2>
          <div className="overview-list">
            <div className="overview-row">
              <h4>Students</h4>
              <p>Primary learning users on the platform.</p>
              <span>{studentCount}</span>
            </div>
            <div className="overview-row">
              <h4>Admins</h4>
              <p>Operational users managing content and messaging.</p>
              <span>{adminCount}</span>
            </div>
            <div className="overview-row">
              <h4>Total Accounts</h4>
              <p>All registered user profiles in the system.</p>
              <span>{users.length}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="overview-quick-actions">
        <Link to="/admin/broadcast" className="overview-action">
          <FiGrid />
          <h3>Push Broadcast</h3>
          <p>Send updates to all subscribed users.</p>
        </Link>
        <Link to="/admin/api-usage" className="overview-action">
          <FiActivity />
          <h3>API Usage</h3>
          <p>Monitor model calls, tokens, and operation health.</p>
        </Link>
        <Link to="/admin/users" className="overview-action">
          <FiUsers />
          <h3>Manage Users</h3>
          <p>View profiles and invite trusted admins.</p>
        </Link>
      </section>
    </div>
  );
};

export default AdminOverview;
