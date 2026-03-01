import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { FiBriefcase, FiCheckCircle, FiGrid, FiShield, FiUserPlus, FiBell, FiX, FiSend, FiBookOpen, FiTrendingUp } from 'react-icons/fi';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { setupPushNotifications } from './utils/pushManager';
import Navbar from './components/Navbar';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Explore from './pages/Explore';
import AllCourses from './pages/AllCourses';
import Practice from './pages/Practice';
import AdminUpload from './pages/AdminUpload';
import AdminDashboard from './pages/AdminDashboard';
import AdminMaterials from './pages/AdminMaterials';
import AdminUsers from './pages/AdminUsers';
import StudentDashboard from './pages/StudentDashboard';
import CourseDetail from './pages/CourseDetail';
import Profile from './pages/Profile';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ITPlacement from './pages/ITPlacement';
import Reminders from './pages/Reminders';
import PlagiarismChecker from './pages/PlagiarismChecker';
import Projects from './pages/Projects';
import ConsultationTerms from './pages/ConsultationTerms';
import ProjectConsultation from './pages/ProjectConsultation';
import ShareRedirect from './pages/ShareRedirect';
import Footer from './components/Footer';
import './App.css';

const FIRST_VISIT_KEY = 'np_first_visit_seen_v1';

const WelcomeLanding = () => {
  const markSeen = () => {
    try {
      localStorage.setItem(FIRST_VISIT_KEY, '1');
    } catch (error) {
      // Ignore localStorage failures
    }
  };

  return (
    <div className="welcome-landing">
      <div className="container">
        <div className="welcome-hero-shell">
          <div className="welcome-glow welcome-glow-one"></div>
          <div className="welcome-glow welcome-glow-two"></div>
          <div className="welcome-glow welcome-glow-three"></div>
          <div className="welcome-landing-card">
            <p className="welcome-kicker">Welcome to NounPaddi</p>
            <h1>Study smarter with a modern NOUN learning platform</h1>
            <p className="welcome-lead">
              Everything you need in one focused workspace: discover materials, get free summaries,
              and practice confidently before exams.
            </p>
            <div className="welcome-proof-strip">
              <span>Built for NOUN students</span>
              <span>Fast & simple onboarding</span>
              <span>Mobile friendly</span>
            </div>

            <div className="welcome-feature-grid">
              <div className="welcome-feature">
                <FiCheckCircle />
                <span>Free Course Summaries</span>
              </div>
              <div className="welcome-feature">
                <FiGrid />
                <span>Practice Questions</span>
              </div>
              <div className="welcome-feature">
                <FiShield />
                <span>Free Project Plagiarism Checker</span>
              </div>
              <div className="welcome-feature">
                <FiBriefcase />
                <span>SIWES & IT Placement</span>
              </div>
            </div>

            <div className="welcome-actions">
              <Link to="/signup" className="btn btn-primary" onClick={markSeen}>
                <FiUserPlus />
                Sign Up to Get Started
              </Link>
              <Link to="/login" className="btn btn-outline" onClick={markSeen}>
                Existing User? Sign In
              </Link>
            </div>

            <p className="welcome-footnote">Join now and start learning in minutes.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/explore" />;
  }

  return children;
};

// Home Route - Redirects based on auth status
const Home = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/explore'} />;
  }

  let hasSeenFirstVisit = false;
  try {
    hasSeenFirstVisit = localStorage.getItem(FIRST_VISIT_KEY) === '1';
  } catch (error) {
    hasSeenFirstVisit = false;
  }

  if (!hasSeenFirstVisit) {
    return <WelcomeLanding />;
  }

  return <Navigate to="/login" />;
};

const NotificationPermissionDialog = () => {
  const { user, loading } = useAuth();
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    if (loading || !user || typeof window === 'undefined' || !('Notification' in window)) {
      setVisible(false);
      return;
    }

    const permission = Notification.permission;
    const shouldPrompt = permission !== 'granted';
    setVisible(shouldPrompt);
    setIsDenied(permission === 'denied');
    setMessage('');
  }, [loading, user]);

  const handleEnable = async () => {
    setRequesting(true);
    setMessage('');

    try {
      const result = await setupPushNotifications();
      if (result?.subscribed) {
        setVisible(false);
        return;
      }

      if (result?.reason === 'denied') {
        setIsDenied(true);
        setMessage('Notifications are blocked. Enable them in your browser or device site settings.');
      } else {
        setMessage('Please allow notifications in the permission prompt to receive important updates.');
      }
    } catch (error) {
      setMessage(error?.message || 'Unable to enable notifications right now. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="np-notification-prompt-overlay" role="dialog" aria-modal="true">
      <div className="np-notification-prompt-card">
        <button
          type="button"
          className="np-notification-close"
          aria-label="Close notification prompt"
          onClick={() => setVisible(false)}
          disabled={requesting}
        >
          <FiX />
        </button>
        <div className="np-notification-icon-shell">
          <div className="np-notification-icon">
            <FiBell />
          </div>
        </div>
        <h3>Enable Notifications</h3>
        <p>
          Stay ahead in your studies by turning on notifications.
        </p>
        <div className="np-notification-benefits">
          <div className="np-benefit-item">
            <FiTrendingUp />
            <span>Latest news updates</span>
          </div>
          <div className="np-benefit-item">
            <FiBookOpen />
            <span>Past Questions and exam practices</span>
          </div>
          <div className="np-benefit-item">
            <FiSend />
            <span>Other important updates from admins</span>
          </div>
        </div>
        {isDenied && (
          <p className="np-notification-hint">
            Notifications are currently blocked. Open browser settings and allow notifications for this site.
          </p>
        )}
        {message && <p className="np-notification-error">{message}</p>}
        <div className="np-notification-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setVisible(false)} disabled={requesting}>
            Not Now
          </button>
          <button type="button" className="btn btn-primary" onClick={handleEnable} disabled={requesting}>
            {requesting ? 'Enabling...' : 'Enable Notifications'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AppLayout = () => {
  const location = useLocation();
  const hideFooterRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const shouldHideFooter = hideFooterRoutes.includes(location.pathname) || location.pathname.startsWith('/share');

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App">
          <Navbar />
          <NotificationPermissionDialog />
          <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/share/:token" element={<ShareRedirect />} />

                {/* Student Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <StudentDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/explore"
                  element={
                    <ProtectedRoute>
                      <Explore />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses"
                  element={
                    <ProtectedRoute>
                      <AllCourses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/course/:courseId"
                  element={
                    <ProtectedRoute>
                      <CourseDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/practice"
                  element={
                    <ProtectedRoute>
                      <Practice />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/it-placement"
                  element={
                    <ProtectedRoute>
                      <ITPlacement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reminders"
                  element={
                    <ProtectedRoute>
                      <Reminders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/plagiarism"
                  element={
                    <ProtectedRoute>
                      <PlagiarismChecker />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute>
                      <Projects />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/consultation"
                  element={
                    <ProtectedRoute>
                      <ProjectConsultation />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/consultation-terms"
                  element={
                    <ProtectedRoute>
                      <ConsultationTerms />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Routes */}
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/upload"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminUpload />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/materials"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminMaterials />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminUsers />
                    </ProtectedRoute>
                  }
                />

                {/* Catch all */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          {!shouldHideFooter && <Footer />}
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
};

function App() {
  return (
    <HelmetProvider>
      <Router>
        <AppLayout />
      </Router>
    </HelmetProvider>
  );
}

export default App;
