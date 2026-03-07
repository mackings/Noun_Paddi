import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiCheckCircle, FiLayers, FiSearch } from 'react-icons/fi';
import SEO from '../components/SEO';
import './PublicSeoLanding.css';

const PublicCoursesLanding = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'NOUN Courses on NounPaddi',
    description: 'Browse NOUN courses, discover course materials, and prepare with structured support on NounPaddi.',
    url: 'https://paddi.com.ng/courses',
    about: {
      '@type': 'Thing',
      name: 'National Open University of Nigeria courses',
    },
  };

  return (
    <div className="seo-landing-page">
      <SEO
        title="NOUN Courses on NounPaddi | Browse Courses and Materials"
        description="Browse NOUN courses on NounPaddi, discover course materials by faculty, and move into summaries and practice questions with a structured study flow."
        url="/courses"
        keywords="NOUN courses, NOUN course list, NounPaddi courses, NOUN study materials, National Open University of Nigeria courses"
        structuredData={structuredData}
      />

      <div className="container">
        <section className="seo-landing-hero">
          <div className="seo-landing-copy">
            <p className="seo-landing-kicker">NOUN Courses</p>
            <h1>Browse NOUN courses with a cleaner study path.</h1>
            <p>
              NounPaddi helps National Open University of Nigeria students move from course discovery
              to summaries, practice questions, and consistent revision without digging through scattered files.
            </p>

            <div className="seo-landing-actions">
              <Link to="/signup?redirect=/courses" className="btn btn-primary">
                Open Course Library <FiArrowRight />
              </Link>
              <Link to="/login?redirect=/courses" className="btn btn-outline">
                Sign In
              </Link>
            </div>

            <div className="seo-landing-proofs">
              <div className="seo-proof-card">
                <span className="seo-proof-value">Course Code Search</span>
                <span className="seo-proof-label">Find courses quickly by code or title.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Faculty Filters</span>
                <span className="seo-proof-label">Narrow courses by faculty and department.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Summary Ready</span>
                <span className="seo-proof-label">Move from course discovery into revision faster.</span>
              </div>
            </div>
          </div>

          <aside className="seo-landing-aside">
            <div>
              <h2>What students get</h2>
              <ul className="seo-feature-list">
                <li><FiSearch size={18} /><span>Search NOUN courses with less friction.</span></li>
                <li><FiLayers size={18} /><span>Organize study decisions by faculty and department.</span></li>
                <li><FiBookOpen size={18} /><span>Jump from courses into summaries and practice flow.</span></li>
              </ul>
            </div>
            <div>
              <h2>Built for NOUN students</h2>
              <p>
                This page exists so search engines can understand the platform topic clearly while the
                full course tools remain available inside the student app after sign in.
              </p>
            </div>
          </aside>
        </section>

        <section className="seo-landing-grid">
          <article className="seo-landing-panel">
            <h2>How the course flow works</h2>
            <ul className="seo-panel-list">
              <li>
                <FiCheckCircle size={18} />
                <span>
                  <strong>Start with the course list</strong>
                  Find the exact NOUN course code and title you need.
                </span>
              </li>
              <li>
                <FiCheckCircle size={18} />
                <span>
                  <strong>Open materials and summaries</strong>
                  Read condensed notes built around the course content.
                </span>
              </li>
              <li>
                <FiCheckCircle size={18} />
                <span>
                  <strong>Practice with questions</strong>
                  Use follow-up practice to reinforce what you just revised.
                </span>
              </li>
            </ul>
          </article>

          <article className="seo-landing-panel">
            <h2>Why this page should rank</h2>
            <p>
              Google needs a crawlable public URL that clearly explains what the course section is about.
              This page gives that context without exposing the private student dashboard to search crawlers.
            </p>
            <p>
              Once users sign in, they still land in the full course experience with search, filters, and navigation.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
};

export default PublicCoursesLanding;
