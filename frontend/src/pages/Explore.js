import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import SEO from '../components/SEO';
import { FiSearch, FiBook, FiArrowRight, FiAward, FiUpload } from 'react-icons/fi';
import './Explore.css';

const Explore = () => {
  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [facultyCourses, setFacultyCourses] = useState([]);
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

  const applyFilters = (query, baseCourses) => {
    const trimmed = String(query || '').trim().toLowerCase();
    if (!trimmed) {
      setCourses(baseCourses);
      return;
    }

    const filtered = baseCourses.filter((course) => {
      const code = String(course.courseCode || '').toLowerCase();
      const name = String(course.courseName || '').toLowerCase();
      return code.includes(trimmed) || name.includes(trimmed);
    });
    setCourses(filtered);
  };

  const handleSearch = (query) => {
    const searchTerm = query ?? searchQuery;
    const baseCourses = selectedFaculty ? facultyCourses : allCourses;
    applyFilters(searchTerm, baseCourses);
  };

  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    const baseCourses = selectedFaculty ? facultyCourses : allCourses;
    applyFilters(value, baseCourses);
  };

  const handleFacultyClick = async (facultyId) => {
    setSelectedFaculty(facultyId);
    setSearchQuery('');
    try {
      setLoading(true);
      const response = await api.get(`/faculties/${facultyId}/departments`);
      const departments = response.data.data;
      
      // Fetch courses for all departments in this faculty
      const allCourses = [];
      for (const dept of departments) {
        const coursesResponse = await api.get(`/courses/department/${dept._id}`);
        allCourses.push(...coursesResponse.data.data);
      }
      
      setFacultyCourses(allCourses);
      setCourses(allCourses);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching faculty courses:', error);
      setLoading(false);
    }
  };

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
                setCourses(allCourses);
                setFacultyCourses([]);
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
          <h2>Available Courses</h2>
          
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
          ) : courses.length === 0 ? (
            <div className="no-results">
              <div className="no-results-icon">
                <FiBook />
              </div>
              <p>No courses found. Try adjusting your search or filter.</p>
            </div>
          ) : (
            <div className="grid grid-3">
              {courses.map((course) => (
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
