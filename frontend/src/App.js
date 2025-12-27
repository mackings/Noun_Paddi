import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import StudentDashboard from './pages/StudentDashboard';
import CourseDetail from './pages/CourseDetail';
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

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <div className="App">
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />

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

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
