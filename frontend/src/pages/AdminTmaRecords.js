import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/dateHelper';
import { FiChevronDown, FiChevronRight, FiEdit2, FiPlusCircle, FiSearch, FiTrash2, FiX } from 'react-icons/fi';

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
      <tr key={record._id} className={isHeader ? 'tma-student-row' : 'tma-record-subrow'}>
        <td data-label="Student">
          <div className="tma-student-cell">
            {isHeader && moreCount > 0 ? (
              <button
                type="button"
                className="tma-expand-toggle"
                onClick={() => toggleExpand(group.matricNumber)}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
              </button>
            ) : isHeader ? (
              <span className="tma-expand-toggle placeholder" />
            ) : null}
            {isEditing ? (
              <input
                type="text"
                value={editForm.studentName}
                onChange={(event) => setEditForm((current) => ({ ...current, studentName: event.target.value }))}
              />
            ) : (
              <span>{record.studentName}</span>
            )}
          </div>
        </td>
        <td data-label="Matric No.">
          {isEditing ? (
            <input
              type="text"
              value={editForm.matricNumber}
              onChange={(event) => setEditForm((current) => ({ ...current, matricNumber: event.target.value }))}
            />
          ) : record.matricNumber}
        </td>
        <td data-label="Course">
          {isEditing ? (
            <input
              type="text"
              value={editForm.course}
              onChange={(event) => setEditForm((current) => ({ ...current, course: event.target.value }))}
            />
          ) : (
            <>
              {record.course}
              {isHeader && moreCount > 0 && (
                <span className="tma-more-badge">+{moreCount} more</span>
              )}
            </>
          )}
        </td>
        <td data-label="TMA">
          <span className="tma-records-chip">{tmaNumberLabels[record.tmaNumber] || record.tmaNumber}</span>
        </td>
        <td data-label="Score">
          {isEditing ? (
            <input
              type="number"
              min="0"
              step="0.5"
              value={editForm.score}
              onChange={(event) => setEditForm((current) => ({ ...current, score: event.target.value }))}
            />
          ) : record.score}
        </td>
        <td data-label="Date">{formatDate(record.createdAt)}</td>
        <td data-label="Actions">
          <div className="tma-records-actions">
            {isEditing ? (
              <>
                <button type="button" aria-label="Save" onClick={() => saveEdit(record._id)}>
                  <FiPlusCircle />
                </button>
                <button type="button" aria-label="Cancel" onClick={cancelEdit}>
                  <FiX />
                </button>
              </>
            ) : (
              <>
                <button type="button" aria-label={`Edit ${record.studentName}`} onClick={() => startEdit(record)}>
                  <FiEdit2 />
                </button>
                <button type="button" aria-label={`Delete ${record.studentName}`} onClick={() => handleDelete(record)} className="danger">
                  <FiTrash2 />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="tma-records">
      {message.text && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      <div className="tma-records-layout">
        <section className="tma-panel">
          <div className="tma-panel-head compact">
            <FiPlusCircle />
            <div>
              <h2>Add Record</h2>
              <p>Log a student's TMA score for a course.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="tma-form">
            <label>
              <span>Student Name</span>
              <input
                type="text"
                value={form.studentName}
                onChange={(event) => onFormChange('studentName', event.target.value)}
                placeholder="e.g. Jane Doe"
              />
            </label>

            <label>
              <span>Matric Number</span>
              <input
                type="text"
                value={form.matricNumber}
                onChange={(event) => onFormChange('matricNumber', event.target.value)}
                placeholder="e.g. NOU123456789"
              />
            </label>

            <label>
              <span>Course</span>
              <input
                type="text"
                value={form.course}
                onChange={(event) => onFormChange('course', event.target.value)}
                placeholder="e.g. CIT 102"
              />
            </label>

            <div className="tma-two-col">
              <label>
                <span>TMA</span>
                <select
                  aria-label="TMA number"
                  value={form.tmaNumber}
                  onChange={(event) => onFormChange('tmaNumber', event.target.value)}
                >
                  {tmaNumbers.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Score</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.score}
                  onChange={(event) => onFormChange('score', event.target.value)}
                  placeholder="e.g. 24"
                />
              </label>
            </div>

            <button type="submit" className="btn btn-primary tma-primary-action" disabled={submitting}>
              {submitting ? <><div className="spinner-small"></div> Saving...</> : <><FiPlusCircle /> Save Record</>}
            </button>
          </form>

          {lastSaved && (
            <div className="tma-quick-add">
              <p>Add another round for <strong>{lastSaved.studentName}</strong> — {lastSaved.course}?</p>
              <div className="tma-quick-add-actions">
                {tmaNumbers.filter((item) => item.value !== lastSaved.tmaNumber).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className="btn btn-outline-primary tma-start-new-btn"
                    onClick={() => quickAddTma(item.value)}
                  >
                    <FiPlusCircle /> Add {item.label}
                  </button>
                ))}
                <button type="button" className="tma-quick-add-dismiss" aria-label="Dismiss" onClick={() => setLastSaved(null)}>
                  <FiX />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="tma-panel tma-records-list">
          <div className="tma-panel-head compact">
            <FiSearch />
            <div>
              <h2>Records</h2>
              <p>{stats.total} record{stats.total === 1 ? '' : 's'} · {stats.students} student{stats.students === 1 ? '' : 's'} · {stats.courses} course{stats.courses === 1 ? '' : 's'}.</p>
            </div>
          </div>

          <div className="tma-records-filters">
            <div className="tma-records-search">
              <FiSearch />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or matric number"
              />
            </div>
            <input
              type="text"
              value={courseFilterInput}
              onChange={(event) => setCourseFilterInput(event.target.value)}
              placeholder="Filter by course"
              aria-label="Filter by course"
            />
            <select
              aria-label="Filter by TMA"
              value={filters.tmaNumber}
              onChange={(event) => setFilters((current) => ({ ...current, tmaNumber: event.target.value }))}
            >
              <option value="">All TMAs</option>
              {tmaNumbers.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="tma-records-empty">Loading records...</div>
          ) : groupedRecords.length === 0 ? (
            <div className="tma-records-empty">No TMA records found.</div>
          ) : (
            <div className="tma-records-table-shell">
              <table className="tma-records-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Matric No.</th>
                    <th>Course</th>
                    <th>TMA</th>
                    <th>Score</th>
                    <th>Date</th>
                    <th aria-label="Actions"></th>
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
        </section>
      </div>
    </div>
  );
};

export default AdminTmaRecords;
