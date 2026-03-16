import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { FiBriefcase, FiCheckCircle, FiGrid, FiShield, FiUserPlus, FiBell, FiMessageCircle, FiX } from 'react-icons/fi';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Explore from './pages/Explore';
import Ask from './pages/Ask';
import AllCourses from './pages/AllCourses';
import Practice from './pages/Practice';
import AdminUpload from './pages/AdminUpload';
import AdminOverview from './pages/AdminOverview';
import AdminBroadcast from './pages/AdminBroadcast';
import AdminApiUsage from './pages/AdminApiUsage';
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
import Disclaimer from './pages/Disclaimer';
import PublicSummariesLanding from './pages/PublicSummariesLanding';
import PublicSiwesLanding from './pages/PublicSiwesLanding';
import PublicNounMaterialsLanding from './pages/PublicNounMaterialsLanding';
import PublicNounPracticeLanding from './pages/PublicNounPracticeLanding';
import PublicNounCommunityLanding from './pages/PublicNounCommunityLanding';
import PublicCoursePreview from './pages/PublicCoursePreview';
import NewsHub from './pages/NewsHub';
import NewsArticle from './pages/NewsArticle';
import Footer from './components/Footer';
import AdminLayout from './components/AdminLayout';
import SEO from './components/SEO';
import './App.css';

const FIRST_VISIT_KEY = 'np_first_visit_seen_v1';

const WelcomeLanding = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://paddi.com.ng/#website',
        url: 'https://paddi.com.ng',
        name: 'NounPaddi',
        alternateName: 'NounPaddi Community',
        description: 'NounPaddi is a NOUN student community and learning platform with course summaries, practice exams, and study support.',
      },
      {
        '@type': 'EducationalOrganization',
        '@id': 'https://paddi.com.ng/#organization',
        name: 'NounPaddi',
        alternateName: 'NounPaddi Community',
        url: 'https://paddi.com.ng',
        description: 'Learning and community platform for National Open University of Nigeria students.',
        founder: {
          '@id': 'https://paddi.com.ng/#founder',
        },
        areaServed: {
          '@type': 'Country',
          name: 'Nigeria',
        },
      },
      {
        '@type': 'Person',
        '@id': 'https://paddi.com.ng/#founder',
        name: 'Kingsley Udoma',
        jobTitle: 'Developer and Founder',
        worksFor: {
          '@id': 'https://paddi.com.ng/#organization',
        },
      },
    ],
  };

  const markSeen = () => {
    try {
      localStorage.setItem(FIRST_VISIT_KEY, '1');
    } catch (error) {
      // Ignore localStorage failures
    }
  };

  return (
    <div className="welcome-landing">
      <SEO
        title="NounPaddi Community for NOUN Students | Founded by Kingsley Udoma"
        description="NounPaddi is a NOUN student community with course summaries, practice exams, and study support for National Open University of Nigeria students, founded by Kingsley Udoma."
        url="/"
        keywords="NounPaddi, NOUN community, NOUN students, National Open University of Nigeria, course summaries, practice exams, Kingsley Udoma"
        structuredData={structuredData}
      />
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
            <p className="welcome-lead">
              NounPaddi supports National Open University of Nigeria students with NOUN course materials,
              NOUN course summaries, practice questions, and SIWES guidance in one place.
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
            <div className="footer-links" style={{ marginTop: '18px' }}>
              <Link to="/noun-course-materials">NOUN Materials</Link>
              <Link to="/noun-practice-questions">NOUN Practice Questions</Link>
              <Link to="/noun-student-community">NOUN Student Community</Link>
            </div>
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
    return <Navigate to={user.role === 'admin' ? '/admin/overview' : '/explore'} />;
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

const NotificationPermissionBar = () => {
  const { user, loading, notificationPermission, enableNotifications } = useAuth();

  if (loading || !user) return null;
  if (notificationPermission === 'granted' || notificationPermission === 'unsupported') return null;

  return (
    <div className="notification-permission-bar">
      <div className="notification-permission-content">
        <span className="notification-permission-icon"><FiBell /></span>
        <p>
          Turn on notifications for latest news updates, past questions/exam practices, and important updates.
        </p>
      </div>
      <button type="button" className="btn btn-primary" onClick={enableNotifications}>
        Enable Notifications
      </button>
    </div>
  );
};

const ITPlacementRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return user ? <ITPlacement /> : <PublicSiwesLanding />;
};

