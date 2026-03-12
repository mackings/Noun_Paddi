import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import SEO from '../components/SEO';
import { slugifyCourse } from '../utils/courseSlug';
import './PublicSeoLanding.css';

const PublicCoursePreview = () => {
  const { courseSlug } = useParams();
  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        setLoading(true);
        const coursesRes = await api.get('/courses');
        const courses = Array.isArray(coursesRes.data?.data) ? coursesRes.data.data : [];
        const matchedCourse = courses.find(
          (item) => slugifyCourse(item.courseCode, item.courseName) === courseSlug
        );

        if (!matchedCourse?._id) {
          setNotFound(true);
          return;
        }

        const [courseRes, materialsRes] = await Promise.all([
          api.get(`/courses/${matchedCourse._id}`),
          api.get(`/materials/course/${matchedCourse._id}`),
        ]);

        setCourse(courseRes.data?.data || matchedCourse);
        setMaterials(Array.isArray(materialsRes.data?.data) ? materialsRes.data.data : []);
      } catch (error) {
        console.error('Error loading public course preview:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadCourse();
  }, [courseSlug]);

  const summaryCount = useMemo(
    () => materials.filter((item) => item?.hasSummary && item?.summary).length,
    [materials]
  );

  if (notFound) {
    return <Navigate to="/courses" replace />;
  }

  if (loading) {
    return (
      <div className="seo-landing-page">
        <div className="container">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!course) {
    return <Navigate to="/courses" replace />;
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: `${course.courseCode} ${course.courseName}`,
    description: `${course.courseCode} ${course.courseName} public course preview with NOUN summaries and materials on NounPaddi.`,
    url: `https://paddi.com.ng/noun-course/${courseSlug}`,
    provider: {
      '@type': 'EducationalOrganization',
      name: 'NounPaddi',
    },
  };

  return (
    <div className="seo-landing-page">
      <SEO
        title={`${course.courseCode} ${course.courseName} | NOUN Course Preview`}
        description={`Public preview for ${course.courseCode} ${course.courseName} on NounPaddi. View available materials, summaries, and practice support for this NOUN course.`}
        url={`/noun-course/${courseSlug}`}
        keywords={`${course.courseCode}, ${course.courseName}, NOUN course summary, NOUN materials, NounPaddi`}
        structuredData={structuredData}
      />
      <div className="container">
        <section className="seo-landing-hero">
          <div className="seo-landing-copy">
            <p className="seo-landing-kicker">NOUN Course Preview</p>
            <h1>{course.courseCode} {course.courseName}</h1>
            <p>
              This public NOUN course page helps students and search engines understand the course topic,
              available summaries, and linked practice support on NounPaddi.
            </p>
            <div className="seo-landing-actions">
              <Link to={`/course/${course._id}`} className="btn btn-primary">Open Course Summary</Link>
              <Link to={`/practice?courseId=${course._id}`} className="btn btn-outline">Practice This Course</Link>
            </div>
            <div className="seo-landing-proofs">
              <div className="seo-proof-card">
                <span className="seo-proof-value">{materials.length}</span>
                <span className="seo-proof-label">Public materials linked to this course.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">{summaryCount}</span>
                <span className="seo-proof-label">Materials with readable summaries.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">{course.creditUnits || 3}</span>
                <span className="seo-proof-label">Credit units for this NOUN course.</span>
              </div>
            </div>
          </div>

          <aside className="seo-landing-aside">
            <div>
              <h2>About this course</h2>
              <ul className="seo-feature-list">
                <li><span>{course.description || 'Public course preview page for this NOUN subject.'}</span></li>
                <li><span>Department: {course.departmentId?.name || 'NOUN department'}</span></li>
                <li><span>Use this page to move into summaries and practice quickly.</span></li>
              </ul>
            </div>
          </aside>
        </section>

        <section className="seo-landing-grid">
          <article className="seo-landing-panel">
            <h2>Available study materials</h2>
            {materials.length === 0 ? (
              <p>No public materials are available for this course yet.</p>
            ) : (
              <ul className="seo-panel-list">
                {materials.slice(0, 6).map((material) => (
                  <li key={material._id}>
                    <span>
                      <strong>{material.title}</strong>
                      {material.hasSummary ? 'Summary available.' : 'Original material available.'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="seo-landing-panel">
            <h2>What to do next</h2>
            <p>
              Open the main course page to read summaries or head straight into practice questions for
              {` ${course.courseCode}`}. This public preview is optimized for discovery, while the full study flow stays inside the course tools.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
};

export default PublicCoursePreview;
