import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiGrid,
  FiUploadCloud,
  FiLayers,
  FiUsers,
  FiBell,
  FiActivity,
  FiBriefcase,
  FiMap,
  FiBookOpen,
  FiShield,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import './AdminLayout.css';

const adminMenu = [
  { to: '/admin/overview', label: 'Overview', icon: FiGrid, key: 'overview' },
  { to: '/admin/broadcast', label: 'Push Broadcast', icon: FiBell, key: 'broadcast' },
  { to: '/admin/api-usage', label: 'API Usage', icon: FiActivity, key: 'api-usage' },
  { to: '/admin/upload?tab=faculties', label: 'Faculties', icon: FiBriefcase, key: 'faculties' },
  { to: '/admin/upload?tab=departments', label: 'Departments', icon: FiMap, key: 'departments' },
  { to: '/admin/upload?tab=courses', label: 'Courses', icon: FiBookOpen, key: 'courses' },
  { to: '/admin/upload?tab=materials', label: 'Upload Materials', icon: FiUploadCloud, key: 'materials-upload' },
  { to: '/admin/materials', label: 'Material Library', icon: FiLayers, key: 'materials-library' },
  { to: '/admin/users', label: 'Users', icon: FiUsers, key: 'users' },
  { to: '/admin/users#invite', label: 'Invite Admin', icon: FiShield, key: 'invite-admin' },
];

const AdminLayout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const activeUploadTab = new URLSearchParams(location.search).get('tab') || 'faculties';
  const activeHash = location.hash || '';

  const isItemActive = (item) => {
    if (item.key === 'invite-admin') {
      return location.pathname === '/admin/users' && activeHash === '#invite';
    }
    if (item.key === 'users') {
      return location.pathname === '/admin/users' && activeHash !== '#invite';
    }
    if (location.pathname === '/admin/upload') {
      if (item.key === 'faculties' && activeUploadTab === 'faculties') return true;
      if (item.key === 'departments' && activeUploadTab === 'departments') return true;
      if (item.key === 'courses' && activeUploadTab === 'courses') return true;
      if (item.key === 'materials-upload' && activeUploadTab === 'materials') return true;
    }
    return location.pathname === item.to;
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <p className="admin-sidebar-kicker">Admin Workspace</p>
          <h2>NounPaddi Control</h2>
        </div>

        <nav className="admin-sidebar-nav">
          {adminMenu.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`admin-nav-item ${isItemActive(item) ? 'active' : ''}`}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-user-chip">
            <span className="admin-user-avatar">{(user?.name || 'A').charAt(0).toUpperCase()}</span>
            <div>
              <strong>{user?.name || 'Admin'}</strong>
              <p>{user?.email || 'admin@nounpaddi'}</p>
            </div>
          </div>
          <p className="admin-sidebar-tip">
            <FiBell /> Broadcast updates from Push Broadcast.
          </p>
        </div>
      </aside>

      <main className="admin-main-content">{children}</main>
    </div>
  );
};

export default AdminLayout;
