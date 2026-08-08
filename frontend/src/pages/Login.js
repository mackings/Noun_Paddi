import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';
import { Mail, Lock, BookOpen, Eye, EyeOff } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
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
    setLoading(true);

    try {
      const response = await login(formData.email, formData.password);
      const redirect = getSafeRedirect();
      if (redirect) {
        navigate(redirect);
        return;
      }
      const userRole = response.data.role;
      navigate(userRole === 'admin' ? '/admin/upload' : '/home');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="np-shell tw:flex tw:min-h-[calc(100vh-64px)] tw:items-center tw:justify-center tw:bg-slate-50 tw:p-4 tw:dark:bg-slate-950">
      <SEO
        title="Login - NounPaddi"
        description="Sign in to NounPaddi to access course materials, practice exams, and IT placement opportunities for NOUN students."
        url="/login"
        keywords="login, sign in, NOUN student portal, NounPaddi login"
        robots="noindex, nofollow"
      />

      <div className="tw:w-full tw:max-w-sm tw:space-y-5">
        <div className="tw:text-center">
          <span className="tw:mx-auto tw:flex tw:h-12 tw:w-12 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-brand-600 tw:text-white">
            <BookOpen className="tw:h-6 tw:w-6" />
          </span>
          <h1 className="tw:font-heading tw:mt-3 tw:text-xl tw:font-bold tw:tracking-tight">Welcome Back!</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Sign in to continue your learning journey with NounPaddi</p>
        </div>

        <Card className="tw:space-y-4 tw:p-5">
          {error && (
            <div className="tw:rounded-xl tw:bg-red-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="tw:space-y-4">
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
            </label>

            <label className="tw:block tw:space-y-1.5">
              <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Lock className="tw:h-3.5 tw:w-3.5" /> Password</span>
              <div className="tw:relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
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
            </label>

            <div className="tw:text-right">
              <Link to="/forgot-password" className="tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
                Forgot Password?
              </Link>
            </div>

            <Button type="submit" disabled={loading} className="tw:w-full">
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </Card>

        <p className="tw:text-center tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">
          Don't have an account? <Link to="/signup" className="tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">Sign Up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
