import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { FiMenu, FiX, FiLogOut, FiUser, FiSun, FiMoon, FiBook, FiBell, FiFolder, FiChevronDown, FiAlertTriangle, FiMessageSquare } from 'react-icons/fi';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projectsMenuOpen, setProjectsMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
    setProjectsMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const toggleProjectsMenu = () => {
    setProjectsMenuOpen(true);
  };

  return (
    <nav className="navbar">
      <div className="container">
          <div className="navbar-content">
          <Link to="/" className="navbar-brand" onClick={() => setMobileMenuOpen(false)}>
            <FiBook className="brand-icon" />
          </Link>

          {/* Desktop Menu */}
          <div className="navbar-menu desktop-menu">
            {user ? (
              <>
                {user.role === 'student' && (
                  <>
                    <Link to="/dashboard" className="nav-link">Dashboard</Link>
                    <Link to="/explore" className="nav-link">Courses</Link>
                    <Link to="/ask" className="nav-link"><FiMessageSquare size={16} /> Ask</Link>
                    <Link to="/practice" className="nav-link">Practice Exam</Link>
                    <Link to="/it-placement" className="nav-link">Siwes</Link>
                    <div
                      className={`nav-dropdown ${projectsMenuOpen ? 'open' : ''}`}
                      onMouseEnter={() => setProjectsMenuOpen(true)}
                      onMouseLeave={() => setProjectsMenuOpen(false)}
                    >
                      <button
                        className="nav-link nav-dropdown-toggle"
                        type="button"
                        onClick={toggleProjectsMenu}
                        aria-expanded={projectsMenuOpen}
                      >
                        <FiFolder size={16} /> Projects <FiChevronDown size={14} />
                      </button>
                      <div className="nav-dropdown-menu">
                        <Link
                          to="/projects"
                          className="nav-dropdown-link"
                          onClick={() => setProjectsMenuOpen(false)}
                        >
                          Project Topics
                        </Link>
                        <Link
                          to="/projects/consultation"
                          className="nav-dropdown-link"
                          onClick={() => setProjectsMenuOpen(false)}
                        >
                          Consultation
                        </Link>
                      </div>
                    </div>
                  </>
                )}
                {user.role === 'admin' && (
                  <>
                    <Link to="/admin/overview" className="nav-link">Admin Workspace</Link>
                  </>
                )}
                <Link to="/disclaimer" className="nav-icon-link" aria-label="Disclaimer" title="Disclaimer">
                  <FiAlertTriangle size={18} />
                </Link>
                <button
                  onClick={toggleTheme}
                  className="theme-toggle"
                  aria-label="Toggle theme"
                >
                  {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
                </button>
                <div
                  className={`nav-dropdown nav-profile-dropdown ${profileMenuOpen ? 'open' : ''}`}
                  onMouseEnter={() => setProfileMenuOpen(true)}
                  onMouseLeave={() => setProfileMenuOpen(false)}
                >
                  <button
                    type="button"
                    className="nav-user-icon nav-profile-toggle"
                    title={user.name}
                    onClick={() => setProfileMenuOpen((current) => !current)}
                    aria-expanded={profileMenuOpen}
                  >
                    <FiUser size={20} />
                  </button>
                  <div className="nav-dropdown-menu nav-profile-menu">
                    <Link
                      to="/profile"
                      className="nav-dropdown-link"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      <FiUser size={16} /> Profile
                    </Link>
                    {user.role === 'student' && (
                      <Link
                        to="/reminders"
                        className="nav-dropdown-link"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <FiBell size={16} /> Alarms
                      </Link>
                    )}
                  </div>
                </div>
                <button onClick={handleLogout} className="btn btn-sm btn-secondary">
                  <FiLogOut /> <span className="logout-text">Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/disclaimer" className="nav-icon-link" aria-label="Disclaimer" title="Disclaimer">
                  <FiAlertTriangle size={18} />
                </Link>
                <button
                  onClick={toggleTheme}
                  className="theme-toggle"
                  aria-label="Toggle theme"
                >
                  {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
                </button>
                <Link to="/login" className="btn btn-sm btn-secondary">Login</Link>
                <Link to="/signup" className="btn btn-sm btn-primary">Sign Up</Link>
              </>
            )}
          </div>

          <div className="mobile-controls">
            {user && (
              <Link
                to="/profile"
                className="mobile-profile-icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Profile"
                title={user.name}
              >
                <FiUser size={20} />
              </Link>
            )}
            {/* Mobile Menu Toggle */}
            <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
              {mobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="mobile-menu">
            {user ? (
              <>
                <div className="mobile-user-info">
                  <FiUser size={20} />
                  <span>{user.name}</span>
                  <span className="user-role">({user.role})</span>
                </div>
                {user.role === 'student' && (
                  <>
                    <Link to="/dashboard" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <Link to="/explore" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      Courses
                    </Link>
                    <Link to="/ask" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      <FiMessageSquare size={16} /> Ask
                    </Link>
                    <Link to="/practice" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      Practice Exam
                    </Link>
                    <Link to="/it-placement" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      Siwes
                    </Link>
                    <div className="mobile-submenu">
                      <div className="mobile-nav-link mobile-submenu-title">
                        <FiUser size={16} /> Profile
                      </div>
                      <Link to="/profile" className="mobile-submenu-link" onClick={() => setMobileMenuOpen(false)}>
                        My Profile
                      </Link>
                      <Link to="/reminders" className="mobile-submenu-link" onClick={() => setMobileMenuOpen(false)}>
                        <FiBell size={16} /> Alarms
                      </Link>
                    </div>
                    <div className="mobile-submenu">
                      <div className="mobile-nav-link mobile-submenu-title">
                        <FiFolder size={16} /> Projects
                      </div>
                      <Link to="/projects" className="mobile-submenu-link" onClick={() => setMobileMenuOpen(false)}>
                        Project Topics
                      </Link>
                      <Link to="/projects/consultation" className="mobile-submenu-link" onClick={() => setMobileMenuOpen(false)}>
                        Consultation
                      </Link>
                    </div>
                  </>
                )}
                {user.role === 'admin' && (
                  <>
                    <Link to="/admin/overview" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      Admin Workspace
                    </Link>
                  </>
                )}
                <Link
                  to="/disclaimer"
                  className="theme-toggle-mobile"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <FiAlertTriangle size={18} />
                  <span>Disclaimer</span>
                </Link>
                <button
                  onClick={toggleTheme}
                  className="theme-toggle-mobile"
                >
                  {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
                  <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
                <button onClick={handleLogout} className="btn btn-danger mobile-logout-btn">
                  <FiLogOut /> Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                  Login
                </Link>
                <Link to="/signup" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                  Sign Up
                </Link>
                <Link
                  to="/disclaimer"
                  className="theme-toggle-mobile"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <FiAlertTriangle size={18} />
                  <span>Disclaimer</span>
                </Link>
                <button
                  onClick={toggleTheme}
                  className="theme-toggle-mobile"
                >
                  {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
                  <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
