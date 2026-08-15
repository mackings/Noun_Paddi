import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Database, RefreshCw, TrendingUp, XCircle, Loader2 } from 'lucide-react';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

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
      <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
        <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
        <p className="tw:text-sm">Loading API usage...</p>
      </div>
    );
  }

  const usageByType = apiUsage?.usageByType || [];
  const totals = featureStats?.totals || [];

  const statCards = [
    { icon: Activity, value: apiUsage?.overview?.totalAPICalls || 0, label: 'Total API Calls', tone: 'tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300' },
    { icon: Database, value: (apiUsage?.overview?.totalTokensUsed || 0).toLocaleString(), label: 'Total Tokens Used', tone: 'tw:bg-slate-100 tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300' },
    { icon: CheckCircle2, value: `${apiUsage?.overview?.successRate || 0}%`, label: 'Success Rate', tone: 'tw:bg-emerald-100 tw:text-emerald-600 tw:dark:bg-emerald-950 tw:dark:text-emerald-300' },
    { icon: XCircle, value: `${apiUsage?.overview?.successfulCalls || 0} / ${apiUsage?.overview?.failedCalls || 0}`, label: 'Success / Failed', tone: 'tw:bg-red-100 tw:text-red-600 tw:dark:bg-red-500/15 tw:dark:text-red-300' },
  ];

  return (
    <div className="tw:space-y-5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Insights</p>
          <h1 className="tw:font-heading tw:text-xl tw:font-bold tw:tracking-tight">API Usage</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Track token consumption, request health, and how students use platform features.</p>
        </div>
        <Button variant="outline" onClick={fetchUsage}>
          <RefreshCw className="tw:h-4 tw:w-4" /> Refresh
        </Button>
      </div>

      <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:lg:grid-cols-4">
        {statCards.map(({ icon: Icon, value, label, tone }) => (
          <Card key={label} className="tw:space-y-2 tw:p-4">
            <span className={`tw:flex tw:h-9 tw:w-9 tw:items-center tw:justify-center tw:rounded-xl ${tone}`}>
              <Icon className="tw:h-4.5 tw:w-4.5" />
            </span>
            <h3 className="tw:font-heading tw:text-xl tw:font-bold">{value}</h3>
            <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{label}</p>
          </Card>
        ))}
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-2">
        <Card className="tw:p-5">
          <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold"><Activity className="tw:h-4 tw:w-4 tw:text-brand-600" /> Usage by Operation</h2>
          <div className="tw:mt-3 tw:space-y-2">
            {usageByType.length > 0 ? (
              usageByType.map((type) => (
                <div key={type._id} className="tw:flex tw:items-center tw:justify-between tw:rounded-xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                  <div>
                    <h4 className="tw:text-sm tw:font-semibold">{type._id === 'summarize' ? 'Summarization' : 'Question Generation'}</h4>
                    <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{type.totalTokens?.toLocaleString()} tokens · {type.successCount} successful</p>
                  </div>
                  <span className="tw:text-sm tw:font-bold">{type.count} calls</span>
                </div>
              ))
            ) : (
              <p className="tw:py-4 tw:text-center tw:text-sm tw:text-slate-400">No API operations recorded yet.</p>
            )}
          </div>
        </Card>

        <Card className="tw:p-5">
          <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold"><TrendingUp className="tw:h-4 tw:w-4 tw:text-brand-600" /> Most Visited Features</h2>
          <div className="tw:mt-3 tw:space-y-2">
            {totals.length > 0 ? (
              totals.slice(0, 10).map((item) => (
                <div key={item._id} className="tw:flex tw:items-center tw:justify-between tw:rounded-xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                  <div>
                    <h4 className="tw:text-sm tw:font-semibold">{item._id}</h4>
                    <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Feature visits</p>
                  </div>
                  <span className="tw:text-sm tw:font-bold">{item.total}</span>
                </div>
              ))
            ) : (
              <p className="tw:py-4 tw:text-center tw:text-sm tw:text-slate-400">No feature analytics data available.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminApiUsage;
