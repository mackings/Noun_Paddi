import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, BookOpen } from 'lucide-react';
import api from '../utils/api';
import SEO from '../components/SEO';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await api.post('/auth/forgot-password', { email });
      setEmailSent(true);
      setMessage({
        type: 'success',
        text: 'Password reset email sent! Please check your inbox.',
      });
    } catch (error) {
      console.error('Error:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to send reset email. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="np-shell tw:flex tw:min-h-[calc(100vh-64px)] tw:items-center tw:justify-center tw:bg-slate-50 tw:p-4 tw:dark:bg-slate-950">
      <SEO
        title="Forgot Password - NounPaddi"
        description="Reset your NounPaddi account password."
        url="/forgot-password"
        keywords="forgot password, password reset, nounpaddi account"
        robots="noindex, nofollow"
      />

      <div className="tw:w-full tw:max-w-sm tw:space-y-5">
        {!emailSent && (
          <div className="tw:text-center">
            <span className="tw:mx-auto tw:flex tw:h-12 tw:w-12 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-brand-600 tw:text-white">
              <BookOpen className="tw:h-6 tw:w-6" />
            </span>
            <h1 className="tw:font-heading tw:mt-3 tw:text-xl tw:font-bold tw:tracking-tight">Forgot Password?</h1>
            <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Enter your email and we'll send you a reset link</p>
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

          {emailSent ? (
            <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-4 tw:text-center">
              <span className="tw:flex tw:h-14 tw:w-14 tw:items-center tw:justify-center tw:rounded-full tw:bg-emerald-100 tw:text-emerald-600 tw:dark:bg-emerald-950 tw:dark:text-emerald-300">
                <CheckCircle2 className="tw:h-7 tw:w-7" />
              </span>
              <h2 className="tw:font-heading tw:text-base tw:font-bold">Check Your Email</h2>
              <p className="tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">We've sent a password reset link to <strong>{email}</strong></p>
              <p className="tw:text-xs tw:text-slate-400">The link will expire in 1 hour.</p>
              <Link to="/login" className="tw:mt-2 tw:flex tw:items-center tw:gap-1.5 tw:text-sm tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
                <ArrowLeft className="tw:h-4 tw:w-4" />
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="tw:space-y-4">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Mail className="tw:h-3.5 tw:w-3.5" /> Email Address</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </label>

              <Button type="submit" disabled={loading} className="tw:w-full">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <div className="tw:text-center">
                <Link to="/login" className="tw:flex tw:items-center tw:justify-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
                  <ArrowLeft className="tw:h-3.5 tw:w-3.5" />
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

export default ForgotPassword;
