import React, { useEffect, useState } from 'react';
import { FiActivity, FiCheckCircle, FiDatabase, FiRefreshCw, FiTrendingUp, FiXCircle } from 'react-icons/fi';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import './AdminApiUsage.css';

const AdminApiUsage = () => {
  const [apiUsage, setApiUsage] = useState(null);
  const [featureStats, setFeatureStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      const [apiResponse, featureResponse] = await Promise.all([
        api.get('/stats/api-usage'),
        api.get('/analytics/feature-stats'),
      ]);
      setApiUsage(apiResponse.data.data);
      setFeatureStats(featureResponse.data.data);
    } catch (error) {
      console.error('Error fetching API usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    trackFeatureVisit('admin_api_usage');
  }, []);

  if (loading) {
    return (
      <div className="admin-api-page">
        <div className="api-skeleton-hero">
          <div className="api-skeleton-line short"></div>
          <div className="api-skeleton-line title"></div>
          <div className="api-skeleton-line wide"></div>
        </div>
        <div className="api-skeleton-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="api-skeleton-card">
              <div className="api-skeleton-icon"></div>
              <div className="api-skeleton-line"></div>
              <div className="api-skeleton-line short"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const usageByType = apiUsage?.usageByType || [];
  const totals = featureStats?.totals || [];

  return (
    <div className="admin-api-page">
      <section className="api-hero">
        <div>
          <p className="api-kicker">Insights</p>
          <h1>API Usage</h1>
          <p>Track token consumption, request health, and how students use platform features.</p>
        </div>
        <button onClick={fetchUsage} className="btn btn-outline-primary">
          <FiRefreshCw /> Refresh
        </button>
      </section>

      <section className="api-stat-grid">
        <article className="api-stat-card">
          <span className="api-stat-icon"><FiActivity /></span>
          <h3>{apiUsage?.overview?.totalAPICalls || 0}</h3>
          <p>Total API Calls</p>
        </article>
        <article className="api-stat-card">
          <span className="api-stat-icon"><FiDatabase /></span>
          <h3>{apiUsage?.overview?.totalTokensUsed?.toLocaleString() || 0}</h3>
          <p>Total Tokens Used</p>
        </article>
        <article className="api-stat-card">
          <span className="api-stat-icon success"><FiCheckCircle /></span>
          <h3>{apiUsage?.overview?.successRate || 0}%</h3>
          <p>Success Rate</p>
        </article>
        <article className="api-stat-card">
          <span className="api-stat-icon danger"><FiXCircle /></span>
          <h3>{apiUsage?.overview?.successfulCalls || 0} / {apiUsage?.overview?.failedCalls || 0}</h3>
          <p>Success / Failed</p>
        </article>
      </section>

      <section className="api-panels">
        <article className="api-panel">
          <h2><FiActivity /> Usage by Operation</h2>
          <div className="api-op-list">
            {usageByType.length > 0 ? (
              usageByType.map((type) => (
                <div key={type._id} className="api-op-row">
                  <div>
                    <h4>{type._id === 'summarize' ? 'Summarization' : 'Question Generation'}</h4>
                    <p>{type.totalTokens?.toLocaleString()} tokens · {type.successCount} successful</p>
                  </div>
                  <span>{type.count} calls</span>
                </div>
              ))
            ) : (
              <p className="empty-message">No API operations recorded yet.</p>
            )}
          </div>
        </article>

        <article className="api-panel">
          <h2><FiTrendingUp /> Most Visited Features</h2>
          <div className="api-op-list">
            {totals.length > 0 ? (
              totals.slice(0, 10).map((item) => (
                <div key={item._id} className="api-op-row">
                  <div>
                    <h4>{item._id}</h4>
                    <p>Feature visits</p>
                  </div>
                  <span>{item.total}</span>
                </div>
              ))
            ) : (
              <p className="empty-message">No feature analytics data available.</p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
};

export default AdminApiUsage;
