import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiCheckCircle, FiFileText, FiSearch } from 'react-icons/fi';
import SEO from '../components/SEO';
import './PublicSeoLanding.css';

const PublicNounMaterialsLanding = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'NOUN Course Materials on NounPaddi',
    description: 'NOUN course materials, revision support, summaries, and practice resources for National Open University of Nigeria students.',
    url: 'https://paddi.com.ng/noun-course-materials',
  };

  return (
    <div className="seo-landing-page">
      <SEO
        title="NOUN Course Materials | NounPaddi Learning Hub"
        description="Find NOUN course materials, revision support, summaries, and practice resources on NounPaddi for National Open University of Nigeria students."
        url="/noun-course-materials"
        keywords="NOUN course materials, noun materials, National Open University of Nigeria materials, NounPaddi materials, NOUN study resources"
        structuredData={structuredData}
      />

      <div className="container">
        <section className="seo-landing-hero">
          <div className="seo-landing-copy">
            <p className="seo-landing-kicker">NOUN Materials</p>
            <h1>NOUN course materials with a clearer revision path.</h1>
            <p>
              NounPaddi helps National Open University of Nigeria students move from raw course materials
              into summaries, practice questions, and structured study support without digging through scattered files.
            </p>
            <p>
              This is a public NOUN materials page for discovery. It is not the official NOUN website,
              but a student-focused learning and community platform built around NOUN study needs.
            </p>

            <div className="seo-landing-actions">
              <Link to="/courses" className="btn btn-primary">
                Browse NOUN Courses <FiArrowRight />
              </Link>
              <Link to="/summaries" className="btn btn-outline">
                Explore Summaries
              </Link>
            </div>

            <div className="seo-landing-proofs">
              <div className="seo-proof-card">
                <span className="seo-proof-value">Course Discovery</span>
                <span className="seo-proof-label">Browse NOUN courses by code, title, and faculty.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Summary Flow</span>
                <span className="seo-proof-label">Move from heavy material to cleaner study notes.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Practice Support</span>
                <span className="seo-proof-label">Pair materials with practice questions after reading.</span>
              </div>
            </div>
          </div>

          <aside className="seo-landing-aside">
            <div>
              <h2>What students look for</h2>
              <ul className="seo-feature-list">
                <li><FiSearch size={18} /><span>NOUN course materials by code or subject.</span></li>
                <li><FiFileText size={18} /><span>Summaries that make long PDFs easier to revise.</span></li>
                <li><FiBookOpen size={18} /><span>Study resources that connect materials to practice.</span></li>
              </ul>
            </div>
            <div>
              <h2>Why this page exists</h2>
              <p>
                Search engines need a public NOUN materials page to understand what your platform covers.
                The detailed study experience remains inside the actual course and summary routes.
              </p>
            </div>
          </aside>
        </section>

        <section className="seo-landing-grid">
          <article className="seo-landing-panel">
            <h2>How NounPaddi supports materials</h2>
            <ul className="seo-panel-list">
              <li><FiCheckCircle size={18} /><span><strong>Readable organization</strong> Materials are tied to actual NOUN courses instead of random file dumps.</span></li>
              <li><FiCheckCircle size={18} /><span><strong>Revision-first workflow</strong> Students can move from material to summary to practice in one flow.</span></li>
              <li><FiCheckCircle size={18} /><span><strong>Public discoverability</strong> Google can classify this page for NOUN study-material intent.</span></li>
            </ul>
          </article>

          <article className="seo-landing-panel">
            <h2>Best search fit</h2>
            <p>
              This page is designed to target searches around NOUN materials, NOUN study resources,
              and National Open University of Nigeria course support without pretending to be the official university domain.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
};

export default PublicNounMaterialsLanding;
