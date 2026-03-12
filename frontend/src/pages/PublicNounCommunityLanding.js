import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiCheckCircle, FiMessageCircle, FiUsers } from 'react-icons/fi';
import SEO from '../components/SEO';
import './PublicSeoLanding.css';

const PublicNounCommunityLanding = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'NOUN Student Community on NounPaddi',
    description: 'NounPaddi is a NOUN student learning and community platform for materials, summaries, practice questions, and study support.',
    url: 'https://paddi.com.ng/noun-student-community',
  };

  return (
    <div className="seo-landing-page">
      <SEO
        title="NOUN Student Community | NounPaddi"
        description="NounPaddi is a NOUN student learning and community platform with course materials, summaries, practice questions, and SIWES support."
        url="/noun-student-community"
        keywords="NOUN student community, NounPaddi, National Open University of Nigeria students, noun edu community, NOUN study support"
        structuredData={structuredData}
      />

      <div className="container">
        <section className="seo-landing-hero">
          <div className="seo-landing-copy">
            <p className="seo-landing-kicker">NOUN Community</p>
            <h1>A student community built around NOUN learning needs.</h1>
            <p>
              NounPaddi is designed for National Open University of Nigeria students who need a simpler route into
              course materials, summaries, practice questions, and peer support.
            </p>
            <p>
              If someone searches for NOUN study help, NOUN summaries, or a NOUN student community,
              this page gives Google a direct public explanation of what the platform actually is.
            </p>

            <div className="seo-landing-actions">
              <Link to="/courses" className="btn btn-primary">
                Explore NOUN Courses <FiArrowRight />
              </Link>
              <a
                className="btn btn-outline"
                href="https://chat.whatsapp.com/Ezx0OmcT1bs1BSymYT1f4G"
                target="_blank"
                rel="noreferrer"
              >
                Join Community
              </a>
            </div>

            <div className="seo-landing-proofs">
              <div className="seo-proof-card">
                <span className="seo-proof-value">Materials and Summaries</span>
                <span className="seo-proof-label">Study support built around NOUN course needs.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Practice and Ranking</span>
                <span className="seo-proof-label">Students can practice and compete on leaderboards.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Community Support</span>
                <span className="seo-proof-label">Join peer support and study updates outside isolated app flows.</span>
              </div>
            </div>
          </div>

          <aside className="seo-landing-aside">
            <div>
              <h2>Platform focus</h2>
              <ul className="seo-feature-list">
                <li><FiUsers size={18} /><span>NOUN students looking for a stronger study system.</span></li>
                <li><FiBookOpen size={18} /><span>Course-based materials, summaries, and practice support.</span></li>
                <li><FiMessageCircle size={18} /><span>Community touchpoints beyond isolated reading pages.</span></li>
              </ul>
            </div>
            <div>
              <h2>Important distinction</h2>
              <p>
                NounPaddi supports NOUN students, but it is not the official NOUN website. That distinction matters
                for trust and for avoiding misleading search intent.
              </p>
            </div>
          </aside>
        </section>

        <section className="seo-landing-grid">
          <article className="seo-landing-panel">
            <h2>What the platform covers</h2>
            <ul className="seo-panel-list">
              <li><FiCheckCircle size={18} /><span><strong>NOUN course materials</strong> Public discovery of course and material flows.</span></li>
              <li><FiCheckCircle size={18} /><span><strong>NOUN summaries</strong> Easier revision from long academic materials.</span></li>
              <li><FiCheckCircle size={18} /><span><strong>NOUN practice questions</strong> Practice before exams with course-linked questions.</span></li>
            </ul>
          </article>

          <article className="seo-landing-panel">
            <h2>Search fit</h2>
            <p>
              This page supports broader NOUN-related queries around student support and learning community.
              It will not override the official university site for highly navigational searches, but it gives your domain
              a relevant public page for generic NOUN student intent.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
};

export default PublicNounCommunityLanding;
