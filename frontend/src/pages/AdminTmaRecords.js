import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import { ChevronDown, ChevronRight, Pencil, PlusCircle, Search, Trash2, X, Loader2 } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const tmaNumbers = [
  { value: 'tma_1', label: 'TMA 1' },
  { value: 'tma_2', label: 'TMA 2' },
  { value: 'tma_3', label: 'TMA 3' },
];

const tmaNumberLabels = tmaNumbers.reduce((labels, item) => {
  labels[item.value] = item.label;
  return labels;
}, {});

const emptyForm = { studentName: '', matricNumber: '', course: '', tmaNumber: 'tma_1', score: '' };

const selectClass = 'tw:h-10 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';
const cellInputClass = 'tw:h-8 tw:w-full tw:min-w-[100px] tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:px-2 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';
const iconBtnClass = 'tw:flex tw:h-8 tw:w-8 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-slate-200 tw:text-slate-500 tw:dark:border-slate-800 tw:dark:text-slate-400';

const AdminTmaRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState(emptyForm);
  const [lastSaved, setLastSaved] = useState(null);
  const [filters, setFilters] = useState({ course: '', tmaNumber: '', search: '' });
  const [courseFilterInput, setCourseFilterInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ studentName: '', matricNumber: '', course: '', score: '' });
  const [expandedStudents, setExpandedStudents] = useState(() => new Set());

  const fetchRecords = async (activeFilters) => {
    try {
      setLoading(true);
      const params = {};
      if (activeFilters.course) params.course = activeFilters.course;
      if (activeFilters.tmaNumber) params.tmaNumber = activeFilters.tmaNumber;
      if (activeFilters.search) params.search = activeFilters.search;

      const response = await api.get('/tma/records', { params });
      setRecords(response.data.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load TMA records.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.course, filters.tmaNumber, filters.search]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchInput.trim() }));
    }, 350);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters((current) => ({ ...current, course: courseFilterInput.trim() }));
    }, 350);
    return () => clearTimeout(timeoutId);
  }, [courseFilterInput]);

  const stats = useMemo(() => {
    const students = new Set(records.map((item) => item.matricNumber));
    const uniqueCourses = new Set(records.map((item) => item.course).filter(Boolean));
    return { total: records.length, students: students.size, courses: uniqueCourses.size };
  }, [records]);

  const groupedRecords = useMemo(() => {
    const groups = new Map();
    records.forEach((record) => {
      const key = record.matricNumber;
      if (!groups.has(key)) {
        groups.set(key, { matricNumber: record.matricNumber, studentName: record.studentName, items: [] });
      }
      groups.get(key).items.push(record);
    });
    return Array.from(groups.values());
  }, [records]);

  const onFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleExpand = (matricNumber) => {
    setExpandedStudents((current) => {
      const next = new Set(current);
      if (next.has(matricNumber)) next.delete(matricNumber);
      else next.add(matricNumber);
      return next;
    });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.studentName.trim() || !form.matricNumber.trim() || !form.course.trim() || !form.tmaNumber) {
      setMessage({ type: 'error', text: 'Fill in student name, matric number, course, and TMA before saving.' });
      return;
    }
    const numericScore = Number(form.score);
    if (!Number.isFinite(numericScore) || numericScore < 0) {
      setMessage({ type: 'error', text: 'Enter a valid score.' });
      return;
    }

    const payload = {
      studentName: form.studentName.trim(),
      matricNumber: form.matricNumber.trim(),
      course: form.course.trim(),
      tmaNumber: form.tmaNumber,
      score: numericScore,
    };

    try {
      setSubmitting(true);
      setMessage({ type: '', text: '' });
      await api.post('/tma/records', payload);
      setMessage({ type: 'success', text: 'TMA record saved.' });
      setLastSaved(payload);
      setForm((current) => ({ ...emptyForm, studentName: current.studentName, matricNumber: current.matricNumber, tmaNumber: current.tmaNumber }));
      await fetchRecords(filters);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save TMA record.' });
    } finally {
      setSubmitting(false);
    }
  };

  const quickAddTma = (tmaNumber) => {
    if (!lastSaved) return;
    setForm({
      studentName: lastSaved.studentName,
      matricNumber: lastSaved.matricNumber,
      course: lastSaved.course,
      tmaNumber,
      score: '',
    });
    setLastSaved(null);
    setMessage({ type: '', text: '' });
  };

  const startEdit = (record) => {
    setEditingId(record._id);
    setEditForm({
      studentName: record.studentName,
      matricNumber: record.matricNumber,
      course: record.course,
      score: String(record.score),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ studentName: '', matricNumber: '', course: '', score: '' });
  };

  const saveEdit = async (recordId) => {
    const numericScore = Number(editForm.score);
    if (
      !editForm.studentName.trim() ||
      !editForm.matricNumber.trim() ||
      !editForm.course.trim() ||
      !Number.isFinite(numericScore) ||
      numericScore < 0
    ) {
      setMessage({ type: 'error', text: 'Enter valid values before saving.' });
      return;
    }

    try {
      await api.patch(`/tma/records/${recordId}`, {
        studentName: editForm.studentName.trim(),
        matricNumber: editForm.matricNumber.trim(),
        course: editForm.course.trim(),
        score: numericScore,
      });
      setMessage({ type: 'success', text: 'Record updated.' });
      cancelEdit();
      await fetchRecords(filters);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update record.' });
    }
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Delete the ${tmaNumberLabels[record.tmaNumber]} record for ${record.studentName} (${record.course})?`)) return;
    try {
      await api.delete(`/tma/records/${record._id}`);
      setMessage({ type: 'success', text: 'Record deleted.' });
      await fetchRecords(filters);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete record.' });
    }
  };

  const renderRow = (record, { isHeader = false, group = null } = {}) => {
    const isEditing = editingId === record._id;
    const moreCount = isHeader ? group.items.length - 1 : 0;
    const isExpanded = isHeader && expandedStudents.has(group.matricNumber);

    return (
      <tr key={record._id} className={cn('tw:border-b tw:border-slate-100 tw:dark:border-slate-800', !isHeader && 'tw:bg-slate-50/60 tw:dark:bg-slate-900/40')}>
        <td className="tw:p-2.5">
          <div className="tw:flex tw:items-center tw:gap-2">
            {isHeader && moreCount > 0 ? (
              <button
                type="button"
                onClick={() => toggleExpand(group.matricNumber)}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                className="tw:flex tw:h-5 tw:w-5 tw:shrink-0 tw:items-center tw:justify-center tw:text-slate-400"
              >
                {isExpanded ? <ChevronDown className="tw:h-4 tw:w-4" /> : <ChevronRight className="tw:h-4 tw:w-4" />}
              </button>
            ) : isHeader ? (
              <span className="tw:w-5 tw:shrink-0" />
            ) : (
              <span className="tw:w-5 tw:shrink-0" />
            )}
            {isEditing ? (
              <input
                type="text"
                value={editForm.studentName}
                onChange={(event) => setEditForm((current) => ({ ...current, studentName: event.target.value }))}
                className={cellInputClass}
              />
            ) : (
              <span className="tw:text-sm tw:font-semibold">{record.studentName}</span>
            )}
          </div>
        </td>
        <td className="tw:p-2.5 tw:text-sm">
          {isEditing ? (
            <input
              type="text"
              value={editForm.matricNumber}
              onChange={(event) => setEditForm((current) => ({ ...current, matricNumber: event.target.value }))}
              className={cellInputClass}
            />
          ) : record.matricNumber}
        </td>
        <td className="tw:p-2.5 tw:text-sm">
          {isEditing ? (
            <input
              type="text"
              value={editForm.course}
              onChange={(event) => setEditForm((current) => ({ ...current, course: event.target.value }))}
              className={cellInputClass}
            />
          ) : (
            <span className="tw:flex tw:items-center tw:gap-1.5">
              {record.course}
              {isHeader && moreCount > 0 && (
                <span className="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-semibold tw:text-slate-500 tw:dark:bg-slate-800 tw:dark:text-slate-400">+{moreCount} more</span>
              )}
            </span>
          )}
        </td>
        <td className="tw:p-2.5">
          <span className="tw:inline-block tw:rounded-full tw:bg-brand-100 tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:whitespace-nowrap tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300">{tmaNumberLabels[record.tmaNumber] || record.tmaNumber}</span>
        </td>
        <td className="tw:p-2.5 tw:text-sm tw:font-semibold">
          {isEditing ? (
            <input
              type="number"
              min="0"
              step="0.5"
              value={editForm.score}
              onChange={(event) => setEditForm((current) => ({ ...current, score: event.target.value }))}
              className={cn(cellInputClass, 'tw:w-20')}
            />
          ) : record.score}
        </td>
        <td className="tw:p-2.5 tw:text-xs tw:text-slate-400">{formatDate(record.createdAt)}</td>
        <td className="tw:p-2.5">
          <div className="tw:flex tw:items-center tw:gap-1.5">
            {isEditing ? (
              <>
                <button type="button" aria-label="Save" onClick={() => saveEdit(record._id)} className={iconBtnClass}>
                  <PlusCircle className="tw:h-3.5 tw:w-3.5" />
                </button>
                <button type="button" aria-label="Cancel" onClick={cancelEdit} className={iconBtnClass}>
                  <X className="tw:h-3.5 tw:w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button type="button" aria-label={`Edit ${record.studentName}`} onClick={() => startEdit(record)} className={iconBtnClass}>
                  <Pencil className="tw:h-3.5 tw:w-3.5" />
                </button>
                <button type="button" aria-label={`Delete ${record.studentName}`} onClick={() => handleDelete(record)} className={cn(iconBtnClass, 'tw:border-red-200 tw:text-red-600 tw:dark:border-red-500/30 tw:dark:text-red-400')}>
                  <Trash2 className="tw:h-3.5 tw:w-3.5" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="tw:space-y-4">
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

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-[1fr_1.6fr]">
        <Card className="tw:p-5">
          <div className="tw:flex tw:items-start tw:gap-3">
            <span className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><PlusCircle className="tw:h-4.5 tw:w-4.5" /></span>
            <div>
              <h2 className="tw:font-heading tw:text-sm tw:font-bold">Add Record</h2>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Log a student's TMA score for a course.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="tw:mt-4 tw:space-y-3">
            <label className="tw:block tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Student Name</span>
              <Input
                type="text"
                value={form.studentName}
                onChange={(event) => onFormChange('studentName', event.target.value)}
                placeholder="e.g. Jane Doe"
              />
            </label>

            <label className="tw:block tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Matric Number</span>
              <Input
                type="text"
                value={form.matricNumber}
                onChange={(event) => onFormChange('matricNumber', event.target.value)}
                placeholder="e.g. NOU123456789"
              />
            </label>

            <label className="tw:block tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Course</span>
              <Input
                type="text"
                value={form.course}
                onChange={(event) => onFormChange('course', event.target.value)}
                placeholder="e.g. CIT 102"
              />
            </label>

            <div className="tw:grid tw:grid-cols-2 tw:gap-3">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">TMA</span>
                <select
                  aria-label="TMA number"
                  value={form.tmaNumber}
                  onChange={(event) => onFormChange('tmaNumber', event.target.value)}
                  className={selectClass}
                >
                  {tmaNumbers.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Score</span>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.score}
                  onChange={(event) => onFormChange('score', event.target.value)}
                  placeholder="e.g. 24"
                />
              </label>
            </div>

            <Button type="submit" disabled={submitting} className="tw:w-full">
              {submitting ? <><Loader2 className="tw:h-4 tw:w-4 tw:animate-spin" /> Saving...</> : <><PlusCircle className="tw:h-4 tw:w-4" /> Save Record</>}
            </Button>
          </form>

          {lastSaved && (
            <div className="tw:mt-4 tw:space-y-2 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:dark:bg-slate-900">
              <p className="tw:flex tw:items-center tw:justify-between tw:text-sm">
                <span>Add another round for <strong>{lastSaved.studentName}</strong> — {lastSaved.course}?</span>
                <button type="button" aria-label="Dismiss" onClick={() => setLastSaved(null)} className="tw:text-slate-400"><X className="tw:h-4 tw:w-4" /></button>
              </p>
              <div className="tw:flex tw:flex-wrap tw:gap-2">
                {tmaNumbers.filter((item) => item.value !== lastSaved.tmaNumber).map((item) => (
                  <Button key={item.value} type="button" size="sm" variant="outline" onClick={() => quickAddTma(item.value)}>
                    <PlusCircle className="tw:h-3.5 tw:w-3.5" /> Add {item.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="tw:p-5">
          <div className="tw:flex tw:items-start tw:gap-3">
            <span className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><Search className="tw:h-4.5 tw:w-4.5" /></span>
            <div>
              <h2 className="tw:font-heading tw:text-sm tw:font-bold">Records</h2>
              <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{stats.total} record{stats.total === 1 ? '' : 's'} · {stats.students} student{stats.students === 1 ? '' : 's'} · {stats.courses} course{stats.courses === 1 ? '' : 's'}.</p>
            </div>
          </div>

          <div className="tw:mt-4 tw:flex tw:flex-wrap tw:gap-2">
            <div className="tw:relative tw:min-w-[200px] tw:flex-1">
              <Search className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:h-4 tw:w-4 tw:-translate-y-1/2 tw:text-slate-400" />
              <Input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or matric number"
                className="tw:pl-9"
              />
            </div>
            <Input
              type="text"
              value={courseFilterInput}
              onChange={(event) => setCourseFilterInput(event.target.value)}
              placeholder="Filter by course"
              aria-label="Filter by course"
              className="tw:w-40"
            />
            <select
              aria-label="Filter by TMA"
              value={filters.tmaNumber}
              onChange={(event) => setFilters((current) => ({ ...current, tmaNumber: event.target.value }))}
              className={cn(selectClass, 'tw:w-36')}
            >
              <option value="">All TMAs</option>
              {tmaNumbers.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-10 tw:text-slate-500 tw:dark:text-slate-400">
              <Loader2 className="tw:h-5 tw:w-5 tw:animate-spin" />
              <p className="tw:text-sm">Loading records...</p>
            </div>
          ) : groupedRecords.length === 0 ? (
            <p className="tw:py-10 tw:text-center tw:text-sm tw:text-slate-400">No TMA records found.</p>
          ) : (
            <div className="tw:mt-4 tw:overflow-x-auto">
              <table className="tw:w-full tw:border-collapse">
                <thead>
                  <tr className="tw:border-b tw:border-slate-200 tw:text-left tw:text-xs tw:font-bold tw:tracking-wide tw:text-slate-400 tw:uppercase tw:dark:border-slate-800">
                    <th className="tw:p-2.5">Student</th>
                    <th className="tw:p-2.5">Matric No.</th>
                    <th className="tw:p-2.5">Course</th>
                    <th className="tw:p-2.5">TMA</th>
                    <th className="tw:p-2.5">Score</th>
                    <th className="tw:p-2.5">Date</th>
                    <th className="tw:p-2.5" aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRecords.map((group) => {
                    const [first, ...rest] = group.items;
                    const isExpanded = expandedStudents.has(group.matricNumber);
                    return (
                      <React.Fragment key={group.matricNumber}>
                        {renderRow(first, { isHeader: true, group })}
                        {isExpanded && rest.map((record) => renderRow(record))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminTmaRecords;
