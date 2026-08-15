import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import {
  Upload,
  Check,
  Plus,
  Book,
  Briefcase,
  FileText,
  Grid3x3,
  Layers,
  BookOpen,
  Settings,
  Search,
  Loader2,
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const ALLOWED_TABS = ['faculties', 'departments', 'courses', 'materials'];

const selectClass = 'tw:h-10 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';

const AdminUpload = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = ALLOWED_TABS.includes(requestedTab) ? requestedTab : 'faculties';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingFacultyId, setEditingFacultyId] = useState(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [showArchivedFaculties, setShowArchivedFaculties] = useState(false);
  const [showArchivedDepartments, setShowArchivedDepartments] = useState(false);
  const [showArchivedCourses, setShowArchivedCourses] = useState(false);
  const [facultySearch, setFacultySearch] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');

  // Faculty form
  const [facultyForm, setFacultyForm] = useState({ name: '', code: '' });

  // Department form
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '', facultyId: '' });

  // Course form
  const [courseForm, setCourseForm] = useState({
    courseCode: '',
    courseName: '',
    creditUnits: 3,
    departmentId: ''
  });

  // Material upload form
  const [selectedFile, setSelectedFile] = useState(null);
  const [materialForm, setMaterialForm] = useState({
    title: '',
    courseId: '',
  });
  const [uploading, setUploading] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [uploadedMaterial, setUploadedMaterial] = useState(null);

  useEffect(() => {
    fetchFaculties();
    fetchDepartments();
    fetchCourses();
    trackFeatureVisit('admin_upload');
  }, []);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (ALLOWED_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams, activeTab]);

  const fetchFaculties = async () => {
    try {
      const response = await api.get('/admin/faculties?includeArchived=true');
      setFaculties(response.data.data || []);
    } catch (error) {
      console.error('Error fetching faculties:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/admin/departments?includeArchived=true');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await api.get('/admin/courses?includeArchived=true');
      setCourses(response.data.data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  // Faculty handlers
  const handleCreateFaculty = async (e) => {
    e.preventDefault();
    try {
      if (editingFacultyId) {
        await api.put(`/faculties/${editingFacultyId}`, facultyForm);
        setMessage({ type: 'success', text: 'Faculty updated successfully!' });
      } else {
        await api.post('/faculties', facultyForm);
        setMessage({ type: 'success', text: 'Faculty created successfully!' });
      }
      setFacultyForm({ name: '', code: '' });
      setEditingFacultyId(null);
      fetchFaculties();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save faculty' });
    }
  };

  const handleEditFaculty = (faculty) => {
    setFacultyForm({ name: faculty.name || '', code: faculty.code || '' });
    setEditingFacultyId(faculty._id);
  };

  const handleArchiveFaculty = async (faculty) => {
    try {
      await api.patch(`/faculties/${faculty._id}/archive`, { archived: !faculty.isArchived });
      fetchFaculties();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update faculty status' });
    }
  };

  // Department handlers
  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    try {
      if (editingDepartmentId) {
        await api.put(`/departments/${editingDepartmentId}`, departmentForm);
        setMessage({ type: 'success', text: 'Department updated successfully!' });
      } else {
        await api.post('/departments', departmentForm);
        setMessage({ type: 'success', text: 'Department created successfully!' });
      }
      setDepartmentForm({ name: '', code: '', facultyId: '' });
      setEditingDepartmentId(null);
      fetchDepartments();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save department' });
    }
  };

  const handleEditDepartment = (department) => {
    setDepartmentForm({
      name: department.name || '',
      code: department.code || '',
      facultyId: department.facultyId?._id || department.facultyId || '',
    });
    setEditingDepartmentId(department._id);
  };

  const handleArchiveDepartment = async (department) => {
    try {
      await api.patch(`/departments/${department._id}/archive`, { archived: !department.isArchived });
      fetchDepartments();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update department status' });
    }
  };

  // Course handlers
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      if (editingCourseId) {
        await api.put(`/courses/${editingCourseId}`, courseForm);
        setMessage({ type: 'success', text: 'Course updated successfully!' });
      } else {
        await api.post('/courses', courseForm);
        setMessage({ type: 'success', text: 'Course created successfully!' });
      }
      setCourseForm({ courseCode: '', courseName: '', creditUnits: 3, departmentId: '' });
      setEditingCourseId(null);
      fetchCourses();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save course' });
    }
  };

  const handleEditCourse = (course) => {
    setCourseForm({
      courseCode: course.courseCode || '',
      courseName: course.courseName || '',
      creditUnits: course.creditUnits || 3,
      departmentId: course.departmentId?._id || course.departmentId || '',
    });
    setEditingCourseId(course._id);
  };

  const handleArchiveCourse = async (course) => {
    try {
      await api.patch(`/courses/${course._id}/archive`, { archived: !course.isArchived });
      fetchCourses();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update course status' });
    }
  };

  // Material upload handlers
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !materialForm.courseId) {
      setMessage({ type: 'error', text: 'Please select a file and course' });
      return;
    }

    setUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const data = new FormData();
      data.append('file', selectedFile);
      data.append('title', materialForm.title);
      data.append('courseId', materialForm.courseId);

      const response = await api.post('/materials/upload', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadedMaterial(response.data.data);
      setMessage({ type: 'success', text: 'Material uploaded successfully!' });
      setUploading(false);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Upload failed' });
      setUploading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!uploadedMaterial) return;

    setGeneratingSummary(true);
    setMessage({ type: '', text: '' });

    try {
      await api.post(`/materials/${uploadedMaterial._id}/summarize`);
      setMessage({ type: 'success', text: 'Summary generated successfully!' });
      setGeneratingSummary(false);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Summary generation failed' });
      setGeneratingSummary(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!uploadedMaterial) return;

    setGeneratingQuestions(true);
    setMessage({ type: '', text: '' });

    try {
      await api.post(`/materials/${uploadedMaterial._id}/generate-questions`);
      setMessage({ type: 'success', text: 'Practice questions generated successfully!' });
      setGeneratingQuestions(false);

      setTimeout(() => {
        setUploadedMaterial(null);
        setSelectedFile(null);
        setMaterialForm({ title: '', courseId: '' });
        setMessage({ type: '', text: '' });
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Question generation failed' });
      setGeneratingQuestions(false);
    }
  };

  const tabs = [
    { id: 'faculties', label: 'Faculties', icon: Briefcase },
    { id: 'departments', label: 'Departments', icon: Layers },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'materials', label: 'Upload Materials', icon: Upload },
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const normalizedFacultySearch = facultySearch.trim().toLowerCase();
  const visibleFaculties = faculties
    .filter((faculty) => showArchivedFaculties || !faculty.isArchived)
    .filter((faculty) => {
      if (!normalizedFacultySearch) return true;
      const name = String(faculty.name || '').toLowerCase();
      const code = String(faculty.code || '').toLowerCase();
      return name.includes(normalizedFacultySearch) || code.includes(normalizedFacultySearch);
    });
  const normalizedDepartmentSearch = departmentSearch.trim().toLowerCase();
  const visibleDepartments = departments
    .filter((dept) => showArchivedDepartments || !dept.isArchived)
    .filter((dept) => {
      if (!normalizedDepartmentSearch) return true;
      const name = String(dept.name || '').toLowerCase();
      const code = String(dept.code || '').toLowerCase();
      const faculty = String(dept.facultyId?.name || '').toLowerCase();
      return name.includes(normalizedDepartmentSearch) || code.includes(normalizedDepartmentSearch) || faculty.includes(normalizedDepartmentSearch);
    });
  const normalizedCourseSearch = courseSearch.trim().toLowerCase();
  const visibleCourses = courses
    .filter((course) => showArchivedCourses || !course.isArchived)
    .filter((course) => {
      if (!normalizedCourseSearch) return true;
      const code = String(course.courseCode || '').toLowerCase();
      const name = String(course.courseName || '').toLowerCase();
      const department = String(course.departmentId?.name || '').toLowerCase();
      return code.includes(normalizedCourseSearch) || name.includes(normalizedCourseSearch) || department.includes(normalizedCourseSearch);
    });
  const activeFacultyCount = faculties.filter((faculty) => !faculty.isArchived).length;
  const activeDepartmentCount = departments.filter((dept) => !dept.isArchived).length;
  const activeCourseCount = courses.filter((course) => !course.isArchived).length;

  const ListToolbar = ({ search, onSearch, placeholder, showArchived, onShowArchivedChange }) => (
    <div className="tw:mt-3 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      <div className="tw:relative tw:min-w-[200px] tw:flex-1">
        <Search className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:h-4 tw:w-4 tw:-translate-y-1/2 tw:text-slate-400" />
        <Input type="text" placeholder={placeholder} value={search} onChange={onSearch} className="tw:pl-9" />
      </div>
      <label className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:text-slate-300">
        <input type="checkbox" checked={showArchived} onChange={onShowArchivedChange} className="tw:h-4 tw:w-4 tw:rounded tw:border-slate-300 tw:accent-brand-600" />
        Show archived
      </label>
    </div>
  );

  const EmptyState = ({ icon: Icon, text }) => (
    <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-10 tw:text-center">
      <Icon className="tw:h-8 tw:w-8 tw:text-slate-300" />
      <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">{text}</p>
    </div>
  );

  return (
    <div className="tw:space-y-5">
      <Card className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-4 tw:p-5">
        <div className="tw:flex tw:items-start tw:gap-3">
          <span className="tw:flex tw:h-10 tw:w-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><Settings className="tw:h-5 tw:w-5" /></span>
          <div>
            <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Academic Structure</p>
            <h1 className="tw:font-heading tw:text-xl tw:font-bold tw:tracking-tight">Admin Management</h1>
            <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Set up faculties, departments, courses, and study materials from one organized workspace.</p>
          </div>
        </div>
        <div className="tw:flex tw:gap-4">
          {[{ label: 'Faculties', value: activeFacultyCount }, { label: 'Departments', value: activeDepartmentCount }, { label: 'Courses', value: activeCourseCount }].map((stat) => (
            <div key={stat.label} className="tw:text-center">
              <strong className="tw:block tw:font-heading tw:text-lg tw:font-bold">{stat.value}</strong>
              <span className="tw:text-[11px] tw:text-slate-400">{stat.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="tw:flex tw:flex-wrap tw:gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'tw:flex tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:px-3.5 tw:py-2 tw:text-sm tw:font-semibold tw:transition-colors',
              activeTab === tab.id
                ? 'tw:border-brand-600 tw:bg-brand-600 tw:text-white'
                : 'tw:border-slate-200 tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300',
            )}
          >
            <tab.icon className="tw:h-4 tw:w-4" />
            <span>{tab.label}</span>
          </button>
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

      {/* Faculty Tab */}
      {activeTab === 'faculties' && (
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-[1fr_1.4fr]">
          <Card className="tw:p-5">
            <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold">
              <Plus className="tw:h-4 tw:w-4 tw:text-brand-600" /> {editingFacultyId ? 'Update Faculty' : 'Create New Faculty'}
            </h2>
            <form onSubmit={handleCreateFaculty} className="tw:mt-3 tw:space-y-3">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Faculty Name</span>
                <Input
                  type="text"
                  placeholder="e.g., Science and Technology"
                  value={facultyForm.name}
                  onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
                  required
                />
              </label>
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Faculty Code</span>
                <Input
                  type="text"
                  placeholder="e.g., FST"
                  value={facultyForm.code}
                  onChange={(e) => setFacultyForm({ ...facultyForm, code: e.target.value })}
                  required
                />
              </label>
              <Button type="submit" className="tw:w-full">
                <Plus className="tw:h-4 tw:w-4" /> {editingFacultyId ? 'Update Faculty' : 'Create Faculty'}
              </Button>
              {editingFacultyId && (
                <Button
                  type="button"
                  variant="secondary"
                  className="tw:w-full"
                  onClick={() => {
                    setEditingFacultyId(null);
                    setFacultyForm({ name: '', code: '' });
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </form>
          </Card>

          <Card className="tw:p-5">
            <div className="tw:flex tw:items-center tw:justify-between">
              <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold"><Briefcase className="tw:h-4 tw:w-4 tw:text-brand-600" /> Existing Faculties</h2>
              <span className="tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300">{visibleFaculties.length} shown</span>
            </div>
            <ListToolbar
              search={facultySearch}
              onSearch={(e) => setFacultySearch(e.target.value)}
              placeholder="Search faculties by name or code..."
              showArchived={showArchivedFaculties}
              onShowArchivedChange={(e) => setShowArchivedFaculties(e.target.checked)}
            />
            {faculties.length === 0 ? (
              <EmptyState icon={Briefcase} text="No faculties yet. Create one to get started!" />
            ) : visibleFaculties.length === 0 ? (
              <EmptyState icon={Search} text="No faculties matched your search." />
            ) : (
              <div className="tw:mt-3 tw:max-h-[55vh] tw:space-y-2 tw:overflow-y-auto">
                {visibleFaculties.map((faculty) => (
                  <div key={faculty._id} className="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                    <span className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><Briefcase className="tw:h-4 tw:w-4" /></span>
                    <div className="tw:min-w-0 tw:flex-1">
                      <div className="tw:flex tw:items-center tw:gap-2">
                        <h3 className="tw:truncate tw:text-sm tw:font-bold">{faculty.name}</h3>
                        {faculty.isArchived && <span className="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-slate-500 tw:dark:bg-slate-800">Archived</span>}
                      </div>
                      <p className="tw:mt-0.5 tw:inline-block tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-semibold tw:text-slate-500 tw:dark:bg-slate-800 tw:dark:text-slate-400">{faculty.code}</p>
                    </div>
                    <div className="tw:flex tw:shrink-0 tw:gap-1.5">
                      <Button type="button" size="sm" variant="outline" onClick={() => handleEditFaculty(faculty)}>Edit</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => handleArchiveFaculty(faculty)}>{faculty.isArchived ? 'Unarchive' : 'Archive'}</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Department Tab */}
      {activeTab === 'departments' && (
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-[1fr_1.4fr]">
          <Card className="tw:p-5">
            <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold">
              <Plus className="tw:h-4 tw:w-4 tw:text-brand-600" /> {editingDepartmentId ? 'Update Department' : 'Create New Department'}
            </h2>
            <form onSubmit={handleCreateDepartment} className="tw:mt-3 tw:space-y-3">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Faculty</span>
                <select
                  className={selectClass}
                  value={departmentForm.facultyId}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, facultyId: e.target.value })}
                  required
                >
                  <option value="">-- Select Faculty --</option>
                  {faculties.map((faculty) => (
                    <option key={faculty._id} value={faculty._id}>{faculty.name}</option>
                  ))}
                </select>
              </label>
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Department Name</span>
                <Input
                  type="text"
                  placeholder="e.g., Computer Science"
                  value={departmentForm.name}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                  required
                />
              </label>
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Department Code</span>
                <Input
                  type="text"
                  placeholder="e.g., CSC"
                  value={departmentForm.code}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })}
                  required
                />
              </label>
              <Button type="submit" className="tw:w-full">
                <Plus className="tw:h-4 tw:w-4" /> {editingDepartmentId ? 'Update Department' : 'Create Department'}
              </Button>
              {editingDepartmentId && (
                <Button
                  type="button"
                  variant="secondary"
                  className="tw:w-full"
                  onClick={() => {
                    setEditingDepartmentId(null);
                    setDepartmentForm({ name: '', code: '', facultyId: '' });
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </form>
          </Card>

          <Card className="tw:p-5">
            <div className="tw:flex tw:items-center tw:justify-between">
              <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold"><Layers className="tw:h-4 tw:w-4 tw:text-brand-600" /> Existing Departments</h2>
              <span className="tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300">{visibleDepartments.length} shown</span>
            </div>
            <ListToolbar
              search={departmentSearch}
              onSearch={(e) => setDepartmentSearch(e.target.value)}
              placeholder="Search departments by name, code, or faculty..."
              showArchived={showArchivedDepartments}
              onShowArchivedChange={(e) => setShowArchivedDepartments(e.target.checked)}
            />
            {departments.length === 0 ? (
              <EmptyState icon={Layers} text="No departments yet. Create one to get started!" />
            ) : visibleDepartments.length === 0 ? (
              <EmptyState icon={Search} text="No departments matched your search." />
            ) : (
              <div className="tw:mt-3 tw:max-h-[55vh] tw:space-y-2 tw:overflow-y-auto">
                {visibleDepartments.map((dept) => (
                  <div key={dept._id} className="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                    <span className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><Layers className="tw:h-4 tw:w-4" /></span>
                    <div className="tw:min-w-0 tw:flex-1">
                      <h3 className="tw:truncate tw:text-sm tw:font-bold">{dept.name}</h3>
                      <div className="tw:mt-0.5 tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:text-[11px] tw:text-slate-500 tw:dark:text-slate-400">
                        <span className="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:font-semibold tw:dark:bg-slate-800">{dept.code}</span>
                        <span>{dept.facultyId?.name || 'No faculty'}</span>
                        {dept.isArchived && <span className="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:font-semibold tw:dark:bg-slate-800">Archived</span>}
                      </div>
                    </div>
                    <div className="tw:flex tw:shrink-0 tw:gap-1.5">
                      <Button type="button" size="sm" variant="outline" onClick={() => handleEditDepartment(dept)}>Edit</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => handleArchiveDepartment(dept)}>{dept.isArchived ? 'Unarchive' : 'Archive'}</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-[1fr_1.4fr]">
          <Card className="tw:p-5">
            <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold">
              <Plus className="tw:h-4 tw:w-4 tw:text-brand-600" /> {editingCourseId ? 'Update Course' : 'Create New Course'}
            </h2>
            <form onSubmit={handleCreateCourse} className="tw:mt-3 tw:space-y-3">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Department</span>
                <select
                  className={selectClass}
                  value={courseForm.departmentId}
                  onChange={(e) => setCourseForm({ ...courseForm, departmentId: e.target.value })}
                  required
                >
                  <option value="">-- Select Department --</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>{dept.name}</option>
                  ))}
                </select>
              </label>
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Course Code</span>
                <Input
                  type="text"
                  placeholder="e.g., CSC101"
                  value={courseForm.courseCode}
                  onChange={(e) => setCourseForm({ ...courseForm, courseCode: e.target.value })}
                  required
                />
              </label>
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Course Name</span>
                <Input
                  type="text"
                  placeholder="e.g., Introduction to Computer Science"
                  value={courseForm.courseName}
                  onChange={(e) => setCourseForm({ ...courseForm, courseName: e.target.value })}
                  required
                />
              </label>
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Credit Units</span>
                <Input
                  type="number"
                  min="1"
                  max="6"
                  value={courseForm.creditUnits}
                  onChange={(e) => setCourseForm({ ...courseForm, creditUnits: parseInt(e.target.value) })}
                  required
                />
              </label>
              <Button type="submit" className="tw:w-full">
                <Plus className="tw:h-4 tw:w-4" /> {editingCourseId ? 'Update Course' : 'Create Course'}
              </Button>
              {editingCourseId && (
                <Button
                  type="button"
                  variant="secondary"
                  className="tw:w-full"
                  onClick={() => {
                    setEditingCourseId(null);
                    setCourseForm({ courseCode: '', courseName: '', creditUnits: 3, departmentId: '' });
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </form>
          </Card>

          <Card className="tw:p-5">
            <div className="tw:flex tw:items-center tw:justify-between">
              <h2 className="tw:flex tw:items-center tw:gap-2 tw:font-heading tw:text-sm tw:font-bold"><BookOpen className="tw:h-4 tw:w-4 tw:text-brand-600" /> Existing Courses</h2>
              <span className="tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300">{visibleCourses.length} shown</span>
            </div>
            <ListToolbar
              search={courseSearch}
              onSearch={(e) => setCourseSearch(e.target.value)}
              placeholder="Search courses by code, title, or department..."
              showArchived={showArchivedCourses}
              onShowArchivedChange={(e) => setShowArchivedCourses(e.target.checked)}
            />
            {courses.length === 0 ? (
              <EmptyState icon={BookOpen} text="No courses yet. Create one to get started!" />
            ) : visibleCourses.length === 0 ? (
              <EmptyState icon={Search} text="No courses matched your search." />
            ) : (
              <div className="tw:mt-3 tw:max-h-[55vh] tw:space-y-2 tw:overflow-y-auto">
                {visibleCourses.map((course) => (
                  <div key={course._id} className="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                    <span className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300"><Book className="tw:h-4 tw:w-4" /></span>
                    <div className="tw:min-w-0 tw:flex-1">
                      <h3 className="tw:truncate tw:text-sm tw:font-bold">{course.courseCode}</h3>
                      <p className="tw:truncate tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{course.courseName}</p>
                      <div className="tw:mt-0.5 tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:text-[11px] tw:text-slate-500 tw:dark:text-slate-400">
                        <span className="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:font-semibold tw:dark:bg-slate-800">{course.creditUnits} Units</span>
                        {course.departmentId?.name && <span className="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:font-semibold tw:dark:bg-slate-800">{course.departmentId.name}</span>}
                        {course.isArchived && <span className="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:font-semibold tw:dark:bg-slate-800">Archived</span>}
                      </div>
                    </div>
                    <div className="tw:flex tw:shrink-0 tw:gap-1.5">
                      <Button type="button" size="sm" variant="outline" onClick={() => handleEditCourse(course)}>Edit</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => handleArchiveCourse(course)}>{course.isArchived ? 'Unarchive' : 'Archive'}</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div>
          {!uploadedMaterial ? (
            <Card className="tw:mx-auto tw:max-w-xl tw:p-6">
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:text-center">
                <Upload className="tw:h-10 tw:w-10 tw:text-brand-600" />
                <h2 className="tw:font-heading tw:text-lg tw:font-bold">Upload Course Material</h2>
                <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Upload PDF materials to automatically generate summaries and practice questions</p>
              </div>
              <form onSubmit={handleUpload} className="tw:mt-5 tw:space-y-3">
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Material Title</span>
                  <Input
                    type="text"
                    value={materialForm.title}
                    onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                    placeholder="e.g., Introduction to Algorithms - Chapter 1"
                    required
                  />
                </label>

                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Select Course</span>
                  <select
                    className={selectClass}
                    value={materialForm.courseId}
                    onChange={(e) => setMaterialForm({ ...materialForm, courseId: e.target.value })}
                    required
                  >
                    <option value="">-- Select a course --</option>
                    {courses.map((course) => (
                      <option key={course._id} value={course._id}>{course.courseCode} - {course.courseName}</option>
                    ))}
                  </select>
                </label>

                <label htmlFor="file-upload" className="tw:block tw:space-y-1.5">
                  <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Upload PDF File</span>
                  <div className="tw:flex tw:flex-col tw:items-center tw:gap-1 tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:p-6 tw:text-center tw:dark:border-slate-700">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      id="file-upload"
                      required
                      className="tw:hidden"
                    />
                    <FileText className="tw:h-8 tw:w-8 tw:text-slate-400" />
                    <h3 className="tw:text-sm tw:font-bold">{selectedFile ? selectedFile.name : 'Drop your file here'}</h3>
                    <p className="tw:text-xs tw:text-slate-400">or click to browse</p>
                    <span className="tw:text-[11px] tw:text-slate-400">PDF, DOC, DOCX (Max 50MB)</span>
                  </div>
                </label>

                <Button type="submit" disabled={uploading} className="tw:w-full">
                  {uploading ? <><Loader2 className="tw:h-4 tw:w-4 tw:animate-spin" /> Uploading...</> : <><Upload className="tw:h-4 tw:w-4" /> Upload Material</>}
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="tw:mx-auto tw:max-w-2xl tw:space-y-5 tw:p-6 tw:text-center">
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-2">
                <span className="tw:flex tw:h-14 tw:w-14 tw:items-center tw:justify-center tw:rounded-full tw:bg-emerald-100 tw:text-emerald-600 tw:dark:bg-emerald-950 tw:dark:text-emerald-300"><Check className="tw:h-7 tw:w-7" /></span>
                <h2 className="tw:font-heading tw:text-lg tw:font-bold">Material Uploaded Successfully!</h2>
                <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">
                  <strong className="tw:text-slate-700 tw:dark:text-slate-200">{uploadedMaterial?.title}</strong> has been uploaded and is ready for system processing
                </p>
              </div>

              <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
                <div className="tw:flex tw:items-start tw:gap-3 tw:rounded-xl tw:bg-slate-50 tw:p-4 tw:text-left tw:dark:bg-slate-900">
                  <FileText className="tw:h-5 tw:w-5 tw:shrink-0 tw:text-brand-600" />
                  <div>
                    <h4 className="tw:text-sm tw:font-bold">Summary Generation</h4>
                    <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Generate a comprehensive summary with simplified explanations of complex terms using our system.</p>
                  </div>
                </div>
                <div className="tw:flex tw:items-start tw:gap-3 tw:rounded-xl tw:bg-slate-50 tw:p-4 tw:text-left tw:dark:bg-slate-900">
                  <Grid3x3 className="tw:h-5 tw:w-5 tw:shrink-0 tw:text-brand-600" />
                  <div>
                    <h4 className="tw:text-sm tw:font-bold">Practice Questions</h4>
                    <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">Create multiple-choice questions to test understanding of the material</p>
                  </div>
                </div>
              </div>

              <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-2">
                <Button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary || generatingQuestions}
                >
                  {generatingSummary ? <><Loader2 className="tw:h-4 tw:w-4 tw:animate-spin" /> Generating Summary...</> : <><FileText className="tw:h-4 tw:w-4" /> Generate Summary</>}
                </Button>
                <Button
                  onClick={handleGenerateQuestions}
                  disabled={generatingSummary || generatingQuestions}
                >
                  {generatingQuestions ? <><Loader2 className="tw:h-4 tw:w-4 tw:animate-spin" /> Generating Questions...</> : <><Grid3x3 className="tw:h-4 tw:w-4" /> Generate Questions</>}
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setUploadedMaterial(null);
                  setSelectedFile(null);
                  setMaterialForm({ title: '', courseId: '' });
                  setMessage({ type: '', text: '' });
                }}
              >
                Upload Another Material
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminUpload;
