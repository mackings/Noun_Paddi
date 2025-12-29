import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import SEO from '../components/SEO';
import { FiSearch, FiBook, FiArrowRight, FiAward } from 'react-icons/fi';
import './Explore.css';

const Explore = () => {
  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFaculties();
    fetchCourses();
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
      setCourses(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm) {
      fetchCourses();
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(`/courses/search?query=${searchTerm}`);
      setCourses(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error searching courses:', error);
      setLoading(false);
    }
  };

  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value === '') {
      fetchCourses();
    }
  };

  const handleFacultyClick = async (facultyId) => {
    setSelectedFaculty(facultyId);
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

        {/* Search Bar */}
        <div className="search-section">
          <div className="search-bar">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search for courses by code or name..."
              value={searchQuery}
              onChange={handleSearchInput}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="search-input"
            />
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
                fetchCourses();
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
              <div className="spinner"></div>
              <p className="loading-text">Loading courses...</p>
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
