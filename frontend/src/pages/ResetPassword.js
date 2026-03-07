import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { FiLock, FiCheckCircle } from 'react-icons/fi';
import api from '../utils/api';
import SEO from '../components/SEO';
import './Auth.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

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

    if (passwords.password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      setLoading(false);
      return;
    }

    try {
      const response = await api.post(`/auth/reset-password/${token}`, {
        password: passwords.password,
      });

      // Store the new token
      if (response.data.data.token) {
        localStorage.setItem('token', response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data));
      }

      setResetSuccess(true);
      setMessage({ type: 'success', text: 'Password reset successful!' });

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/student-dashboard');
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
    <div className="auth-container">
      <SEO
        title="Reset Password - NounPaddi"
        description="Set a new password for your NounPaddi account."
        url="/reset-password"
        keywords="reset password, nounpaddi password reset"
        robots="noindex, nofollow"
      />
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Reset Password</h1>
            <p>Create a new password for your account</p>
          </div>

          {message.text && (
            <div className={`message-banner ${message.type}`}>
              {message.text}
            </div>
          )}

          {resetSuccess ? (
            <div className="success-state">
              <div className="success-icon">
                <FiCheckCircle size={60} />
              </div>
              <h2>Password Reset Successful!</h2>
              <p>Redirecting you to your dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="password">
                  <FiLock size={18} />
                  New Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={passwords.password}
                  onChange={handleChange}
                  placeholder="Enter new password"
                  required
                  minLength="6"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">
                  <FiLock size={18} />
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwords.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm new password"
                  required
                  minLength="6"
                />
              </div>

              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>

              <div className="auth-footer">
                <Link to="/login" className="auth-link">
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
