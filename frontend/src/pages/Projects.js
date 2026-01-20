import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiFileText, FiSend, FiZap } from 'react-icons/fi';
import SEO from '../components/SEO';
import api from '../utils/api';
import './Projects.css';

const Projects = () => {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setTopics([]);

    const keywords = keywordsInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!selectedCourse.trim()) {
      setError('Please enter a course.');
      return;
    }

    if (keywords.length < 3 || keywords.length > 4) {
      setError('Please enter 3 to 4 keywords separated by commas.');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/projects/topics', {
        course: selectedCourse.trim(),
        keywords,
      });

      setTopics(response.data.data?.topics || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate topics. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="projects-page">
      <SEO
        title="Projects - NounPaddi"
        description="Get project topics and check plagiarism for your academic projects."
        url="/projects"
      />

      <div className="container">
        <div className="projects-hero">
          <div className="projects-hero-copy">
            <p className="hero-kicker">Projects Hub</p>
            <h1>Get Project Topics or Check Plagiarism</h1>
            <p>Choose your course, add a few keywords, and get project ideas in seconds.</p>
          </div>
          <div className="projects-hero-card">
            <div className="hero-card-header">
              <FiFileText />
              <div>
                <h3>Upload your project for corrections</h3>
                <p>Check originality, citation quality, and structure before submission.</p>
              </div>
            </div>
            <Link to="/plagiarism" className="btn btn-primary">
              Upload Project
            </Link>
          </div>
        </div>

        <div className="projects-grid">
          <div className="topic-card">
            <div className="topic-card-header">
              <div className="topic-icon">
                <FiZap />
              </div>
              <div>
                <h2>Get Project Topic</h2>
                <p>Provide a course and 3 to 4 keywords or interests.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="topic-form">
              <div className="form-group">
                <label className="form-label">Course</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Computer Science, Business Admin, Political Science"
                  value={selectedCourse}
                  onChange={(event) => setSelectedCourse(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Keywords (3 to 4)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. renewable energy, sensor networks, smart grid"
                  value={keywordsInput}
                  onChange={(event) => setKeywordsInput(event.target.value)}
                  required
                />
                <p className="helper-text">Separate keywords with commas.</p>
              </div>

              {error && <div className="alert alert-danger">{error}</div>}

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Generating...' : (
                  <>
                    <FiSend /> Generate Topics
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="topics-result">
            <div className="topics-header">
              <FiBookOpen />
              <div>
                <h3>Your Topic Suggestions</h3>
                <p>Five focused project ideas will appear here.</p>
              </div>
            </div>

            {topics.length === 0 ? (
              <div className="topics-empty">
                <p>No topics yet. Fill the form to generate ideas.</p>
              </div>
            ) : (
              <ol className="topics-list">
                {topics.map((topic, index) => (
                  <li key={`${topic}-${index}`}>{topic}</li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Projects;
