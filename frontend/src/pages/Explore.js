import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import SEO from '../components/SEO';
import { Search, BookOpen, ArrowRight, Award, Upload, Loader2, X } from 'lucide-react';
import ShellHeader from '../shell/ShellHeader';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

const normalizeSearchValue = (value) => String(value || '').toLowerCase().trim();
const compactSearchValue = (value) => normalizeSearchValue(value).replace(/[^a-z0-9]/g, '');
const hasDangerousSearchPattern = (value) =>
  /<[^>]+>|javascript:|on\w+\s*=|script/gi.test(String(value || ''));
const shouldAutoScrollResults = (value) => {
  const normalized = normalizeSearchValue(value);
  const compact = compactSearchValue(value);

  if (compact.length >= 5) return true; // gst10, gst101
  if (normalized.length >= 4 && /\s/.test(normalized)) return true; // gst 1
  if (/^[a-z]{3,}$/i.test(compact)) return true; // gst
  return false;
};

const Explore = () => {
  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [loading, setLoading] = useState(true);
  const resultsRef = useRef(null);
  const searchInputRef = useRef(null);

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
    if (hasDangerousSearchPattern(searchTerm)) {
      setSearchError('Invalid characters detected in search');
      return;
    }
    setSearchError('');
    applyFilters(searchTerm);
  };

  const handleSearchInput = (e) => {
    const value = e.target.value;
    if (hasDangerousSearchPattern(value)) {
      setSearchQuery(value);
      setSearchError('Invalid characters detected in search');
      setCourses([]);
      return;
    }

    setSearchError('');
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
  const allowAutoScroll = shouldAutoScrollResults(searchQuery);

  useEffect(() => {
    if (!trimmedSearch || !allowAutoScroll || loading || courses.length === 0) return;

    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.blur === 'function') {
      activeElement.blur();
    }

    const timeoutId = window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [trimmedSearch, allowAutoScroll, courses.length, loading]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'NounPaddi',
    description: 'Comprehensive course materials and study resources for National Open University of Nigeria (NOUN) students',
    url: 'https://paddi.com.ng',
    numberOfCourses: courses.length,
    educationalLevel: 'Higher Education',
    areaServed: { '@type': 'Country', name: 'Nigeria' },
  };

  return (
    <div className="np-shell tw:space-y-5 tw:p-4">
      <SEO
        title="Explore NOUN Courses & Study Materials - NounPaddi"
        description="Browse comprehensive course materials, practice questions, and study resources for all NOUN faculties. Access personalized learning materials to excel in your studies."
        url="/courses"
        keywords="NOUN courses, study materials, course materials Nigeria, NOUN faculties, e-learning resources, distance learning materials, NOUN study guide"
        robots="noindex, nofollow"
        structuredData={structuredData}
      />
      <ShellHeader title="Explore Courses" className="tw:-mx-4 tw:-mt-4" />

      <Card className="tw:flex tw:flex-col tw:gap-3 tw:bg-brand-600 tw:p-5 tw:text-white tw:border-none">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-100 tw:uppercase">Get course summary</p>
          <h2 className="tw:font-heading tw:mt-1 tw:text-base tw:font-bold">Upload your material to generate summaries</h2>
          <p className="tw:mt-1 tw:text-sm tw:text-brand-100">Head to the upload flow to get a clean summary and practice questions for any course.</p>
        </div>
        <Link
          to="/dashboard?upload=1"
          className="tw:inline-flex tw:w-fit tw:items-center tw:gap-2 tw:rounded-xl tw:bg-white tw:px-4 tw:py-2 tw:text-sm tw:font-semibold tw:text-brand-700 tw:transition-colors tw:hover:bg-brand-50"
        >
          <Upload className="tw:h-4 tw:w-4" /> Get Course Summary
        </Link>
      </Card>

      <div className="tw:space-y-2">
        <div className="tw:flex tw:items-center tw:justify-between">
          <h2 className="tw:font-heading tw:text-sm tw:font-bold">Search by course code or title</h2>
          {trimmedSearch && !searchError && (
            <span className="tw:rounded-full tw:bg-brand-100 tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-semibold tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300">
              {courses.length} result{courses.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="tw:relative tw:flex tw:items-center tw:gap-2">
          <div className="tw:relative tw:flex-1">
            <Search className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3.5 tw:h-4 tw:w-4 tw:-translate-y-1/2 tw:text-slate-400" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Try GST101, MTH202, or Computer Science..."
              value={searchQuery}
              onChange={handleSearchInput}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="tw:pr-9 tw:pl-10"
            />
            {trimmedSearch && (
              <button
                type="button"
                aria-label="Clear search"
                className="tw:absolute tw:top-1/2 tw:right-2.5 tw:-translate-y-1/2 tw:rounded-full tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100 tw:dark:hover:bg-slate-800"
                onClick={() => {
                  setSearchError('');
                  setSearchQuery('');
                  applyFilters('', selectedFaculty);
                  searchInputRef.current?.focus();
                }}
              >
                <X className="tw:h-3.5 tw:w-3.5" />
              </button>
            )}
          </div>
          <Button size="default" onClick={() => handleSearch()}>Search</Button>
        </div>
        {searchError && <p className="tw:text-xs tw:font-medium tw:text-red-600 tw:dark:text-red-400">{searchError}</p>}
        <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
          Search works across all courses. Faculty filters still apply when no search term is entered.
        </p>
      </div>

      <div className="tw:space-y-2">
        <h2 className="tw:font-heading tw:text-sm tw:font-bold">Filter by Faculty</h2>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <button
            type="button"
            className={cn(
              'tw:rounded-full tw:border tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:transition-colors',
              !selectedFaculty
                ? 'tw:border-brand-600 tw:bg-brand-600 tw:text-white'
                : 'tw:border-slate-200 tw:text-slate-600 tw:hover:bg-slate-50 tw:dark:border-slate-800 tw:dark:text-slate-300 tw:dark:hover:bg-slate-800',
            )}
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
              type="button"
              className={cn(
                'tw:rounded-full tw:border tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:transition-colors',
                selectedFaculty === faculty._id
                  ? 'tw:border-brand-600 tw:bg-brand-600 tw:text-white'
                  : 'tw:border-slate-200 tw:text-slate-600 tw:hover:bg-slate-50 tw:dark:border-slate-800 tw:dark:text-slate-300 tw:dark:hover:bg-slate-800',
              )}
              onClick={() => handleFacultyClick(faculty._id)}
            >
              {faculty.name}
            </button>
          ))}
        </div>
      </div>

      <div ref={resultsRef} className="tw:space-y-3">
        <div className="tw:flex tw:items-center tw:justify-between">
          <h2 className="tw:font-heading tw:text-sm tw:font-bold">{trimmedSearch ? 'Search Results' : 'Available Courses'}</h2>
          <Link to="/courses/all" className="tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
            View All Courses
          </Link>
        </div>

        {loading ? (
          <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
            <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
            <p className="tw:text-sm">Loading courses...</p>
          </div>
        ) : displayedCourses.length === 0 ? (
          <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-8 tw:text-center">
            <BookOpen className="tw:h-6 tw:w-6 tw:text-slate-400" />
            <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">No courses found. Try adjusting your search or filter.</p>
          </Card>
        ) : (
          <div className="tw:grid tw:grid-cols-2 tw:gap-3">
            {displayedCourses.map((course) => (
              <Link key={course._id} to={`/course/${course._id}`} className="tw:block">
                <Card interactive className="tw:flex tw:h-full tw:flex-col tw:gap-2 tw:p-4">
                  <span className="tw:flex tw:h-9 tw:w-9 tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                    <BookOpen className="tw:h-4 tw:w-4" />
                  </span>
                  <div>
                    <p className="tw:text-xs tw:font-bold tw:text-slate-500 tw:dark:text-slate-400">{course.courseCode}</p>
                    <h3 className="tw:font-heading tw:text-sm tw:font-bold tw:leading-snug">{course.courseName}</h3>
                  </div>
                  <div className="tw:mt-auto tw:flex tw:items-center tw:justify-between tw:pt-1">
                    <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                      <Award className="tw:h-3.5 tw:w-3.5" /> {course.creditUnits || 3} Units
                    </span>
                    <ArrowRight className="tw:h-4 tw:w-4 tw:text-brand-500" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;
