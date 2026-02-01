import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import {
  FiUpload,
  FiCheck,
  FiPlus,
  FiBook,
  FiBriefcase,
  FiFileText,
  FiGrid,
  FiLayers,
  FiBookOpen,
  FiSettings
} from 'react-icons/fi';
import './Admin.css';

const AdminUpload = () => {
  const [activeTab, setActiveTab] = useState('faculties');
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
    { id: 'faculties', label: 'Faculties', icon: FiBriefcase },
    { id: 'departments', label: 'Departments', icon: FiLayers },
    { id: 'courses', label: 'Courses', icon: FiBookOpen },
    { id: 'materials', label: 'Upload Materials', icon: FiUpload },
  ];

  return (
    <div className="admin-container">
      <div className="container">
        <div className="admin-header">
          <div className="admin-header-icon">
            <FiSettings />
          </div>
          <div>
            <h1>Admin Management</h1>
            <p>Manage faculties, departments, courses, and upload study materials</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="admin-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={20} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
            {message.text}
          </div>
        )}

        {/* Faculty Tab */}
        {activeTab === 'faculties' && (
          <div className="admin-content">
            <div className="admin-grid">
              <div className="admin-form-card">
                <h2>
                  <FiPlus /> {editingFacultyId ? 'Update Faculty' : 'Create New Faculty'}
                </h2>
                <form onSubmit={handleCreateFaculty}>
                  <div className="form-group">
                    <label className="form-label">Faculty Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., Science and Technology"
                      value={facultyForm.name}
                      onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Faculty Code</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., FST"
                      value={facultyForm.code}
                      onChange={(e) => setFacultyForm({ ...facultyForm, code: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-block">
                    <FiPlus /> {editingFacultyId ? 'Update Faculty' : 'Create Faculty'}
                  </button>
                  {editingFacultyId && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-block"
                      onClick={() => {
                        setEditingFacultyId(null);
                        setFacultyForm({ name: '', code: '' });
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </form>
              </div>

              <div className="admin-list-card">
                <h2>
                  <FiBriefcase /> Existing Faculties
                </h2>
                <div className="admin-filter-row">
                  <label className="admin-toggle">
                    <input
                      type="checkbox"
                      checked={showArchivedFaculties}
                      onChange={(e) => setShowArchivedFaculties(e.target.checked)}
                    />
                    <span>Show archived</span>
                  </label>
                </div>
                {faculties.length === 0 ? (
                  <div className="empty-state-small">
                    <FiBriefcase size={32} />
                    <p>No faculties yet. Create one to get started!</p>
                  </div>
                ) : (
                  <div className="item-list">
                    {faculties
                      .filter((faculty) => showArchivedFaculties || !faculty.isArchived)
                      .map((faculty) => (
                      <div key={faculty._id} className="item-card">
                        <div className="item-icon">
                          <FiBriefcase />
                        </div>
                        <div className="item-info">
                          <h3>{faculty.name}</h3>
                          <p>{faculty.code}</p>
                          {faculty.isArchived && <span className="item-meta archived">Archived</span>}
                        </div>
                        <div className="item-actions">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => handleEditFaculty(faculty)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleArchiveFaculty(faculty)}
                          >
                            {faculty.isArchived ? 'Unarchive' : 'Archive'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Department Tab */}
        {activeTab === 'departments' && (
          <div className="admin-content">
            <div className="admin-grid">
              <div className="admin-form-card">
                <h2>
                  <FiPlus /> {editingDepartmentId ? 'Update Department' : 'Create New Department'}
                </h2>
                <form onSubmit={handleCreateDepartment}>
                  <div className="form-group">
                    <label className="form-label">Faculty</label>
                    <select
                      className="form-control"
                      value={departmentForm.facultyId}
                      onChange={(e) => setDepartmentForm({ ...departmentForm, facultyId: e.target.value })}
                      required
                    >
                      <option value="">-- Select Faculty --</option>
                      {faculties.map((faculty) => (
                        <option key={faculty._id} value={faculty._id}>
                          {faculty.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., Computer Science"
                      value={departmentForm.name}
                      onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department Code</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., CSC"
                      value={departmentForm.code}
                      onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-block">
                    <FiPlus /> {editingDepartmentId ? 'Update Department' : 'Create Department'}
                  </button>
                  {editingDepartmentId && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-block"
                      onClick={() => {
                        setEditingDepartmentId(null);
                        setDepartmentForm({ name: '', code: '', facultyId: '' });
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </form>
              </div>

              <div className="admin-list-card">
                <h2>
                  <FiLayers /> Existing Departments
                </h2>
                <div className="admin-filter-row">
                  <label className="admin-toggle">
                    <input
                      type="checkbox"
                      checked={showArchivedDepartments}
                      onChange={(e) => setShowArchivedDepartments(e.target.checked)}
                    />
                    <span>Show archived</span>
                  </label>
                </div>
                {departments.length === 0 ? (
                  <div className="empty-state-small">
                    <FiLayers size={32} />
                    <p>No departments yet. Create one to get started!</p>
                  </div>
                ) : (
                  <div className="item-list">
                    {departments
                      .filter((dept) => showArchivedDepartments || !dept.isArchived)
                      .map((dept) => (
                      <div key={dept._id} className="item-card">
                        <div className="item-icon">
                          <FiLayers />
                        </div>
                        <div className="item-info">
                          <h3>{dept.name}</h3>
                          <p>{dept.code}</p>
                          <span className="item-meta">
                            {dept.facultyId?.name || 'No faculty'}
                          </span>
                          {dept.isArchived && <span className="item-meta archived">Archived</span>}
                        </div>
                        <div className="item-actions">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => handleEditDepartment(dept)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleArchiveDepartment(dept)}
                          >
                            {dept.isArchived ? 'Unarchive' : 'Archive'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="admin-content">
            <div className="admin-grid">
              <div className="admin-form-card">
                <h2>
                  <FiPlus /> {editingCourseId ? 'Update Course' : 'Create New Course'}
                </h2>
                <form onSubmit={handleCreateCourse}>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select
                      className="form-control"
                      value={courseForm.departmentId}
                      onChange={(e) => setCourseForm({ ...courseForm, departmentId: e.target.value })}
                      required
                    >
                      <option value="">-- Select Department --</option>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Course Code</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., CSC101"
                      value={courseForm.courseCode}
                      onChange={(e) => setCourseForm({ ...courseForm, courseCode: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Course Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., Introduction to Computer Science"
                      value={courseForm.courseName}
                      onChange={(e) => setCourseForm({ ...courseForm, courseName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Units</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max="6"
                      value={courseForm.creditUnits}
                      onChange={(e) => setCourseForm({ ...courseForm, creditUnits: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-block">
                    <FiPlus /> {editingCourseId ? 'Update Course' : 'Create Course'}
                  </button>
                  {editingCourseId && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-block"
                      onClick={() => {
                        setEditingCourseId(null);
                        setCourseForm({ courseCode: '', courseName: '', creditUnits: 3, departmentId: '' });
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </form>
              </div>

              <div className="admin-list-card">
                <h2>
                  <FiBookOpen /> Existing Courses
                </h2>
                <div className="admin-filter-row">
                  <label className="admin-toggle">
                    <input
                      type="checkbox"
                      checked={showArchivedCourses}
                      onChange={(e) => setShowArchivedCourses(e.target.checked)}
                    />
                    <span>Show archived</span>
                  </label>
                </div>
                {courses.length === 0 ? (
                  <div className="empty-state-small">
                    <FiBookOpen size={32} />
                    <p>No courses yet. Create one to get started!</p>
                  </div>
                ) : (
                  <div className="item-list">
                    {courses
                      .filter((course) => showArchivedCourses || !course.isArchived)
                      .map((course) => (
                      <div key={course._id} className="item-card">
                        <div className="item-icon">
                          <FiBook />
                        </div>
                        <div className="item-info">
                          <h3>{course.courseCode}</h3>
                          <p>{course.courseName}</p>
                          <span className="item-meta">{course.creditUnits} Units</span>
                          {course.departmentId?.name && (
                            <span className="item-meta">{course.departmentId.name}</span>
                          )}
                          {course.isArchived && <span className="item-meta archived">Archived</span>}
                        </div>
                        <div className="item-actions">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => handleEditCourse(course)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleArchiveCourse(course)}
                          >
                            {course.isArchived ? 'Unarchive' : 'Archive'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Materials Tab */}
        {activeTab === 'materials' && (
          <div className="admin-content">
            {!uploadedMaterial ? (
              <div className="upload-card-modern">
                <div className="upload-header">
                  <FiUpload size={48} />
                  <h2>Upload Course Material</h2>
                  <p>Upload PDF materials to automatically generate summaries and practice questions</p>
                </div>
                <form onSubmit={handleUpload}>
                  <div className="form-group">
                    <label className="form-label">Material Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={materialForm.title}
                      onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                      placeholder="e.g., Introduction to Algorithms - Chapter 1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Select Course</label>
                    <select
                      className="form-control"
                      value={materialForm.courseId}
                      onChange={(e) => setMaterialForm({ ...materialForm, courseId: e.target.value })}
                      required
                    >
                      <option value="">-- Select a course --</option>
                      {courses.map((course) => (
                        <option key={course._id} value={course._id}>
                          {course.courseCode} - {course.courseName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Upload PDF File</label>
                    <div className="file-drop-zone">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileChange}
                        className="file-input"
                        id="file-upload"
                        required
                      />
                      <label htmlFor="file-upload" className="file-drop-label">
                        <FiFileText size={48} />
                        <h3>{selectedFile ? selectedFile.name : 'Drop your file here'}</h3>
                        <p>or click to browse</p>
                        <span className="file-types">PDF, DOC, DOCX (Max 50MB)</span>
                      </label>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={uploading}>
                    {uploading ? (
                      <>
                        <div className="spinner-small"></div> Uploading...
                      </>
                    ) : (
                      <>
                        <FiUpload /> Upload Material
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="processing-card-modern">
                <div className="success-animation">
                  <div className="success-icon-large">
                    <FiCheck />
                  </div>
                  <h2>Material Uploaded Successfully!</h2>
                  <p className="upload-success-subtitle">
                    <strong>{uploadedMaterial?.title}</strong> has been uploaded and is ready for system processing
                  </p>
                </div>

                <div className="ai-processing-info">
                  <div className="info-card">
                    <FiFileText size={24} />
                    <div>
                      <h4>Summary Generation</h4>
                      <p>Generate a comprehensive summary with simplified explanations of complex terms using our system.</p>
                    </div>
                  </div>
                  <div className="info-card">
                    <FiGrid size={24} />
                    <div>
                      <h4>Practice Questions</h4>
                      <p>Create multiple-choice questions to test understanding of the material</p>
                    </div>
                  </div>
                </div>

                <div className="processing-actions">
                  <button
                    onClick={handleGenerateSummary}
                    className="btn btn-primary btn-lg btn-action"
                    disabled={generatingSummary || generatingQuestions}
                  >
                    {generatingSummary ? (
                      <>
                        <div className="spinner-small"></div>
                        <span>Generating Summary...</span>
                      </>
                    ) : (
                      <>
                        <FiFileText size={20} />
                        <span>Generate Summary</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleGenerateQuestions}
                    className="btn btn-success btn-lg btn-action"
                    disabled={generatingSummary || generatingQuestions}
                  >
                    {generatingQuestions ? (
                      <>
                        <div className="spinner-small"></div>
                        <span>Generating Questions...</span>
                      </>
                    ) : (
                      <>
                        <FiGrid size={20} />
                        <span>Generate Questions</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => {
                    setUploadedMaterial(null);
                    setSelectedFile(null);
                    setMaterialForm({ title: '', courseId: '' });
                    setMessage({ type: '', text: '' });
                  }}
                  className="btn btn-outline-secondary mt-4"
                >
                  Upload Another Material
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUpload;
