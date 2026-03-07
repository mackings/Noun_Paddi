import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiCheckCircle, FiFileText, FiShield } from 'react-icons/fi';
import SEO from '../components/SEO';
import './PublicSeoLanding.css';

const PublicSummariesLanding = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'NOUN Course Summaries on NounPaddi',
    description: 'Get NOUN course summaries on NounPaddi and revise faster with structured study notes.',
    url: 'https://paddi.com.ng/summaries',
    mainEntity: {
      '@type': 'LearningResource',
      name: 'NOUN course summaries',
      learningResourceType: 'Study Guide',
    },
  };

  return (
    <div className="seo-landing-page">
      <SEO
        title="NOUN Course Summaries | NounPaddi Summary Hub"
        description="Access NOUN course summaries on NounPaddi, revise course materials faster, and move into practice questions with a structured summary flow."
        url="/summaries"
        keywords="NOUN summaries, NOUN course summary, NounPaddi summaries, study summaries for NOUN, course revision notes"
        structuredData={structuredData}
      />

      <div className="container">
        <section className="seo-landing-hero">
          <div className="seo-landing-copy">
            <p className="seo-landing-kicker">Summary Hub</p>
            <h1>Read NOUN course summaries without losing the main idea.</h1>
            <p>
              NounPaddi helps students compress long materials into structured summaries that are easier
              to revise, easier to return to, and easier to pair with practice questions.
            </p>

            <div className="seo-landing-actions">
              <Link to="/signup?redirect=/dashboard?upload=1" className="btn btn-primary">
                Get a Course Summary <FiArrowRight />
              </Link>
              <Link to="/login?redirect=/dashboard?upload=1" className="btn btn-outline">
                Sign In
              </Link>
            </div>

            <div className="seo-landing-proofs">
              <div className="seo-proof-card">
                <span className="seo-proof-value">Cleaner Revision</span>
                <span className="seo-proof-label">Turn long materials into usable study notes.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Tracked Reading</span>
                <span className="seo-proof-label">Reading completion can feed into leaderboard activity.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Practice Linked</span>
                <span className="seo-proof-label">Move from summary to questions with less friction.</span>
              </div>
            </div>
          </div>

          <aside className="seo-landing-aside">
            <div>
              <h2>Summary flow</h2>
              <ul className="seo-feature-list">
                <li><FiFileText size={18} /><span>Upload course material and generate a readable summary.</span></li>
                <li><FiBookOpen size={18} /><span>Follow the sectioned summary instead of scrolling blind.</span></li>
                <li><FiShield size={18} /><span>Use activity checks to prevent fake completion scoring.</span></li>
              </ul>
            </div>
            <div>
              <h2>Why it matters</h2>
              <p>
                Students do not just need access to materials. They need a shorter path from heavy PDF files
                to revision-ready notes that still reflect the course content.
              </p>
            </div>
          </aside>
        </section>

        <section className="seo-landing-grid">
          <article className="seo-landing-panel">
            <h2>What makes these summaries useful</h2>
            <ul className="seo-panel-list">
              <li>
                <FiCheckCircle size={18} />
                <span>
                  <strong>Sectioned reading</strong>
                  Long text is broken into a flow students can follow properly.
                </span>
              </li>
              <li>
                <FiCheckCircle size={18} />
                <span>
                  <strong>Course-linked practice</strong>
                  Summaries and questions sit inside the same study path.
                </span>
              </li>
              <li>
                <FiCheckCircle size={18} />
                <span>
                  <strong>Student activity tracking</strong>
                  Completion is tied to active reading, not just fast scrolling.
                </span>
              </li>
            </ul>
          </article>

          <article className="seo-landing-panel">
            <h2>Search ranking angle</h2>
            <p>
              This public page gives Google a stable URL for the “NOUN summaries” topic. The detailed
              summary reader remains inside the logged-in app where students actually study.
            </p>
            <p>
              That separation is the right tradeoff: public ranking page outside, full private tool inside.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
};

export default PublicSummariesLanding;
