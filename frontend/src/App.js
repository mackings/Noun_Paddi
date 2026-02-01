import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Explore from './pages/Explore';
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

  return <Navigate to="/login" />;
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
