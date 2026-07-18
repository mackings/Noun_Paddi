import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiActivity,
  FiAward,
  FiArrowDownRight,
  FiArrowUpRight,
  FiBook,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiGrid,
  FiRefreshCw,
  FiShield,
  FiUploadCloud,
  FiUsers,
} from 'react-icons/fi';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import { getRelativeTime } from '../utils/dateHelper';
import './AdminOverview.css';

const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const CHART_PAD_X = 8;

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
  } else if (viewMode === 'month') {
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
  } else {
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
  }

  const firstUserDate = users.reduce((earliest, user) => {
    const createdAt = new Date(user.createdAt);
    if (isNaN(createdAt.getTime())) return earliest;
    return !earliest || createdAt < earliest ? createdAt : earliest;
  }, null);

  if (!firstUserDate) return buckets;

  let firstKey;
  if (viewMode === 'day') firstKey = firstUserDate.toISOString().slice(0, 10);
  else if (viewMode === 'month') {
    firstKey = `${firstUserDate.getFullYear()}-${String(firstUserDate.getMonth() + 1).padStart(2, '0')}`;
  } else firstKey = String(firstUserDate.getFullYear());

  const startIndex = buckets.findIndex((bucket) => bucket.key >= firstKey);
  return startIndex > 0 ? buckets.slice(startIndex) : buckets;
};

const buildChartGeometry = (data, max) => {
  if (!data.length) return { line: '', area: '', points: [] };
  const usableWidth = CHART_WIDTH - CHART_PAD_X * 2;
  const stepX = data.length > 1 ? usableWidth / (data.length - 1) : 0;
  const points = data.map((point, index) => {
    const x = CHART_PAD_X + index * stepX;
    const y = CHART_HEIGHT - (point.value / max) * (CHART_HEIGHT - 20) - 10;
    return { ...point, x, y };
  });
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const area = `${line} L${last.x.toFixed(1)},${CHART_HEIGHT} L${first.x.toFixed(1)},${CHART_HEIGHT} Z`;
  return { line, area, points };
};

