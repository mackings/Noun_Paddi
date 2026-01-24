import React from 'react';
import SEO from '../components/SEO';
import './ConsultationTerms.css';

const ConsultationTerms = () => {
  return (
    <div className="consult-terms-page">
      <SEO
        title="Consultation Terms - NounPaddi"
        description="Understand the scope of the project consultation service before booking."
        url="/consultation-terms"
      />

      <div className="container">
        <div className="consult-terms-card">
          <p className="consult-terms-kicker">Project Consultation</p>
          <h1>Consultation Terms & Scope</h1>
          <p className="consult-terms-intro">
            This consultation is focused on assessing your project, identifying potential issues, and guiding you on
            how to strengthen your work. It is not a full rewrite service. If you later request correction support,
            pricing will be discussed privately.
          </p>

          <div className="consult-terms-section">
            <h2>What the consultation covers</h2>
            <ul>
              <li>Project assessment, structure review, and originality guidance.</li>
              <li>Clear explanation of risks, weak sections, and improvement steps.</li>
              <li>Support for all departments: business, agriculture, health tech, coding, and more.</li>
            </ul>
          </div>

          <div className="consult-terms-section">
            <h2>Session details</h2>
            <ul>
              <li>Duration: up to 2 hours.</li>
              <li>Available slots: 9:00 AM, 12:00 PM, and 3:00 PM.</li>
              <li>Fee: N2,000 (consultation only).</li>
            </ul>
          </div>

          <div className="consult-terms-section">
            <h2>After payment</h2>
            <ul>
              <li>Complete the consultation request form with your preferred date and time.</li>
              <li>We will contact you via email or phone to confirm.</li>
            </ul>
          </div>

          <p className="consult-terms-note">
            By submitting a consultation request, you agree that this service focuses on assessment and guidance only.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConsultationTerms;
