import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiBell,
  FiChevronRight,
  FiCommand,
  FiGrid,
  FiUploadCloud,
  FiLayers,
  FiUsers,
  FiActivity,
  FiBriefcase,
  FiMap,
  FiBookOpen,
  FiShield,
  FiEdit3,
  FiAward,
  FiClipboard,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import './AdminLayout.css';

const adminMenu = [
  { to: '/admin/overview', label: 'Overview', icon: FiGrid, key: 'overview' },
  { to: '/admin/broadcast', label: 'Push Broadcast', icon: FiBell, key: 'broadcast', group: 'Operations' },
  { to: '/admin/api-usage', label: 'API Usage', icon: FiActivity, key: 'api-usage', group: 'Operations' },
  { to: '/admin/upload?tab=faculties', label: 'Faculties', icon: FiBriefcase, key: 'faculties', group: 'Academic Setup' },
  { to: '/admin/upload?tab=departments', label: 'Departments', icon: FiMap, key: 'departments', group: 'Academic Setup' },
  { to: '/admin/upload?tab=courses', label: 'Courses', icon: FiBookOpen, key: 'courses', group: 'Academic Setup' },
  { to: '/admin/upload?tab=materials', label: 'Upload Materials', icon: FiUploadCloud, key: 'materials-upload', group: 'Content' },
  { to: '/admin/materials', label: 'Material Library', icon: FiLayers, key: 'materials-library', group: 'Content' },
  { to: '/admin/tma?tab=assistant', label: 'TMA', icon: FiEdit3, key: 'tma', group: 'Content' },
  { to: '/admin/tma?tab=records', label: 'TMA Records', icon: FiClipboard, key: 'tma-records', group: 'Content' },
  { to: '/admin/quiz', label: 'Live Quiz', icon: FiAward, key: 'quiz', group: 'Content' },
  { to: '/admin/users', label: 'Users', icon: FiUsers, key: 'users', group: 'Access' },
  { to: '/admin/users#invite', label: 'Invite Admin', icon: FiShield, key: 'invite-admin', group: 'Access' },
];

const AdminLayout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const activeUploadTab = new URLSearchParams(location.search).get('tab') || 'faculties';
  const activeTmaTab = new URLSearchParams(location.search).get('tab') || 'assistant';
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
    if (location.pathname === '/admin/tma') {
      if (item.key === 'tma' && activeTmaTab === 'assistant') return true;
      if (item.key === 'tma-records' && activeTmaTab === 'records') return true;
      return false;
    }
    return location.pathname === item.to;
  };
  const activeItem = adminMenu.find((item) => isItemActive(item)) || adminMenu[0];
  const menuGroups = adminMenu.reduce((groups, item) => {
    const groupName = item.group || 'Workspace';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(item);
    return groups;
  }, {});

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <span className="admin-brand-mark"><FiCommand /></span>
          <div>
            <p className="admin-sidebar-kicker">Admin Workspace</p>
            <h2>NounPaddi</h2>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {Object.entries(menuGroups).map(([groupName, items]) => (
            <div className="admin-nav-group" key={groupName}>
              <p className="admin-nav-group-label">{groupName}</p>
              {items.map((item) => {
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
            </div>
          ))}
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
            <FiBell /> Broadcast updates and platform changes from one workspace.
          </p>
        </div>
      </aside>

      <main className="admin-main-content">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>Admin</span>
            <FiChevronRight />
            <strong>{activeItem?.label || 'Overview'}</strong>
          </div>
          <div className="admin-topbar-actions">
            <div className="admin-status-pill">
              <FiActivity />
              <span>Live workspace</span>
            </div>
            <span className="admin-topbar-avatar">{(user?.name || 'A').charAt(0).toUpperCase()}</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
