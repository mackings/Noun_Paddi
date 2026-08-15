import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import { trackFeatureVisit } from '../utils/featureTracking';
import {
  FileText,
  Grid3x3,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

const AdminMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [processingType, setProcessingType] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchMaterials();
    trackFeatureVisit('admin_materials');
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const response = await api.get('/materials');
      setMaterials(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching materials:', error);
      setLoading(false);
    }
  };

  const handleGenerateSummary = async (materialId) => {
    try {
      setProcessingId(materialId);
      setProcessingType('summary');
      setMessage({ type: '', text: '' });

      await api.post(`/materials/${materialId}/summarize`);

      setMessage({ type: 'success', text: 'Summary generated successfully!' });
      fetchMaterials(); // Refresh list

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to generate summary'
      });
    } finally {
      setProcessingId(null);
      setProcessingType(null);
    }
  };

  const handleGenerateQuestions = async (materialId) => {
    try {
      setProcessingId(materialId);
      setProcessingType('questions');
      setMessage({ type: '', text: '' });

      await api.post(`/materials/${materialId}/generate-questions`);

      setMessage({ type: 'success', text: 'Questions generated successfully!' });
      fetchMaterials(); // Refresh list

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to generate questions'
      });
    } finally {
      setProcessingId(null);
      setProcessingType(null);
    }
  };

  const handleDelete = async (materialId, materialTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${materialTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/materials/${materialId}`);
      setMessage({ type: 'success', text: 'Material deleted successfully!' });
      fetchMaterials();

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to delete material'
      });
    }
  };

  if (loading) {
    return (
      <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
        <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
        <p className="tw:text-sm">Loading materials...</p>
      </div>
    );
  }

  const totalMaterials = materials.length;
  const summaryCount = materials.filter((material) => material.hasSummary).length;
  const questionsCount = materials.filter((material) => material.questionsCount > 0).length;
  const completeCount = materials.filter(
    (material) => material.hasSummary && material.questionsCount > 0
  ).length;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredMaterials = materials.filter((material) => {
    const title = material.title || '';
    const courseCode = material.courseId?.courseCode || '';
    const courseName = material.courseId?.courseName || '';
    const matchesSearch = normalizedSearch.length === 0
      || `${title} ${courseCode} ${courseName}`.toLowerCase().includes(normalizedSearch);

    if (!matchesSearch) return false;

    if (statusFilter === 'needs-summary') {
      return !material.hasSummary;
    }
    if (statusFilter === 'needs-questions') {
      return material.hasSummary && material.questionsCount === 0;
    }
    if (statusFilter === 'complete') {
      return material.hasSummary && material.questionsCount > 0;
    }
    return true;
  });

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'needs-summary', label: 'Needs Summary' },
    { value: 'needs-questions', label: 'Needs Questions' },
    { value: 'complete', label: 'Complete' },
  ];

  const statCards = [
    { label: 'Total Materials', value: totalMaterials },
    { label: 'Summaries Ready', value: summaryCount },
    { label: 'Questions Ready', value: questionsCount },
    { label: 'Complete', value: completeCount },
  ];

  return (
    <div className="tw:space-y-5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
        <div>
          <h1 className="tw:font-heading tw:text-xl tw:font-bold tw:tracking-tight">Manage Materials</h1>
          <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Generate summaries and questions for uploaded materials.</p>
        </div>
        <Button variant="outline" onClick={fetchMaterials}>
          <RefreshCw className="tw:h-4 tw:w-4" /> Refresh
        </Button>
      </div>

      <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="tw:p-4">
            <span className="tw:block tw:text-xs tw:font-semibold tw:text-slate-500 tw:dark:text-slate-400">{stat.label}</span>
            <span className="tw:font-heading tw:text-xl tw:font-bold">{stat.value}</span>
          </Card>
        ))}
      </div>

      {message.text && (
        <div className={cn(
          'tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm',
          message.type === 'success'
            ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
            : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
        )}>
          {message.text}
        </div>
      )}

      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <div className="tw:relative tw:min-w-[220px] tw:flex-1">
          <FileText className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:h-4 tw:w-4 tw:-translate-y-1/2 tw:text-slate-400" />
          <input
            type="text"
            placeholder="Search by title or course..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="tw:h-10 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:pr-3 tw:pl-9 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100"
          />
        </div>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={cn(
                'tw:rounded-xl tw:border tw:px-3 tw:py-2 tw:text-xs tw:font-semibold tw:transition-colors',
                statusFilter === option.value
                  ? 'tw:border-brand-600 tw:bg-brand-600 tw:text-white'
                  : 'tw:border-slate-200 tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:text-sm">
        <div className="tw:text-slate-500 tw:dark:text-slate-400">
          Showing <strong className="tw:text-slate-900 tw:dark:text-slate-100">{filteredMaterials.length}</strong> of <strong className="tw:text-slate-900 tw:dark:text-slate-100">{materials.length}</strong>
        </div>
        <div className="tw:flex tw:flex-wrap tw:gap-2 tw:text-xs">
          <span className="tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300">
            {materials.filter((item) => !item.hasSummary).length} missing summary
          </span>
          <span className="tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300">
            {materials.filter((item) => item.hasSummary && item.questionsCount === 0).length} missing questions
          </span>
          <span className="tw:rounded-full tw:bg-emerald-100 tw:px-2.5 tw:py-1 tw:font-semibold tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300">
            {materials.filter((item) => item.hasSummary && item.questionsCount > 0).length} complete
          </span>
        </div>
      </div>

      {filteredMaterials.length === 0 ? (
        <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
          <FileText className="tw:h-10 tw:w-10 tw:text-slate-300" />
          <h3 className="tw:font-heading tw:text-sm tw:font-bold">No Materials Found</h3>
          <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">
            {materials.length === 0
              ? 'Upload materials to get started with system processing.'
              : 'Try adjusting your search or filters.'}
          </p>
        </Card>
      ) : (
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2 tw:xl:grid-cols-3">
          {filteredMaterials.map((material) => {
            const courseCode = material.courseId?.courseCode || 'N/A';
            const courseName = material.courseId?.courseName || 'Unknown course';
            const isProcessing = processingId === material._id;
            return (
              <Card key={material._id} className="tw:flex tw:flex-col tw:gap-4 tw:p-4">
                <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
                  <div className="tw:flex tw:items-start tw:gap-2.5">
                    <span className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                      <FileText className="tw:h-4.5 tw:w-4.5" />
                    </span>
                    <div>
                      <h3 className="tw:text-sm tw:font-bold">{material.title}</h3>
                      <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{courseCode} · {courseName}</p>
                    </div>
                  </div>
                  <span className="tw:flex tw:shrink-0 tw:items-center tw:gap-1 tw:text-[11px] tw:text-slate-400">
                    <Clock className="tw:h-3 tw:w-3" /> {formatDate(material.createdAt)}
                  </span>
                </div>

                <div className="tw:flex tw:flex-wrap tw:gap-2">
                  <span className={cn(
                    'tw:flex tw:items-center tw:gap-1 tw:rounded-full tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold',
                    material.hasSummary
                      ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                      : 'tw:bg-amber-100 tw:text-amber-700 tw:dark:bg-amber-500/15 tw:dark:text-amber-300',
                  )}>
                    {material.hasSummary ? <CheckCircle2 className="tw:h-3 tw:w-3" /> : <XCircle className="tw:h-3 tw:w-3" />}
                    Summary {material.hasSummary ? 'Generated' : 'Missing'}
                  </span>
                  <span className={cn(
                    'tw:flex tw:items-center tw:gap-1 tw:rounded-full tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold',
                    material.questionsCount > 0
                      ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                      : 'tw:bg-amber-100 tw:text-amber-700 tw:dark:bg-amber-500/15 tw:dark:text-amber-300',
                  )}>
                    {material.questionsCount > 0 ? <CheckCircle2 className="tw:h-3 tw:w-3" /> : <XCircle className="tw:h-3 tw:w-3" />}
                    {material.questionsCount > 0 ? `${material.questionsCount} Questions` : 'Questions Missing'}
                  </span>
                </div>

                <div className="tw:mt-auto tw:flex tw:flex-wrap tw:gap-2">
                  {!material.hasSummary && (
                    <Button
                      size="sm"
                      onClick={() => handleGenerateSummary(material._id)}
                      disabled={isProcessing && processingType === 'summary'}
                    >
                      {isProcessing && processingType === 'summary' ? (
                        <><Loader2 className="tw:h-3.5 tw:w-3.5 tw:animate-spin" /> Generating...</>
                      ) : (
                        <><FileText className="tw:h-3.5 tw:w-3.5" /> Summary</>
                      )}
                    </Button>
                  )}

                  {material.hasSummary && material.questionsCount === 0 && (
                    <Button
                      size="sm"
                      onClick={() => handleGenerateQuestions(material._id)}
                      disabled={isProcessing && processingType === 'questions'}
                    >
                      {isProcessing && processingType === 'questions' ? (
                        <><Loader2 className="tw:h-3.5 tw:w-3.5 tw:animate-spin" /> Generating...</>
                      ) : (
                        <><Grid3x3 className="tw:h-3.5 tw:w-3.5" /> Questions</>
                      )}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(material._id, material.title)}
                    disabled={isProcessing}
                  >
                    <Trash2 className="tw:h-3.5 tw:w-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminMaterials;
