import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { FiMenu, FiX, FiLogOut, FiUser, FiSun, FiMoon, FiBook, FiBell, FiFolder } from 'react-icons/fi';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-content">
          <Link to="/" className="navbar-brand" onClick={() => setMobileMenuOpen(false)}>
            <FiBook className="brand-icon" />
            <span className="brand-text">NounPaddi</span>
          </Link>

          {/* Desktop Menu */}
          <div className="navbar-menu desktop-menu">
            {user ? (
              <>
                {user.role === 'student' && (
                  <>
                    <Link to="/dashboard" className="nav-link">Dashboard</Link>
                    <Link to="/explore" className="nav-link">Courses</Link>
                    <Link to="/practice" className="nav-link">Practice Exam</Link>
                    <Link to="/it-placement" className="nav-link">IT Placement</Link>
                    <Link to="/reminders" className="nav-link"><FiBell size={16} /> Reminders</Link>
                    <Link to="/projects" className="nav-link"><FiFolder size={16} /> Projects</Link>
                  </>
                )}
                {user.role === 'admin' && (
                  <>
                    <Link to="/admin/dashboard" className="nav-link">Dashboard</Link>
                    <Link to="/admin/materials" className="nav-link">Materials</Link>
                    <Link to="/admin/upload" className="nav-link">Upload</Link>
                  </>
                )}
                <button
                  onClick={toggleTheme}
                  className="theme-toggle"
                  aria-label="Toggle theme"
                >
                  {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
                </button>
                <Link to="/profile" className="nav-user-icon" title={user.name}>
                  <FiUser size={20} />
                </Link>
                <button onClick={handleLogout} className="btn btn-sm btn-secondary">
                  <FiLogOut /> <span className="logout-text">Logout</span>
                </button>
              </>
            ) : (
              <>
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

          {/* Mobile Menu Toggle */}
          <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
            {mobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
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
                    <Link to="/practice" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      Practice Exam
                    </Link>
                    <Link to="/it-placement" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      IT Placement
                    </Link>
                    <Link to="/reminders" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      <FiBell size={16} /> Reminders
                    </Link>
                    <Link to="/projects" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      <FiFolder size={16} /> Projects
                    </Link>
                  </>
                )}
                {user.role === 'admin' && (
                  <>
                    <Link to="/admin/dashboard" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <Link to="/admin/materials" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      Materials
                    </Link>
                    <Link to="/admin/upload" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>
                      Upload
                    </Link>
                  </>
                )}
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
