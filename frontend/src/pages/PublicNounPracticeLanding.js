import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle, FiEdit3, FiGrid, FiTrendingUp } from 'react-icons/fi';
import SEO from '../components/SEO';
import './PublicSeoLanding.css';

const PublicNounPracticeLanding = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'NOUN Practice Questions on NounPaddi',
    description: 'NOUN practice questions, practice exams, and revision support for National Open University of Nigeria students.',
    url: 'https://paddi.com.ng/noun-practice-questions',
  };

  return (
    <div className="seo-landing-page">
      <SEO
        title="NOUN Practice Questions | NounPaddi Practice Hub"
        description="Practice NOUN questions, revise with public course quizzes, and prepare for exams with NounPaddi practice support for National Open University of Nigeria students."
        url="/noun-practice-questions"
        keywords="NOUN practice questions, noun exam practice, National Open University of Nigeria questions, NounPaddi practice, NOUN quiz"
        structuredData={structuredData}
      />

      <div className="container">
        <section className="seo-landing-hero">
          <div className="seo-landing-copy">
            <p className="seo-landing-kicker">NOUN Practice</p>
            <h1>NOUN practice questions built for actual revision.</h1>
            <p>
              NounPaddi gives NOUN students public access to practice questions and course-linked revision,
              with deeper leaderboard and scoring features available after sign in.
            </p>
            <p>
              This page targets NOUN practice intent directly so Google can classify your platform for practice questions,
              exam preparation, and revision support.
            </p>

            <div className="seo-landing-actions">
              <Link to="/practice" className="btn btn-primary">
                Start NOUN Practice <FiArrowRight />
              </Link>
              <Link to="/noun-course-materials" className="btn btn-outline">
                View Materials
              </Link>
            </div>

            <div className="seo-landing-proofs">
              <div className="seo-proof-card">
                <span className="seo-proof-value">Public Practice Access</span>
                <span className="seo-proof-label">Visitors can open available practice questions without login.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Leaderboard Ready</span>
                <span className="seo-proof-label">Logged-in users can save performance and rank.</span>
              </div>
              <div className="seo-proof-card">
                <span className="seo-proof-value">Course-Linked</span>
                <span className="seo-proof-label">Practice flows from course materials and summaries.</span>
              </div>
            </div>
          </div>

          <aside className="seo-landing-aside">
            <div>
              <h2>What students want here</h2>
              <ul className="seo-feature-list">
                <li><FiGrid size={18} /><span>NOUN practice questions by course.</span></li>
                <li><FiEdit3 size={18} /><span>Exam-style revision support and repeated practice.</span></li>
                <li><FiTrendingUp size={18} /><span>Progress tracking after sign in.</span></li>
              </ul>
            </div>
            <div>
              <h2>Not the official NOUN site</h2>
              <p>
                NounPaddi is a student learning platform built around NOUN revision workflows.
                It complements official course study, but it is not the official NOUN education website.
              </p>
            </div>
          </aside>
        </section>

        <section className="seo-landing-grid">
          <article className="seo-landing-panel">
            <h2>How practice works</h2>
            <ul className="seo-panel-list">
              <li><FiCheckCircle size={18} /><span><strong>Select a course</strong> Open a NOUN course and begin available practice questions.</span></li>
              <li><FiCheckCircle size={18} /><span><strong>Answer and review</strong> Use instant answer checks for quicker revision loops.</span></li>
              <li><FiCheckCircle size={18} /><span><strong>Save results when signed in</strong> Leaderboards and points remain part of the student flow.</span></li>
            </ul>
          </article>

          <article className="seo-landing-panel">
            <h2>Search fit</h2>
            <p>
              This page is built for searches like NOUN practice questions, NOUN exam practice, and NOUN revision questions.
              It gives search engines a focused public page instead of only a private app route.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
};

export default PublicNounPracticeLanding;
