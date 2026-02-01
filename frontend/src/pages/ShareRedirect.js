import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';

const ShareRedirect = () => {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState({ state: 'loading', message: 'Preparing your PDF...' });

  useEffect(() => {
    if (loading) return;

    if (!user) {
      const redirectTo = encodeURIComponent(location.pathname);
      navigate(`/signup?redirect=${redirectTo}`, { replace: true });
      return;
    }

    const resolveShare = async () => {
      try {
        const response = await api.get(`/share/${token}`);
        const courseId = response.data?.data?.courseId;
        const materialId = response.data?.data?.materialId;
        if (!courseId || !materialId) {
          setStatus({ state: 'error', message: 'Unable to open this shared summary.' });
          return;
        }
        navigate(`/course/${courseId}?materialId=${encodeURIComponent(materialId)}`, { replace: true });
      } catch (error) {
        setStatus({
          state: 'error',
          message: error.response?.data?.message || 'This share link is invalid or expired.',
        });
      }
    };

    resolveShare();
  }, [loading, user, token, location.pathname, navigate]);

  return (
    <div className="auth-container">
      <SEO
        title="Opening Shared Summary - NounPaddi"
        description="Opening a shared course summary on NounPaddi."
        url={`/share/${token}`}
        keywords="share, pdf, nounpaddi"
      />
      <div className="auth-card">
        <h1 className="auth-title">Shared PDF</h1>
        <p className="auth-subtitle">{status.message}</p>
        {status.state === 'error' && (
          <p className="auth-footer">
            <Link to="/explore">Return to Explore</Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ShareRedirect;
