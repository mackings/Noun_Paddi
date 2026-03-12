import React from 'react';
import { Link } from 'react-router-dom';
import { FiMessageCircle } from 'react-icons/fi';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="container footer-content">
        <div className="footer-copy">
          <h3>Join our community</h3>
          <p>
            Get updates, study tips, and quick support with other students in our WhatsApp group.
          </p>
          <div className="footer-links">
            <Link to="/courses">Courses</Link>
            <Link to="/summaries">Summaries</Link>
            <Link to="/noun-course-materials">NOUN Materials</Link>
            <Link to="/noun-practice-questions">NOUN Practice</Link>
            <Link to="/noun-student-community">NOUN Community</Link>
            <Link to="/news">NOUN Updates</Link>
            <Link to="/it-placement">SIWES</Link>
            <Link to="/disclaimer">Disclaimer</Link>
          </div>
        </div>
        <a
          className="btn btn-primary footer-cta"
          href="https://chat.whatsapp.com/Ezx0OmcT1bs1BSymYT1f4G"
          target="_blank"
          rel="noreferrer"
        >
          <FiMessageCircle /> Join WhatsApp Community
        </a>
      </div>
    </footer>
  );
};

export default Footer;
