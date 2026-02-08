import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import SEO from '../components/SEO';
import { FiSearch, FiBook, FiArrowRight, FiAward, FiUpload } from 'react-icons/fi';
import './Explore.css';

const normalizeSearchValue = (value) => String(value || '').toLowerCase().trim();
const compactSearchValue = (value) => normalizeSearchValue(value).replace(/[^a-z0-9]/g, '');

const Explore = () => {
  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFaculties();
    fetchCourses();
    trackFeatureVisit('courses');
  }, []);

  const fetchFaculties = async () => {
    try {
      const response = await api.get('/faculties');
      setFaculties(response.data.data);
    } catch (error) {
      console.error('Error fetching faculties:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses');
      const courseList = response.data.data || [];
      setAllCourses(courseList);
      setCourses(courseList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setLoading(false);
    }
  };

  const getFacultyIdFromCourse = (course) => {
    const faculty = course?.departmentId?.facultyId;
    if (!faculty) return null;
    return typeof faculty === 'object' ? faculty._id : faculty;
  };

  const applyFilters = (query, facultyId = selectedFaculty) => {
    const trimmed = normalizeSearchValue(query);
    const compactQuery = compactSearchValue(query);

    let filtered = [...allCourses];

    // Search is global across all courses
    if (!trimmed && facultyId) {
      filtered = filtered.filter((course) => getFacultyIdFromCourse(course) === facultyId);
    }

    if (!trimmed) {
      setCourses(filtered);
      return;
    }

    filtered = filtered.filter((course) => {
      const code = normalizeSearchValue(course.courseCode);
      const name = normalizeSearchValue(course.courseName);
      const compactCode = compactSearchValue(course.courseCode);
      const compactName = compactSearchValue(course.courseName);

      return (
        code.includes(trimmed)
        || name.includes(trimmed)
        || compactCode.includes(compactQuery)
        || compactName.includes(compactQuery)
      );
    });

    setCourses(filtered);
  };

  const handleSearch = (query) => {
    const searchTerm = query ?? searchQuery;
    applyFilters(searchTerm);
  };

  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    applyFilters(value);
  };

  const handleFacultyClick = (facultyId) => {
    setSelectedFaculty(facultyId);
    setSearchQuery('');
    applyFilters('', facultyId);
  };

  useEffect(() => {
    applyFilters(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCourses]);

  const trimmedSearch = searchQuery.trim();
  const displayedCourses = trimmedSearch ? courses : courses.slice(0, 50);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "NounPaddi",
    "description": "Comprehensive course materials and study resources for National Open University of Nigeria (NOUN) students",
    "url": "https://nounpaddi.com",
    "numberOfCourses": courses.length,
    "educationalLevel": "Higher Education",
    "areaServed": {
      "@type": "Country",
      "name": "Nigeria"
    }
  };

  return (
    <div className="explore-container">
      <SEO
        title="Explore NOUN Courses & Study Materials - NounPaddi"
        description="Browse comprehensive course materials, practice questions, and study resources for all NOUN faculties. Access personalized learning materials to excel in your studies."
        url="/explore"
        keywords="NOUN courses, study materials, course materials Nigeria, NOUN faculties, e-learning resources, distance learning materials, NOUN study guide"
        structuredData={structuredData}
      />
      <div className="container">
        <div className="explore-header">
          <h1>Explore Courses</h1>
          <p>Discover personalized study materials and master your subjects with confidence</p>
        </div>

        <div className="summary-cta">
          <div className="summary-cta-card">
            <div>
              <p className="summary-cta-kicker">Get course summary</p>
              <h2>Upload your material to generate summaries</h2>
              <p>Head to the upload flow to get a clean summary and practice questions for any course.</p>
            </div>
            <Link to="/dashboard?upload=1" className="summary-cta-button">
              <FiUpload size={18} />
              Get Course Summary
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-section">
          <div className="search-bar">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by course code or name..."
              value={searchQuery}
              onChange={handleSearchInput}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="search-input"
            />
            <button className="search-btn" onClick={() => handleSearch()}>
              Search
            </button>
          </div>
        </div>

        {/* Faculties Filter */}
        <div className="faculties-section">
          <h2>Filter by Faculty</h2>
          <div className="faculty-chips">
            <button
              className={`faculty-chip ${!selectedFaculty ? 'active' : ''}`}
              onClick={() => {
                setSelectedFaculty(null);
                setSearchQuery('');
                applyFilters('', null);
              }}
            >
              All
            </button>
            {faculties.map((faculty) => (
              <button
                key={faculty._id}
                className={`faculty-chip ${selectedFaculty === faculty._id ? 'active' : ''}`}
                onClick={() => handleFacultyClick(faculty._id)}
              >
                {faculty.name}
              </button>
            ))}
          </div>
        </div>

        {/* Courses Grid */}
        <div className="courses-section">
          <div className="courses-header">
            <h2>Available Courses</h2>
            <Link className="view-all-courses-btn" to="/courses">
              View All Courses
            </Link>
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
          ) : displayedCourses.length === 0 ? (
            <div className="no-results">
              <div className="no-results-icon">
                <FiBook />
              </div>
              <p>No courses found. Try adjusting your search or filter.</p>
            </div>
          ) : (
            <div className="grid grid-3">
              {displayedCourses.map((course) => (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Explore;
