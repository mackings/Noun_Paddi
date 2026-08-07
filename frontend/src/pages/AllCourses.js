import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Award, BookOpen, Loader2, Search } from 'lucide-react';
import api from '../utils/api';
import SEO from '../components/SEO';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

const COURSES_PER_PAGE = 24;
const normalizeSearchValue = (value) => String(value || '').toLowerCase().trim();
const compactSearchValue = (value) => normalizeSearchValue(value).replace(/[^a-z0-9]/g, '');

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
    const normalizedSearch = normalizeSearchValue(searchQuery);
    const compactQuery = compactSearchValue(searchQuery);

    return allCourses.filter((course) => {
      const courseFaculty = course?.departmentId?.facultyId;
      const facultyId = typeof courseFaculty === 'object' ? courseFaculty?._id : courseFaculty;
      const department = course?.departmentId;
      const departmentId = typeof department === 'object' ? department?._id : department;

      const matchesFaculty = !selectedFaculty || facultyId === selectedFaculty;
      const matchesDepartment = !selectedDepartment || departmentId === selectedDepartment;
      const matchesSearch = !normalizedSearch
        || normalizeSearchValue(course.courseCode).includes(normalizedSearch)
        || normalizeSearchValue(course.courseName).includes(normalizedSearch)
        || compactSearchValue(course.courseCode).includes(compactQuery)
        || compactSearchValue(course.courseName).includes(compactQuery);

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

  const selectClass = 'tw:h-11 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3.5 tw:text-sm tw:text-slate-900 tw:outline-none tw:transition-colors tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';

  return (
    <div className="np-shell tw:space-y-4 tw:p-4">
      <SEO
        title="All NOUN Courses - NounPaddi"
        description="Browse all available courses with search, faculty filter, department filter, and pagination."
        url="/courses/all"
        keywords="all courses, noun courses, faculty filter, department filter, paginated courses"
        robots="index, follow"
        structuredData={structuredData}
      />

      <div>
        <Link to="/courses" className="tw:inline-flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
          <ArrowLeft className="tw:h-3.5 tw:w-3.5" /> Back to Courses
        </Link>
        <h1 className="tw:font-heading tw:mt-2 tw:text-2xl tw:font-bold tw:tracking-tight">All Courses</h1>
        <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Search and filter by faculty or department.</p>
      </div>

      <div className="tw:relative">
        <Search className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3.5 tw:h-4 tw:w-4 tw:-translate-y-1/2 tw:text-slate-400" />
        <Input
          type="text"
          placeholder="Search by course code or name..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="tw:pl-10"
        />
      </div>

      <div className="tw:grid tw:grid-cols-2 tw:gap-3">
        <label className="tw:block tw:space-y-1.5">
          <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Faculty</span>
          <select
            className={selectClass}
            value={selectedFaculty}
            onChange={(event) => {
              setSelectedFaculty(event.target.value);
              setSelectedDepartment('');
            }}
          >
            <option value="">All Faculties</option>
            {faculties.map((faculty) => (
              <option key={faculty._id} value={faculty._id}>{faculty.name}</option>
            ))}
          </select>
        </label>

        <label className="tw:block tw:space-y-1.5">
          <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Department</span>
          <select
            className={selectClass}
            value={selectedDepartment}
            onChange={(event) => setSelectedDepartment(event.target.value)}
          >
            <option value="">All Departments</option>
            {filteredDepartments.map((department) => (
              <option key={department._id} value={department._id}>{department.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="tw:flex tw:items-center tw:justify-between">
        <h2 className="tw:font-heading tw:text-sm tw:font-bold">Available Courses</h2>
        <span className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{filteredCourses.length} found</span>
      </div>

      {loading ? (
        <div className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
          <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
          <p className="tw:text-sm">Loading courses...</p>
        </div>
      ) : paginatedCourses.length === 0 ? (
        <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-8 tw:text-center">
          <BookOpen className="tw:h-6 tw:w-6 tw:text-slate-400" />
          <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">No courses found. Try adjusting your search or filters.</p>
        </Card>
      ) : (
        <>
          <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:md:grid-cols-3 tw:lg:grid-cols-4">
            {paginatedCourses.map((course) => (
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

          <div className="tw:flex tw:items-center tw:justify-between tw:pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPageSafe <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <span className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
              Page {currentPageSafe} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPageSafe >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AllCourses;
