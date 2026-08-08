import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, CheckCircle2, BookOpen } from 'lucide-react';
import api from '../utils/api';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { syncUser } = useAuth();

  const [passwords, setPasswords] = useState({
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPasswords({ ...passwords, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    if (!token) {
      setMessage({ type: 'error', text: 'Invalid reset token' });
      setLoading(false);
      return;
    }

    if (passwords.password !== passwords.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      setLoading(false);
      return;
    }

    if (passwords.password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      setLoading(false);
      return;
    }

    try {
      const response = await api.post(`/auth/reset-password/${token}`, {
        password: passwords.password,
      });

      // Sync the returned user into AuthContext (not just localStorage) so
      // ProtectedRoute sees them as logged in immediately, the same way
      // Login.js/Signup.js do via useAuth().login()/signup().
      const { token: authToken, ...userData } = response.data.data;
      if (authToken) {
        localStorage.setItem('token', authToken);
        syncUser(userData);
      }

      setResetSuccess(true);
      setMessage({ type: 'success', text: 'Password reset successful!' });

      // Redirect to the student explore page after 2 seconds — matches where
      // Login.js/Signup.js send students post-auth (there is no /student-dashboard route).
      setTimeout(() => {
        navigate(userData.role === 'admin' ? '/admin/upload' : '/home');
      }, 2000);
    } catch (error) {
      console.error('Error:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to reset password. The link may have expired.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="np-shell tw:flex tw:min-h-[calc(100vh-64px)] tw:items-center tw:justify-center tw:bg-slate-50 tw:p-4 tw:dark:bg-slate-950">
      <SEO
        title="Reset Password - NounPaddi"
        description="Set a new password for your NounPaddi account."
        url="/reset-password"
        keywords="reset password, nounpaddi password reset"
        robots="noindex, nofollow"
      />

      <div className="tw:w-full tw:max-w-sm tw:space-y-5">
        {!resetSuccess && (
          <div className="tw:text-center">
            <span className="tw:mx-auto tw:flex tw:h-12 tw:w-12 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-brand-600 tw:text-white">
              <BookOpen className="tw:h-6 tw:w-6" />
            </span>
            <h1 className="tw:font-heading tw:mt-3 tw:text-xl tw:font-bold tw:tracking-tight">Reset Password</h1>
            <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Create a new password for your account</p>
          </div>
        )}

        <Card className="tw:space-y-4 tw:p-5">
          {message.text && (
            <div className={
              message.type === 'success'
                ? 'tw:rounded-xl tw:bg-emerald-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                : 'tw:rounded-xl tw:bg-red-100 tw:px-3.5 tw:py-2.5 tw:text-sm tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300'
            }
            >
              {message.text}
            </div>
          )}

          {resetSuccess ? (
            <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-4 tw:text-center">
              <span className="tw:flex tw:h-14 tw:w-14 tw:items-center tw:justify-center tw:rounded-full tw:bg-emerald-100 tw:text-emerald-600 tw:dark:bg-emerald-950 tw:dark:text-emerald-300">
                <CheckCircle2 className="tw:h-7 tw:w-7" />
              </span>
              <h2 className="tw:font-heading tw:text-base tw:font-bold">Password Reset Successful!</h2>
              <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Redirecting you to your dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="tw:space-y-4">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Lock className="tw:h-3.5 tw:w-3.5" /> New Password</span>
                <Input
                  type="password"
                  name="password"
                  value={passwords.password}
                  onChange={handleChange}
                  placeholder="Enter new password"
                  required
                  minLength="8"
                />
              </label>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Lock className="tw:h-3.5 tw:w-3.5" /> Confirm Password</span>
                <Input
                  type="password"
                  name="confirmPassword"
                  value={passwords.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm new password"
                  required
                  minLength="8"
                />
              </label>

              <Button type="submit" disabled={loading} className="tw:w-full">
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>

              <div className="tw:text-center">
                <Link to="/login" className="tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
