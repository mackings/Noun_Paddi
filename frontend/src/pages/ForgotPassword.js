import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import api from '../utils/api';
import SEO from '../components/SEO';
import './Auth.css';

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
    <div className="auth-container">
      <SEO
        title="Forgot Password - NounPaddi"
        description="Reset your NounPaddi account password."
        url="/forgot-password"
        keywords="forgot password, password reset, nounpaddi account"
        robots="noindex, nofollow"
      />
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Forgot Password?</h1>
            <p>Enter your email and we'll send you a reset link</p>
          </div>

          {message.text && (
            <div className={`message-banner ${message.type}`}>
              {message.text}
            </div>
          )}

          {emailSent ? (
            <div className="success-state">
              <div className="success-icon">
                <FiCheckCircle size={60} />
              </div>
              <h2>Check Your Email</h2>
              <p>We've sent a password reset link to <strong>{email}</strong></p>
              <p>The link will expire in 1 hour.</p>
              <Link to="/login" className="back-to-login">
                <FiArrowLeft size={18} />
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">
                  <FiMail size={18} />
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <div className="auth-footer">
                <Link to="/login" className="auth-link">
                  <FiArrowLeft size={16} />
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

export default ForgotPassword;
