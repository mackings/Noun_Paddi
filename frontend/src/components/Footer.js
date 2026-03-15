import React from 'react';
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
