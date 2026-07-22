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
  const [localPart = '', domainPart = ''] = normalized.split('@');
  if (localPart.length < 2 || localPart.length > 64) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return false;
  const labels = domainPart.split('.');
  if (labels.length < 2) return false;
  if (labels.some((label) => label.length < 2 || label.length > 63)) return false;
  if (labels.some((label) => label.startsWith('-') || label.endsWith('-'))) return false;
  if (labels.some((label) => !/^[a-z0-9-]+$/i.test(label))) return false;
  const tld = labels[labels.length - 1];
  return ALLOWED_EMAIL_TLDS.has(tld);
};

const isValidName = (name) => {
  const normalized = normalizeText(name);
  if (normalized.length < 5 || normalized.length > 80) return false;
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every((part) => /^[a-zA-Z][a-zA-Z'.-]{1,39}$/.test(part));
};

const isValidProfileText = (value) => {
  const normalized = normalizeText(value);
  if (normalized.length < 3 || normalized.length > 80) return false;
  return /^[a-zA-Z][a-zA-Z\s'&().,-]{2,79}$/.test(normalized);
};

const normalizeMatricNumber = (value) => normalizeText(value).toUpperCase();

const isValidMatricNumber = (value) => {
  const normalized = normalizeMatricNumber(value);
  if (normalized.length < 6 || normalized.length > 24) return false;
  if (!/[A-Z]/.test(normalized) || !/[0-9]/.test(normalized)) return false;
  return /^[A-Z0-9/-]+$/.test(normalized);
};

const validateStrongPassword = (password) => {
  const raw = String(password || '');
  if (raw.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(raw)) return 'Password must include at least one uppercase letter';
  if (!/[a-z]/.test(raw)) return 'Password must include at least one lowercase letter';
  if (!/[0-9]/.test(raw)) return 'Password must include at least one number';
  if (!/[^A-Za-z0-9]/.test(raw)) return 'Password must include at least one special character';
  return '';
};

const getPasswordChecks = (password) => {
  const raw = String(password || '');
  return [
    { key: 'length', label: 'At least 8 characters', passed: raw.length >= 8 },
    { key: 'upper', label: 'One uppercase letter', passed: /[A-Z]/.test(raw) },
    { key: 'lower', label: 'One lowercase letter', passed: /[a-z]/.test(raw) },
    { key: 'number', label: 'One number', passed: /[0-9]/.test(raw) },
    { key: 'special', label: 'One special character', passed: /[^A-Za-z0-9]/.test(raw) },
  ];
};

const getPasswordHelper = (password) => {
  const remaining = Math.max(0, 8 - String(password || '').length);
  if (remaining > 0) {
    return `${remaining} more character${remaining === 1 ? '' : 's'} to reach 8`;
  }
  return 'Minimum length reached';
};

// Hardcoded for now — the /faculties API-backed dropdown was coming up empty for
// students on signup. faculty._id here only needs to be a stable local key (the
// submit handler resolves it back to .name, which is the only part that's actually
// sent to the signup API), so it doesn't need to match a real Faculty document id.
const FACULTIES = [
  { _id: 'faculty-of-science', name: 'Faculty of Science' },
  { _id: 'faculty-of-agriculture', name: 'Faculty of Agriculture' },
  { _id: 'faculty-of-arts', name: 'Faculty of Arts' },
  { _id: 'faculty-of-education', name: 'Faculty of Education' },
  { _id: 'faculty-of-health-sciences', name: 'Faculty of Health Sciences' },
  { _id: 'faculty-of-law', name: 'Faculty of Law' },
  { _id: 'faculty-of-management-sciences', name: 'Faculty of Management Sciences' },
  { _id: 'faculty-of-social-sciences', name: 'Faculty of Social Sciences' },
  { _id: 'faculty-of-computing', name: 'Faculty of Computing' },
  { _id: 'de-and-general-studies', name: 'DE & General Studies' },
];

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
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const faculties = FACULTIES;
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
    const { name, value } = e.target;
    setFieldErrors((current) => ({ ...current, [name]: '' }));
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const safeName = normalizeText(formData.name);
    const safeEmail = normalizeText(formData.email).toLowerCase();
    const selectedFaculty = faculties.find((faculty) => faculty._id === formData.faculty);
    const facultyLabel = normalizeText(selectedFaculty?.name || '');
    const departmentLabel = normalizeText(formData.department);

    const nextFieldErrors = {};

    if (hasDangerousPattern(formData.name)) {
      nextFieldErrors.name = 'Invalid characters detected in your name';
    } else if (!isValidName(safeName)) {
      nextFieldErrors.name = 'Enter your full name, for example Mac Kingsley';
    }

    if (hasDangerousPattern(formData.email)) {
      nextFieldErrors.email = 'Invalid characters detected in your email';
    } else if (!isValidEmail(safeEmail)) {
      nextFieldErrors.email = 'Enter a valid email address';
    }

    if (!isValidProfileText(facultyLabel)) {
      nextFieldErrors.faculty = 'Select a valid faculty';
    }

    if (!isValidProfileText(departmentLabel)) {
      nextFieldErrors.department = 'Enter a valid department';
    }

    if (!NIGERIA_STATES.includes(formData.studyCenter)) {
      nextFieldErrors.studyCenter = 'Select a valid study center';
    }

    const safeMatricNumber = normalizeMatricNumber(formData.matricNumber);
    if (!isValidMatricNumber(safeMatricNumber)) {
      nextFieldErrors.matricNumber = 'Enter a valid matric number';
    }

    const passwordMessage = validateStrongPassword(formData.password);
    if (passwordMessage) {
      nextFieldErrors.password = passwordMessage;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setLoading(true);

    try {
      await signup({
        ...formData,
        name: safeName,
        email: safeEmail,
        faculty: facultyLabel,
        department: departmentLabel,
        matricNumber: safeMatricNumber,
      });
      const redirect = getSafeRedirect();
      if (redirect) {
        navigate(redirect);
        return;
      }
      navigate(formData.role === 'admin' ? '/admin/upload' : '/explore');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create account';
      const serverFieldErrors = {};

      if (/full name|valid full name|name/i.test(message)) serverFieldErrors.name = message;
      else if (/email/i.test(message)) serverFieldErrors.email = message;
      else if (/password/i.test(message)) serverFieldErrors.password = message;
      else if (/faculty/i.test(message)) serverFieldErrors.faculty = message;
      else if (/department/i.test(message)) serverFieldErrors.department = message;
      else if (/study center/i.test(message)) serverFieldErrors.studyCenter = message;
      else if (/matric/i.test(message)) serverFieldErrors.matricNumber = message;
      else setError(message);

      if (Object.keys(serverFieldErrors).length > 0) {
        setFieldErrors(serverFieldErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordChecks = getPasswordChecks(formData.password);
  const passwordHelper = getPasswordHelper(formData.password);

  return (
    <div className="auth-container">
      <SEO
        title="Sign Up - Join NounPaddi | NOUN Study Platform"
        description="Create your free NounPaddi account to access personalized course materials, practice exams, and IT placement opportunities for National Open University of Nigeria students."
        url="/signup"
        keywords="sign up, register, create account, NOUN student registration, join NounPaddi, free account"
        robots="noindex, nofollow"
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
            {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
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
            {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
          </div>

          {formData.role === 'student' && (
            <>
              <div className="form-group">
                <label className="form-label">Faculty</label>
                <div className="input-group">
                  <FiBook className="input-icon" size={20} />
                  <select
                    name="faculty"
                    className="form-control"
                    value={formData.faculty}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select your faculty</option>
                    {faculties.map((faculty) => (
                      <option key={faculty._id} value={faculty._id}>
                        {faculty.name}
                      </option>
                    ))}
                  </select>
                </div>
                {fieldErrors.faculty && <p className="field-error">{fieldErrors.faculty}</p>}
              </div>

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
                    placeholder="e.g., NOUN/CSC/23/123456"
                    minLength={6}
                    maxLength={24}
                    required
                  />
                </div>
                {fieldErrors.matricNumber && <p className="field-error">{fieldErrors.matricNumber}</p>}
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
                      maxLength={80}
                      required
                    />
                  </div>
                  {fieldErrors.department && <p className="field-error">{fieldErrors.department}</p>}
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
                  {fieldErrors.studyCenter && <p className="field-error">{fieldErrors.studyCenter}</p>}
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
            <p className="password-helper">{passwordHelper}</p>
            <div className="password-checklist">
              {passwordChecks.map((check) => (
                <p
                  key={check.key}
                  className={`password-check ${check.passed ? 'passed' : 'pending'}`}
                >
                  {check.passed ? 'OK' : 'NO'} {check.label}
                </p>
              ))}
            </div>
            {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
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
