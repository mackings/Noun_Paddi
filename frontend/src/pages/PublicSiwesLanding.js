import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBriefcase, FiCheckCircle, FiMapPin, FiTrendingUp } from 'react-icons/fi';
import SEO from '../components/SEO';
import './PublicSeoLanding.css';

const PublicSiwesLanding = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'SIWES and IT Placement for NOUN Students',
    description: 'Explore SIWES and IT placement support for NOUN students through NounPaddi.',
    url: 'https://paddi.com.ng/it-placement',
    about: {
      '@type': 'Thing',
      name: 'SIWES and IT placement',
    },
  };

  return (
    <div className="seo-landing-page">
      <SEO
        title="SIWES and IT Placement for NOUN Students | NounPaddi"
        description="Explore SIWES and IT placement support for NOUN students on NounPaddi, including application flow, tech tracks, and placement guidance."
        url="/it-placement"
        keywords="SIWES for NOUN students, IT placement, NOUN SIWES, NounPaddi placement, industrial training Nigeria"
        structuredData={structuredData}
      />

      <div className="container">
        <section className="seo-landing-hero">
          <div className="seo-landing-copy">
            <p className="seo-landing-kicker">SIWES and Placement</p>
            <h1>Give NOUN students a clearer route into SIWES and IT placement.</h1>
            <p>
              NounPaddi helps students understand the placement flow, pick a suitable tech track,
              and move into the actual SIWES application workspace after sign in.
            </p>

            <div className="seo-landing-actions">
              <Link to="/signup?redirect=/it-placement" className="btn btn-primary">
                Start SIWES Application <FiArrowRight />
              </Link>
              <Link to="/login?redirect=/it-placement" className="btn btn-outline">
                Sign In
              </Link>
            </div>

            <div className="seo-landing-proofs">
              <div className="seo-proof-card">
                <span className="seo-proof-value">Track Selection</span>
                <span className="seo-proof-label">Choose frontend, backend, mobile, cloud, or full stack.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Application Status</span>
                <span className="seo-proof-label">Students can track their placement progress.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Career Focus</span>
                <span className="seo-proof-label">Built around practical training outcomes.</span>
              </div>
            </div>
          </div>

          <aside className="seo-landing-aside">
            <div>
              <h2>What this page targets</h2>
              <ul className="seo-feature-list">
                <li><FiBriefcase size={18} /><span>SIWES and industrial training search intent.</span></li>
                <li><FiTrendingUp size={18} /><span>Placement and career readiness for NOUN students.</span></li>
                <li><FiMapPin size={18} /><span>Study center and location-aware application planning.</span></li>
              </ul>
            </div>
            <div>
              <h2>Public page, private workflow</h2>
              <p>
                Search engines need a crawlable placement page. Students still complete the real application
                process after signing in to the platform.
              </p>
            </div>
          </aside>
        </section>

        <section className="seo-landing-grid">
          <article className="seo-landing-panel">
            <h2>What students can do after sign in</h2>
            <ul className="seo-panel-list">
              <li>
                <FiCheckCircle size={18} />
                <span>
                  <strong>Choose a track</strong>
                  Pick the technical area that matches skill level and interest.
                </span>
              </li>
              <li>
                <FiCheckCircle size={18} />
                <span>
                  <strong>Submit SIWES details</strong>
                  Enter department, study center, dates, and placement preferences.
                </span>
              </li>
              <li>
                <FiCheckCircle size={18} />
                <span>
                  <strong>Track placement status</strong>
                  Follow the application from pending review to placement outcome.
                </span>
              </li>
            </ul>
          </article>

          <article className="seo-landing-panel">
            <h2>Why this route can rank</h2>
            <p>
              It now has a public explanation page at the exact `/it-placement` URL instead of being invisible
              behind login. That gives Google a valid page to index for SIWES and IT placement intent.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
};

export default PublicSiwesLanding;
