import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Award,
  ArrowDownRight,
  ArrowUpRight,
  Book,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  Grid3x3,
  RefreshCw,
  Shield,
  UploadCloud,
  Users,
  Loader2,
} from 'lucide-react';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import { getRelativeTime } from '../utils/dateHelper';
import { Card } from '../components/ui/card';
import { cn } from '../lib/utils';

const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const CHART_PAD_X = 8;
const CHART_ACCENT = '#4f46e5';
const CHART_ACCENT_SOFT = 'rgba(79, 70, 229, 0.15)';

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
      <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
        <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
        <p className="tw:text-sm">Loading overview...</p>
      </div>
    );
  }

  const statCards = [
    { icon: Briefcase, label: 'Faculties', value: stats?.overview?.totalFaculties || 0, hint: 'Academic groups' },
    { icon: Book, label: 'Courses', value: stats?.overview?.totalCourses || 0, hint: 'Course records' },
    { icon: FileText, label: 'Materials', value: stats?.overview?.totalMaterials || 0, hint: 'Uploaded files' },
    { icon: Users, label: 'Students', value: studentCount, hint: 'Registered learners' },
    { icon: Shield, label: 'Admins', value: adminCount, hint: 'Workspace access' },
  ];

  const quickActions = [
    { to: '/admin/broadcast', icon: Grid3x3, title: 'Push Broadcast', desc: 'Send updates to all subscribed users.' },
    { to: '/admin/api-usage', icon: Activity, title: 'API Usage', desc: 'Monitor model calls, tokens, and operation health.' },
    { to: '/admin/upload?tab=materials', icon: UploadCloud, title: 'Upload Materials', desc: 'Add course files and trigger learning content workflows.' },
    { to: '/admin/users', icon: CheckCircle2, title: 'Manage Users', desc: 'View profiles and invite trusted admins.' },
  ];

  return (
    <div className="tw:space-y-5">
      <Card className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:p-5">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">NounPaddi Admin</p>
          <h1 className="tw:font-heading tw:text-xl tw:font-bold tw:tracking-tight">Operations Overview</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Monitor academic content, platform users, generation coverage, and admin activity.</p>
        </div>
        <span className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-full tw:bg-slate-100 tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300">
          {refreshing ? <RefreshCw className="tw:h-3.5 tw:w-3.5 tw:animate-spin" /> : <Clock className="tw:h-3.5 tw:w-3.5" />}
          {refreshing ? 'Syncing…' : `Synced ${lastUpdated ? getRelativeTime(lastUpdated) : 'just now'}`}
        </span>
      </Card>

      <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:lg:grid-cols-5">
        {statCards.map(({ icon: Icon, label, value, hint }) => (
          <Card key={label} className="tw:flex tw:items-start tw:gap-3 tw:p-4">
            <span className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
              <Icon className="tw:h-4.5 tw:w-4.5" />
            </span>
            <div>
              <p className="tw:text-xs tw:font-semibold tw:text-slate-500 tw:dark:text-slate-400">{label}</p>
              <h3 className="tw:font-heading tw:text-lg tw:font-bold">{value}</h3>
              <span className="tw:text-[11px] tw:text-slate-400">{hint}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="tw:p-5">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
          <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold"><Activity className="tw:h-4 tw:w-4 tw:text-brand-600" /> User Registrations</h2>
          <div className="tw:flex tw:items-center tw:gap-3">
            {chartTrend && (
              <span className={cn(
                'tw:flex tw:items-center tw:gap-1 tw:rounded-full tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold',
                chartTrend.direction === 'up'
                  ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                  : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
              )}>
                {chartTrend.direction === 'up' ? <ArrowUpRight className="tw:h-3 tw:w-3" /> : <ArrowDownRight className="tw:h-3 tw:w-3" />}
                {chartTrend.pct !== null ? `${chartTrend.pct}%` : 'New'}
              </span>
            )}
            <div className="tw:flex tw:rounded-xl tw:bg-slate-100 tw:p-1 tw:dark:bg-slate-800">
              {[{ key: 'day', label: 'Date' }, { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setViewMode(option.key)}
                  className={cn(
                    'tw:rounded-lg tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:transition-colors',
                    viewMode === option.key
                      ? 'tw:bg-white tw:text-slate-900 tw:shadow-sm tw:dark:bg-slate-950 tw:dark:text-slate-100'
                      : 'tw:text-slate-500 tw:dark:text-slate-400',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="tw:mt-4">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            className="tw:h-44 tw:w-full"
          >
            <path d={chartGeometry.area} fill={CHART_ACCENT_SOFT} stroke="none" />
            <path
              d={chartGeometry.line}
              fill="none"
              stroke={CHART_ACCENT}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {chartGeometry.points.map((point) => (
              <circle key={point.key} cx={point.x} cy={point.y} r="4" fill={CHART_ACCENT}>
                <title>{`${point.label}: ${point.value}`}</title>
              </circle>
            ))}
          </svg>
          <div className="tw:mt-1 tw:flex tw:justify-between tw:text-[11px] tw:text-slate-400">
            {chartData.map((point) => (
              <span key={point.key}>{point.label}</span>
            ))}
          </div>
        </div>
      </Card>

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-2">
        <Card className="tw:p-5">
          <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold"><Clock className="tw:h-4 tw:w-4 tw:text-brand-600" /> Recent Materials</h2>
          {recentMaterials.length ? (
            <ul className="tw:mt-3 tw:space-y-2">
              {recentMaterials.map((item) => (
                <li key={item._id} className="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                  <span className="tw:flex tw:h-8 tw:w-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><FileText className="tw:h-4 tw:w-4" /></span>
                  <div className="tw:min-w-0 tw:flex-1">
                    <p className="tw:truncate tw:text-sm tw:font-semibold">{item.title}</p>
                    <p className="tw:truncate tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                      {item.courseId?.courseCode || 'Unassigned'} &middot; {item.uploadedBy?.name || 'Admin'}
                    </p>
                  </div>
                  <span className="tw:shrink-0 tw:text-[11px] tw:text-slate-400">{getRelativeTime(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tw:py-4 tw:text-center tw:text-sm tw:text-slate-400">No materials uploaded yet.</p>
          )}
        </Card>

        <Card className="tw:p-5">
          <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold"><Award className="tw:h-4 tw:w-4 tw:text-brand-600" /> Top Courses</h2>
          {topCourses.length ? (
            <ul className="tw:mt-3 tw:space-y-2">
              {topCourses.map((course, index) => (
                <li key={course._id} className="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                  <span className="tw:flex tw:h-7 tw:w-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-slate-100 tw:text-xs tw:font-bold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300">{index + 1}</span>
                  <div className="tw:min-w-0 tw:flex-1">
                    <p className="tw:truncate tw:text-sm tw:font-semibold">{course.courseName}</p>
                    <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{course.courseCode}</p>
                    <div className="tw:mt-1.5 tw:h-1.5 tw:w-full tw:overflow-hidden tw:rounded-full tw:bg-slate-100 tw:dark:bg-slate-800">
                      <div
                        className="tw:h-full tw:rounded-full tw:bg-brand-600"
                        style={{ width: `${Math.round((course.materialCount / topCourseMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="tw:shrink-0 tw:text-sm tw:font-bold">{course.materialCount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tw:py-4 tw:text-center tw:text-sm tw:text-slate-400">No course activity yet.</p>
          )}
        </Card>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
        {quickActions.map(({ to, icon: Icon, title, desc }) => (
          <Link key={to} to={to} className="tw:block">
            <Card interactive className="tw:flex tw:h-full tw:flex-col tw:gap-2 tw:p-4">
              <span className="tw:flex tw:h-9 tw:w-9 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                <Icon className="tw:h-4.5 tw:w-4.5" />
              </span>
              <h3 className="tw:font-heading tw:text-sm tw:font-bold">{title}</h3>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminOverview;
