import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiAward, FiBook, FiSearch } from 'react-icons/fi';
import api from '../utils/api';
import SEO from '../components/SEO';
import './Explore.css';
import './AllCourses.css';

const COURSES_PER_PAGE = 24;

const AllCourses = () => {
  const [allCourses, setAllCourses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [coursesRes, facultiesRes, departmentsRes] = await Promise.all([
          api.get('/courses'),
          api.get('/faculties'),
          api.get('/departments'),
        ]);

        setAllCourses(coursesRes.data.data || []);
        setFaculties(facultiesRes.data.data || []);
        setDepartments(departmentsRes.data.data || []);
      } catch (error) {
        console.error('Error fetching courses data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredDepartments = useMemo(() => {
    if (!selectedFaculty) return departments;
    return departments.filter((department) => {
      const faculty = department?.facultyId;
      const facultyId = typeof faculty === 'object' ? faculty?._id : faculty;
      return facultyId === selectedFaculty;
    });
  }, [departments, selectedFaculty]);

  const filteredCourses = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return allCourses.filter((course) => {
      const courseFaculty = course?.departmentId?.facultyId;
      const facultyId = typeof courseFaculty === 'object' ? courseFaculty?._id : courseFaculty;
      const department = course?.departmentId;
      const departmentId = typeof department === 'object' ? department?._id : department;

      const matchesFaculty = !selectedFaculty || facultyId === selectedFaculty;
      const matchesDepartment = !selectedDepartment || departmentId === selectedDepartment;
      const matchesSearch = !normalizedSearch
        || String(course.courseCode || '').toLowerCase().includes(normalizedSearch)
        || String(course.courseName || '').toLowerCase().includes(normalizedSearch);

      return matchesFaculty && matchesDepartment && matchesSearch;
    });
  }, [allCourses, searchQuery, selectedFaculty, selectedDepartment]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFaculty, selectedDepartment]);

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / COURSES_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * COURSES_PER_PAGE;
  const paginatedCourses = filteredCourses.slice(startIndex, startIndex + COURSES_PER_PAGE);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'All NOUN Courses',
    numberOfItems: filteredCourses.length,
    itemListElement: paginatedCourses.map((course, index) => ({
      '@type': 'Course',
      position: startIndex + index + 1,
      name: `${course.courseCode} - ${course.courseName}`,
    })),
  };

  return (
    <div className="explore-container all-courses-page">
      <SEO
        title="All NOUN Courses - NounPaddi"
        description="Browse all available courses with search, faculty filter, department filter, and pagination."
        url="/courses"
        keywords="all courses, noun courses, faculty filter, department filter, paginated courses"
        structuredData={structuredData}
      />
      <div className="container">
        <div className="all-courses-header-row">
          <Link to="/explore" className="breadcrumb">
            <FiArrowLeft /> Back to Explore
          </Link>
          <h1>All Courses</h1>
          <p>Search and filter by faculty or department.</p>
        </div>

        <div className="search-section">
          <div className="search-bar">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by course code or name..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="all-courses-filters">
          <div className="all-courses-filter-group">
            <label htmlFor="faculty-filter">Faculty</label>
            <select
              id="faculty-filter"
              value={selectedFaculty}
              onChange={(event) => {
                setSelectedFaculty(event.target.value);
                setSelectedDepartment('');
              }}
            >
              <option value="">All Faculties</option>
              {faculties.map((faculty) => (
                <option key={faculty._id} value={faculty._id}>
                  {faculty.name}
                </option>
              ))}
            </select>
          </div>

          <div className="all-courses-filter-group">
            <label htmlFor="department-filter">Department</label>
            <select
              id="department-filter"
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
            >
              <option value="">All Departments</option>
              {filteredDepartments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="courses-section">
          <div className="courses-header">
            <h2>Available Courses</h2>
            <span className="all-courses-count">{filteredCourses.length} found</span>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-header">
                <div>
                  <h3>Loading courses</h3>
                  <p>Preparing the latest catalog for you.</p>
                </div>
                <div className="loading-pulse"></div>
              </div>
              <div className="loading-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="course-skeleton">
                    <div className="skeleton-icon"></div>
                    <div className="skeleton-line wide"></div>
                    <div className="skeleton-line"></div>
                    <div className="skeleton-chip"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : paginatedCourses.length === 0 ? (
            <div className="no-results">
              <div className="no-results-icon">
                <FiBook />
              </div>
              <p>No courses found. Try adjusting your search or filters.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-3">
                {paginatedCourses.map((course) => (
                  <Link
                    key={course._id}
                    to={`/course/${course._id}`}
                    className="course-card"
                  >
                    <div className="course-header">
                      <div className="course-icon">
                        <FiBook />
                      </div>
                      <div className="course-info">
                        <div className="course-code">{course.courseCode}</div>
                      </div>
                    </div>
                    <h3>{course.courseName}</h3>
                    <div className="course-footer">
                      <div className="course-credits">
                        <FiAward size={16} />
                        <span>{course.creditUnits || 3} Units</span>
                      </div>
                      <FiArrowRight className="course-arrow" />
                    </div>
                  </Link>
                ))}
              </div>

              <div className="pagination-row">
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={currentPageSafe <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <span className="pagination-text">
                  Page {currentPageSafe} of {totalPages}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={currentPageSafe >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllCourses;