const GlobalAskBubble = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading || !user || user.role === 'admin') return null;
  if (location.pathname.startsWith('/admin') || location.pathname === '/ask') return null;

  return (
    <Link to="/ask" className="global-ask-bubble" aria-label="Open Ask Paddi">
      <FiMessageCircle />
      <span>Ask Paddi</span>
    </Link>
  );
};

const PAST_QUESTION_SHEET_KEY = 'np_past_questions_sheet_hidden';

const PastQuestionBottomSheet = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user || user.role === 'admin') {
      setOpen(false);
      return;
    }

    if (location.pathname.startsWith('/admin') || location.pathname === '/ask') {
      setOpen(false);
      return;
    }

    const userKey = `${PAST_QUESTION_SHEET_KEY}:${String(user._id || user.email || user.id || 'user')}`;
    let shouldHide = false;

    try {
      shouldHide = localStorage.getItem(userKey) === '1';
    } catch (error) {
      shouldHide = false;
    }

    setOpen(!shouldHide);
  }, [loading, user, location.pathname]);

  const dismiss = (persist = false) => {
    if (persist && user) {
      const userKey = `${PAST_QUESTION_SHEET_KEY}:${String(user._id || user.email || user.id || 'user')}`;
      try {
        localStorage.setItem(userKey, '1');
      } catch (error) {
        // Ignore storage failures.
      }
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="np-bottom-sheet-overlay" role="presentation">
      <div className="np-bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="np-bottom-sheet-title">
        <button
          type="button"
          className="np-bottom-sheet-close"
          aria-label="Close past questions notice"
          onClick={() => dismiss(false)}
        >
          <FiX />
        </button>
        <p className="np-bottom-sheet-kicker">New</p>
        <h3 id="np-bottom-sheet-title">Past Questions is now available</h3>
        <p>
          You can now find NOUN past questions and related files faster from Ask Paddi.
        </p>
        <div className="np-bottom-sheet-actions">
          <Link to="/ask" className="btn btn-primary" onClick={() => setOpen(false)}>
            Go to Ask
          </Link>
          <button
            type="button"
            className="np-bottom-sheet-dismiss"
            onClick={() => dismiss(true)}
          >
            Don&apos;t show this dialog again
          </button>
        </div>
      </div>
    </div>
  );
};

const AppLayout = () => {
  const location = useLocation();
  const hideFooterRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const shouldHideFooter = hideFooterRoutes.includes(location.pathname)
    || location.pathname.startsWith('/share')
    || location.pathname.startsWith('/admin');

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App">
          <Navbar />
          <NotificationPermissionBar />
          <PastQuestionBottomSheet />
          <GlobalAskBubble />
          <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/share/:token" element={<ShareRedirect />} />
                <Route path="/disclaimer" element={<Disclaimer />} />
                <Route path="/noun-course-materials" element={<PublicNounMaterialsLanding />} />
                <Route path="/noun-practice-questions" element={<PublicNounPracticeLanding />} />
                <Route path="/noun-student-community" element={<PublicNounCommunityLanding />} />
                <Route path="/noun-course/:courseSlug" element={<PublicCoursePreview />} />
                <Route path="/news" element={<NewsHub />} />
                <Route path="/news/:slug" element={<NewsArticle />} />

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
                  path="/ask"
                  element={<Ask />}
                />
                <Route
                  path="/courses"
                  element={<AllCourses />}
                />
                <Route
                  path="/course/:courseId"
                  element={<CourseDetail />}
                />
                <Route
                  path="/practice"
                  element={<Practice />}
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
                  element={<ITPlacementRoute />}
                />
                <Route path="/summaries" element={<PublicSummariesLanding />} />
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
                  path="/admin/overview"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminLayout>
                        <AdminOverview />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/broadcast"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminLayout>
                        <AdminBroadcast />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/api-usage"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminLayout>
                        <AdminApiUsage />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route path="/admin/dashboard" element={<Navigate to="/admin/overview" replace />} />
                <Route
                  path="/admin/upload"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminLayout>
                        <AdminUpload />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/materials"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminLayout>
                        <AdminMaterials />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminLayout>
                        <AdminUsers />
                      </AdminLayout>
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
