import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiCalendar, FiClock, FiMail, FiPhone, FiSend } from 'react-icons/fi';
import SEO from '../components/SEO';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import './ProjectConsultation.css';

const ProjectConsultation = () => {
  const location = useLocation();
  const minConsultDate = new Date().toISOString().split('T')[0];
  const [consultationForm, setConsultationForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    department: '',
    projectTitle: '',
    issueSummary: '',
    preferredDate: '',
    preferredTime: '09:00',
    paymentReference: '',
    acceptedTerms: false,
  });
  const [consultationStatus, setConsultationStatus] = useState({ loading: false, error: '', success: '' });
  const [paymentStatus, setPaymentStatus] = useState({ loading: false, error: '' });

  useEffect(() => {
    trackFeatureVisit('project_consultation');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldVerify = params.get('consultation') === '1';
    const txRef = params.get('tx_ref');

    if (!shouldVerify || !txRef) {
      return;
    }

    const verifyPaymentAndSubmit = async () => {
      try {
        setPaymentStatus({ loading: true, error: '' });
        const verifyRes = await api.get(`/projects/consultations/verify?tx_ref=${encodeURIComponent(txRef)}`);
        const draft = JSON.parse(localStorage.getItem('consultationFormDraft') || '{}');
        if (!draft || !draft.fullName) {
          setPaymentStatus({ loading: false, error: 'Payment verified, but consultation form was not found.' });
          return;
        }

        await api.post('/projects/consultations', {
          ...draft,
          hasPaid: true,
          paymentReference: verifyRes.data?.data?.transactionId || txRef,
        });

        localStorage.removeItem('consultationFormDraft');
        setConsultationStatus({
          loading: false,
          error: '',
          success: 'Consultation request submitted. We will contact you shortly.',
        });
        setPaymentStatus({ loading: false, error: '' });
        window.history.replaceState({}, '', '/projects/consultation');
      } catch (err) {
        setPaymentStatus({
          loading: false,
          error: err.response?.data?.message || 'Payment verification failed.',
        });
      }
    };

    verifyPaymentAndSubmit();
  }, [location.search]);

  const handleConsultationChange = (field, value) => {
    setConsultationForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePayAndSubmit = async (event) => {
    event.preventDefault();
    setPaymentStatus({ loading: true, error: '' });
    setConsultationStatus({ loading: false, error: '', success: '' });

    const requiredFields = [
      consultationForm.fullName,
      consultationForm.email,
      consultationForm.phone,
      consultationForm.department,
      consultationForm.projectTitle,
      consultationForm.issueSummary,
      consultationForm.preferredDate,
      consultationForm.preferredTime,
    ];

    if (requiredFields.some((value) => !String(value || '').trim())) {
      setPaymentStatus({ loading: false, error: 'Please complete all consultation fields before payment.' });
      return;
    }

    if (!consultationForm.acceptedTerms) {
      setPaymentStatus({ loading: false, error: 'Please accept the consultation terms.' });
      return;
    }

    try {
      localStorage.setItem('consultationFormDraft', JSON.stringify(consultationForm));
      const response = await api.post('/projects/consultations/initiate-payment', {
        email: consultationForm.email,
        fullName: consultationForm.fullName,
        phone: consultationForm.phone,
      });

      const paymentLink = response.data?.data?.link;
      if (!paymentLink) {
        throw new Error('Payment link was not generated.');
      }
      window.location.href = paymentLink;
    } catch (err) {
      setPaymentStatus({
        loading: false,
        error: err.response?.data?.message || err.message || 'Unable to start payment.',
      });
    }
  };

  return (
    <div className="project-consult-page">
      <SEO
        title="Project Consultation - NounPaddi"
        description="Book a paid consultation to assess your project and identify potential issues."
        url="/projects/consultation"
      />

      <div className="container">
        <div className="consultation-header">
          <p className="hero-kicker">Projects Hub</p>
          <h1>Book a Project Consultation</h1>
          <p>Two-hour session to assess your project and guide improvements.</p>
        </div>

        <div className="consultation-section">
          <div className="consultation-timeline">
            <div className="timeline-step active">
              <div className="step-dot">1</div>
              <div>
                <h4>Review Consultation</h4>
                <p>Assessment, feedback, and guidance across all departments.</p>
              </div>
            </div>
            <div className="timeline-step">
              <div className="step-dot">2</div>
              <div>
                <h4>Make Payment</h4>
                <p>Pay N2,000 to reserve a 2-hour session.</p>
              </div>
            </div>
            <div className="timeline-step">
              <div className="step-dot">3</div>
              <div>
                <h4>Pick Date & Time</h4>
                <p>Choose 9am, 12pm, or 3pm and submit.</p>
              </div>
            </div>
          </div>

          <div className="consultation-info">
            <div className="consultation-details">
              <div>
                <h2>What you get</h2>
                <ul>
                  <li>Project assessment and risk check.</li>
                  <li>Guidance on structure, originality, and improvement steps.</li>
                  <li>Coverage for all departments: business, agric, health tech, coding, and more.</li>
                </ul>
              </div>
              <div className="consultation-meta">
                <div className="meta-item">
                  <span>Fee</span>
                  <strong>N2,000</strong>
                </div>
                <div className="meta-item">
                  <span>Duration</span>
                  <strong>Up to 2 hours</strong>
                </div>
                <div className="meta-item">
                  <span>Time slots</span>
                  <strong>9:00 AM, 12:00 PM, 3:00 PM</strong>
                </div>
                <Link to="/consultation-terms" className="terms-link">
                  View consultation terms
                </Link>
              </div>
              <div className="consultation-payment">
                <h3>Payment + Form</h3>
                <p>Complete the form. We will verify payment automatically.</p>
              </div>
            </div>
          </div>

          <div className="consultation-form-card">
            <h2>Consultation form</h2>
            <p>Tell us about your project and pick a time slot.</p>
            <form onSubmit={handlePayAndSubmit} className="consultation-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={consultationForm.fullName}
                    onChange={(event) => handleConsultationChange('fullName', event.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={consultationForm.email}
                    onChange={(event) => handleConsultationChange('email', event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <FiPhone /> Phone number
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    value={consultationForm.phone}
                    onChange={(event) => handleConsultationChange('phone', event.target.value)}
                    placeholder="0800 000 0000"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <FiMail /> Department
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={consultationForm.department}
                    onChange={(event) => handleConsultationChange('department', event.target.value)}
                    placeholder="e.g. Business, Agric, Health Tech, Coding"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Project title</label>
                <input
                  type="text"
                  className="form-control"
                  value={consultationForm.projectTitle}
                  onChange={(event) => handleConsultationChange('projectTitle', event.target.value)}
                  placeholder="Project title"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Project issues or goals</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={consultationForm.issueSummary}
                  onChange={(event) => handleConsultationChange('issueSummary', event.target.value)}
                  placeholder="Describe the help you need (structure, originality, research scope, etc.)"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <FiCalendar /> Preferred date
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={consultationForm.preferredDate}
                    onChange={(event) => handleConsultationChange('preferredDate', event.target.value)}
                    min={minConsultDate}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <FiClock /> Time slot
                  </label>
                  <select
                    className="form-control"
                    value={consultationForm.preferredTime}
                    onChange={(event) => handleConsultationChange('preferredTime', event.target.value)}
                    required
                  >
                    <option value="09:00">9:00 AM</option>
                    <option value="12:00">12:00 PM</option>
                    <option value="15:00">3:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment reference (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={consultationForm.paymentReference}
                  onChange={(event) => handleConsultationChange('paymentReference', event.target.value)}
                  placeholder="Flutterwave reference"
                />
              </div>

              <div className="form-check">
                <input
                  type="checkbox"
                  id="consult-terms"
                  checked={consultationForm.acceptedTerms}
                  onChange={(event) => handleConsultationChange('acceptedTerms', event.target.checked)}
                  required
                />
                <label htmlFor="consult-terms">I agree to the consultation terms.</label>
              </div>

              {paymentStatus.error && (
                <div className="alert alert-danger">{paymentStatus.error}</div>
              )}
              {paymentStatus.loading && (
                <div className="alert alert-info">Verifying payment. Please wait...</div>
              )}
              {consultationStatus.error && (
                <div className="alert alert-danger">{consultationStatus.error}</div>
              )}
              {consultationStatus.success && (
                <div className="alert alert-success">{consultationStatus.success}</div>
              )}

              <button type="submit" className="btn btn-primary" disabled={paymentStatus.loading}>
                {paymentStatus.loading ? 'Redirecting to payment...' : (
                  <>
                    <FiSend /> Pay & Submit Consultation
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectConsultation;