const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [viewMode, setViewMode] = useState('month');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStats = async (isInitial) => {
    try {
      if (isInitial) setInitialLoading(true);
      else setRefreshing(true);
      const [statsResponse, usersResponse] = await Promise.all([
        api.get('/stats/admin'),
        api.get('/users'),
      ]);
      setStats(statsResponse.data.data);
      setUsers(usersResponse.data.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching admin overview:', error);
    } finally {
      if (isInitial) setInitialLoading(false);
      else setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats(true);
    trackFeatureVisit('admin_overview');
    const intervalId = setInterval(() => fetchStats(false), 30000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const chartGeometry = useMemo(
    () => buildChartGeometry(chartData, chartMax),
    [chartData, chartMax]
  );
  const chartTrend = useMemo(() => {
    const mid = Math.ceil(chartData.length / 2);
    const earlier = chartData.slice(0, mid).reduce((sum, p) => sum + p.value, 0);
    const recent = chartData.slice(mid).reduce((sum, p) => sum + p.value, 0);
    if (earlier < 5) return recent > 0 ? { direction: 'up', pct: null } : null;
    const pct = Math.round(((recent - earlier) / earlier) * 100);
    return { direction: pct >= 0 ? 'up' : 'down', pct: Math.abs(pct) };
  }, [chartData]);

  const recentMaterials = stats?.recentMaterials || [];
  const topCourses = stats?.topCourses || [];
  const topCourseMax = topCourses[0]?.materialCount || 1;

  if (initialLoading) {
    return (
      <div className="admin-overview-page">
        <div className="overview-skeleton-hero">
          <div className="overview-skeleton-line short"></div>
          <div className="overview-skeleton-line title"></div>
          <div className="overview-skeleton-line wide"></div>
        </div>
        <div className="overview-skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overview-skeleton-card">
              <div className="overview-skeleton-icon"></div>
              <div className="overview-skeleton-line"></div>
              <div className="overview-skeleton-line short"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-overview-page">
      <section className="overview-hero">
        <div className="overview-hero-content">
          <p className="overview-kicker">NounPaddi Admin</p>
          <h1>Operations Overview</h1>
          <p>Monitor academic content, platform users, generation coverage, and admin activity.</p>
        </div>
        <div className="overview-hero-actions">
          <span className="overview-sync-pill">
            {refreshing ? <FiRefreshCw className="overview-spin" /> : <FiClock />}
            {refreshing ? 'Syncing…' : `Synced ${lastUpdated ? getRelativeTime(lastUpdated) : 'just now'}`}
          </span>
        </div>
      </section>

      <section className="overview-stat-grid">
        <article className="overview-stat-card">
          <span className="overview-stat-icon"><FiBriefcase /></span>
          <div>
            <p>Faculties</p>
            <h3>{stats?.overview?.totalFaculties || 0}</h3>
            <span>Academic groups</span>
          </div>
        </article>
        <article className="overview-stat-card">
          <span className="overview-stat-icon"><FiBook /></span>
          <div>
            <p>Courses</p>
            <h3>{stats?.overview?.totalCourses || 0}</h3>
            <span>Course records</span>
          </div>
        </article>
        <article className="overview-stat-card">
          <span className="overview-stat-icon"><FiFileText /></span>
          <div>
            <p>Materials</p>
            <h3>{stats?.overview?.totalMaterials || 0}</h3>
            <span>Uploaded files</span>
          </div>
        </article>
        <article className="overview-stat-card">
          <span className="overview-stat-icon"><FiUsers /></span>
          <div>
            <p>Students</p>
            <h3>{studentCount}</h3>
            <span>Registered learners</span>
          </div>
        </article>
        <article className="overview-stat-card">
          <span className="overview-stat-icon"><FiShield /></span>
          <div>
            <p>Admins</p>
            <h3>{adminCount}</h3>
            <span>Workspace access</span>
          </div>
        </article>
      </section>

      <section className="overview-chart-section">
        <article className="overview-panel chart-panel">
          <div className="chart-head">
            <h2><FiActivity /> User Registrations</h2>
            <div className="chart-head-right">
              {chartTrend && (
                <span className="trend-chip">
                  {chartTrend.direction === 'up' ? <FiArrowUpRight /> : <FiArrowDownRight />}
                  {chartTrend.pct !== null ? `${chartTrend.pct}%` : 'New'}
                </span>
              )}
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
          </div>
          <div className="chart-canvas">
            <svg
              className="trend-chart"
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
            >
              <path d={chartGeometry.area} className="trend-area" fill="var(--admin-page-accent-soft)" stroke="none" />
              <path
                d={chartGeometry.line}
                className="trend-line"
                fill="none"
                stroke="var(--admin-page-accent-strong)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {chartGeometry.points.map((point) => (
                <circle key={point.key} cx={point.x} cy={point.y} r="4" className="trend-dot">
                  <title>{`${point.label}: ${point.value}`}</title>
                </circle>
              ))}
            </svg>
            <div className="chart-axis">
              {chartData.map((point) => (
                <span key={point.key}>{point.label}</span>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="overview-content-grid overview-activity-grid">
        <article className="overview-panel">
          <h2><FiClock /> Recent Materials</h2>
          {recentMaterials.length ? (
            <ul className="activity-list">
              {recentMaterials.map((item) => (
                <li key={item._id} className="activity-item">
                  <span className="activity-icon"><FiFileText /></span>
                  <div className="activity-body">
                    <p className="activity-title">{item.title}</p>
                    <p className="activity-meta">
                      {item.courseId?.courseCode || 'Unassigned'} &middot; {item.uploadedBy?.name || 'Admin'}
                    </p>
                  </div>
                  <span className="activity-time">{getRelativeTime(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview-empty">No materials uploaded yet.</p>
          )}
        </article>

        <article className="overview-panel">
          <h2><FiAward /> Top Courses</h2>
          {topCourses.length ? (
            <ul className="rank-list">
              {topCourses.map((course, index) => (
                <li key={course._id} className="rank-item">
                  <span className="rank-index">{index + 1}</span>
                  <div className="rank-body">
                    <p className="rank-title">{course.courseName}</p>
                    <p className="rank-meta">{course.courseCode}</p>
                    <div className="mini-progress">
                      <div
                        className="mini-progress-fill"
                        style={{ width: `${Math.round((course.materialCount / topCourseMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="rank-count">{course.materialCount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview-empty">No course activity yet.</p>
          )}
        </article>
      </section>

      <section className="overview-quick-actions">
        <Link to="/admin/broadcast" className="overview-action">
          <span className="overview-action-icon"><FiGrid /></span>
          <h3>Push Broadcast</h3>
          <p>Send updates to all subscribed users.</p>
        </Link>
        <Link to="/admin/api-usage" className="overview-action">
          <span className="overview-action-icon"><FiActivity /></span>
          <h3>API Usage</h3>
          <p>Monitor model calls, tokens, and operation health.</p>
        </Link>
        <Link to="/admin/upload?tab=materials" className="overview-action">
          <span className="overview-action-icon"><FiUploadCloud /></span>
          <h3>Upload Materials</h3>
          <p>Add course files and trigger learning content workflows.</p>
        </Link>
        <Link to="/admin/users" className="overview-action">
          <span className="overview-action-icon"><FiCheckCircle /></span>
          <h3>Manage Users</h3>
          <p>View profiles and invite trusted admins.</p>
        </Link>
      </section>
    </div>
  );
};

export default AdminOverview;
