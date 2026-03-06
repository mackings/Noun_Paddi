import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';
import { FiUser, FiMail, FiLock, FiBook, FiHash, FiFileText, FiMapPin, FiEye, FiEyeOff } from 'react-icons/fi';
import './Auth.css';

const NIGERIA_STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
  'Federal Capital Territory (FCT)',
];

const ALLOWED_EMAIL_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'ng', 'co', 'io', 'info', 'me', 'app',
]);

const hasDangerousPattern = (value) =>
  /<[^>]+>|javascript:|on\w+\s*=|script/gi.test(String(value || ''));

const normalizeText = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, '')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (code >= 32 && code !== 127) || char === ' ';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

const isValidEmail = (email) => {
  const normalized = normalizeText(email).toLowerCase();
  const basicRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i;
  if (!basicRegex.test(normalized)) return false;
  const parts = normalized.split('.');
  const tld = parts[parts.length - 1];
  return ALLOWED_EMAIL_TLDS.has(tld);
};

const isValidName = (name) => {
  const normalized = normalizeText(name);
  if (normalized.length < 2 || normalized.length > 80) return false;
  return /^[a-zA-Z][a-zA-Z\s'.-]{1,79}$/.test(normalized);
};

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    faculty: '',
    department: '',
    studyCenter: '',
    matricNumber: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getSafeRedirect = () => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    if (!redirect) return null;
    if (!redirect.startsWith('/') || redirect.startsWith('//')) return null;
    return redirect;
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const safeName = normalizeText(formData.name);
    const safeEmail = normalizeText(formData.email).toLowerCase();

    if (hasDangerousPattern(formData.name) || hasDangerousPattern(formData.email)) {
      setError('Invalid characters detected in signup fields');
      return;
    }

    if (!isValidName(safeName)) {
      setError('Enter a valid full name (letters, spaces, apostrophe, hyphen only)');
      return;
    }

    if (!isValidEmail(safeEmail)) {
      setError('Enter a valid email address');
      return;
    }

    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      await signup({
        ...formData,
        name: safeName,
        email: safeEmail,
      });
      const redirect = getSafeRedirect();
      if (redirect) {
        navigate(redirect);
        return;
      }
      navigate(formData.role === 'admin' ? '/admin/upload' : '/explore');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <SEO
        title="Sign Up - Join NounPaddi | NOUN Study Platform"
        description="Create your free NounPaddi account to access personalized course materials, practice exams, and IT placement opportunities for National Open University of Nigeria students."
        url="/signup"
        keywords="sign up, register, create account, NOUN student registration, join NounPaddi, free account"
      />
      <div className="auth-card signup-card">
        <div className="auth-logo">
          <FiBook />
        </div>
        <h1 className="auth-title">Join NounPaddi</h1>
        <p className="auth-subtitle">Start your learning journey with personalized study materials and practice exams</p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div className="input-group">
              <FiUser className="input-icon" size={20} />
              <input
                type="text"
                name="name"
                className="form-control"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                maxLength={80}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-group">
              <FiMail className="input-icon" size={20} />
              <input
                type="email"
                name="email"
                className="form-control"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {formData.role === 'student' && (
            <>
              <div className="form-group">
                <label className="form-label">Matric Number</label>
                <div className="input-group">
                  <FiHash className="input-icon" size={20} />
                  <input
                    type="text"
                    name="matricNumber"
                    className="form-control"
                    value={formData.matricNumber}
                    onChange={handleChange}
                    placeholder="e.g., NOU/123456"
                  />
                </div>
              </div>

              <div className="signup-row">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <div className="input-group">
                    <FiFileText className="input-icon" size={20} />
                    <input
                      type="text"
                      name="department"
                      className="form-control"
                      value={formData.department}
                      onChange={handleChange}
                      placeholder="e.g., Computer Science"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Study Center</label>
                  <div className="input-group">
                    <FiMapPin className="input-icon" size={20} />
                    <select
                      name="studyCenter"
                      className="form-control"
                      value={formData.studyCenter}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select your study center</option>
                      {NIGERIA_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-group">
              <FiLock className="input-icon" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="form-control password-input"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleChange}
                minLength="8"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`btn btn-primary btn-block btn-lg ${loading ? 'btn-loading' : ''}`}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
