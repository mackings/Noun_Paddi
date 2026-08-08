import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';
import { User, Mail, Lock, BookOpen, Hash, FileText, MapPin, Eye, EyeOff, Check, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

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

const selectClass = 'tw:h-11 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:pl-10 tw:pr-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';

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
      navigate(formData.role === 'admin' ? '/admin/upload' : '/home');
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
    <div className="np-shell tw:flex tw:min-h-[calc(100vh-64px)] tw:items-center tw:justify-center tw:bg-slate-50 tw:p-4 tw:py-8 tw:dark:bg-slate-950">
      <SEO
        title="Sign Up - Join NounPaddi | NOUN Study Platform"
        description="Create your free NounPaddi account to access personalized course materials, practice exams, and IT placement opportunities for National Open University of Nigeria students."
        url="/signup"
        keywords="sign up, register, create account, NOUN student registration, join NounPaddi, free account"
        robots="noindex, nofollow"
      />

      <div className="tw:w-full tw:max-w-md tw:space-y-5">
        <div className="tw:text-center">
          <span className="tw:mx-auto tw:flex tw:h-12 tw:w-12 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-brand-600 tw:text-white">
            <BookOpen className="tw:h-6 tw:w-6" />
          </span>
          <h1 className="tw:font-heading tw:mt-3 tw:text-xl tw:font-bold tw:tracking-tight">Join NounPaddi</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Start your learning journey with personalized study materials and practice exams</p>
        </div>

        <Card className="tw:space-y-4 tw:p-5">
          {error && (
            <div className="tw:rounded-xl tw:bg-red-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="tw:space-y-4">
            <label className="tw:block tw:space-y-1.5">
              <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><User className="tw:h-3.5 tw:w-3.5" /> Full Name</span>
              <Input
                type="text"
                name="name"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                maxLength={80}
                required
              />
              {fieldErrors.name && <p className="tw:text-xs tw:font-medium tw:text-red-600 tw:dark:text-red-400">{fieldErrors.name}</p>}
            </label>

            <label className="tw:block tw:space-y-1.5">
              <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Mail className="tw:h-3.5 tw:w-3.5" /> Email Address</span>
              <Input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              {fieldErrors.email && <p className="tw:text-xs tw:font-medium tw:text-red-600 tw:dark:text-red-400">{fieldErrors.email}</p>}
            </label>

            {formData.role === 'student' && (
              <>
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><BookOpen className="tw:h-3.5 tw:w-3.5" /> Faculty</span>
                  <div className="tw:relative">
                    <BookOpen className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:h-4 tw:w-4 tw:-translate-y-1/2 tw:text-slate-400" />
                    <select
                      name="faculty"
                      value={formData.faculty}
                      onChange={handleChange}
                      required
                      className={selectClass}
                    >
                      <option value="">Select your faculty</option>
                      {faculties.map((faculty) => (
                        <option key={faculty._id} value={faculty._id}>
                          {faculty.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {fieldErrors.faculty && <p className="tw:text-xs tw:font-medium tw:text-red-600 tw:dark:text-red-400">{fieldErrors.faculty}</p>}
                </label>

                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Hash className="tw:h-3.5 tw:w-3.5" /> Matric Number</span>
                  <Input
                    type="text"
                    name="matricNumber"
                    value={formData.matricNumber}
                    onChange={handleChange}
                    placeholder="e.g., NOUN/CSC/23/123456"
                    minLength={6}
                    maxLength={24}
                    required
                  />
                  {fieldErrors.matricNumber && <p className="tw:text-xs tw:font-medium tw:text-red-600 tw:dark:text-red-400">{fieldErrors.matricNumber}</p>}
                </label>

                <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2">
                  <label className="tw:block tw:space-y-1.5">
                    <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><FileText className="tw:h-3.5 tw:w-3.5" /> Department</span>
                    <Input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      placeholder="e.g., Computer Science"
                      maxLength={80}
                      required
                    />
                    {fieldErrors.department && <p className="tw:text-xs tw:font-medium tw:text-red-600 tw:dark:text-red-400">{fieldErrors.department}</p>}
                  </label>
                  <label className="tw:block tw:space-y-1.5">
                    <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><MapPin className="tw:h-3.5 tw:w-3.5" /> Study Center</span>
                    <div className="tw:relative">
                      <MapPin className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:h-4 tw:w-4 tw:-translate-y-1/2 tw:text-slate-400" />
                      <select
                        name="studyCenter"
                        value={formData.studyCenter}
                        onChange={handleChange}
                        required
                        className={selectClass}
                      >
                        <option value="">Select your study center</option>
                        {NIGERIA_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </div>
                    {fieldErrors.studyCenter && <p className="tw:text-xs tw:font-medium tw:text-red-600 tw:dark:text-red-400">{fieldErrors.studyCenter}</p>}
                  </label>
                </div>
              </>
            )}

            <label className="tw:block tw:space-y-1.5">
              <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Lock className="tw:h-3.5 tw:w-3.5" /> Password</span>
              <div className="tw:relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleChange}
                  minLength="8"
                  required
                  className="tw:pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="tw:absolute tw:top-1/2 tw:right-3 tw:-translate-y-1/2 tw:text-slate-400 tw:hover:text-slate-600 tw:dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="tw:h-4 tw:w-4" /> : <Eye className="tw:h-4 tw:w-4" />}
                </button>
              </div>
              <p className="tw:text-xs tw:text-slate-400">{passwordHelper}</p>
              <div className="tw:grid tw:grid-cols-1 tw:gap-1 tw:sm:grid-cols-2">
                {passwordChecks.map((check) => (
                  <p
                    key={check.key}
                    className={cn(
                      'tw:flex tw:items-center tw:gap-1.5 tw:text-xs',
                      check.passed ? 'tw:text-emerald-600 tw:dark:text-emerald-400' : 'tw:text-slate-400',
                    )}
                  >
                    {check.passed ? <Check className="tw:h-3.5 tw:w-3.5 tw:flex-none" /> : <X className="tw:h-3.5 tw:w-3.5 tw:flex-none" />}
                    {check.label}
                  </p>
                ))}
              </div>
              {fieldErrors.password && <p className="tw:text-xs tw:font-medium tw:text-red-600 tw:dark:text-red-400">{fieldErrors.password}</p>}
            </label>

            <Button type="submit" disabled={loading} className="tw:w-full">
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </Card>

        <p className="tw:text-center tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">
          Already have an account? <Link to="/login" className="tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
