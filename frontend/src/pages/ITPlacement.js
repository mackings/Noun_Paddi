import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import SEO from '../components/SEO';
import { trackFeatureVisit } from '../utils/featureTracking';
import {
  FiCode, FiServer, FiSmartphone, FiCloud, FiLayers,
  FiCheckCircle, FiAlertCircle, FiClock, FiMapPin,
  FiCalendar, FiUser, FiMail, FiPhone, FiBookOpen,
  FiGithub, FiLinkedin, FiGlobe, FiArrowRight, FiX,
  FiAward, FiTrendingUp
} from 'react-icons/fi';
import './ITPlacement.css';

const TECH_TRACKS = [
  {
    id: 'Frontend Development',
    name: 'Frontend Development',
    icon: <FiCode />,
    description: 'Build beautiful user interfaces with React, Vue, or Angular',
    skills: ['HTML/CSS', 'JavaScript', 'React/Vue', 'UI/UX Design'],
    color: '#3b82f6'
  },
  {
    id: 'Backend Development',
    name: 'Backend Development',
    icon: <FiServer />,
    description: 'Create powerful server-side applications and APIs',
    skills: ['Node.js', 'Python', 'Databases', 'API Design'],
    color: '#10b981'
  },
  {
    id: 'Mobile App Development',
    name: 'Mobile App Development',
    icon: <FiSmartphone />,
    description: 'Develop native or cross-platform mobile applications',
    skills: ['React Native', 'Flutter', 'iOS/Android', 'Mobile UI'],
    color: '#8b5cf6'
  },
  {
    id: 'Cloud Engineering',
    name: 'Cloud Engineering',
    icon: <FiCloud />,
    description: 'Deploy and manage applications on cloud platforms',
    skills: ['AWS/Azure', 'Docker', 'Kubernetes', 'DevOps'],
    color: '#f59e0b'
  },
  {
    id: 'Full Stack Development',
    name: 'Full Stack Development',
    icon: <FiLayers />,
    description: 'Master both frontend and backend development',
    skills: ['Frontend', 'Backend', 'Databases', 'Deployment'],
    color: '#ef4444'
  },
];

const STUDY_CENTERS = [
  'Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan', 'Enugu',
  'Benin City', 'Kaduna', 'Jos', 'Calabar', 'Owerri', 'Akure',
  'Ilorin', 'Abeokuta', 'Warri', 'Sokoto', 'Maiduguri', 'Other'
];

const ITPlacement = () => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: '',
    matricNumber: '',
    department: '',
    level: '',
    studyCenter: '',
    track: '',
    experienceLevel: 'Beginner',
    hasLaptop: false,
    internetAccess: false,
    previousExperience: '',
    portfolioUrl: '',
    githubUrl: '',
    linkedinUrl: '',
    availableStartDate: '',
    duration: '6 months',
    locationPreference: 'Remote',
    preferredLocation: '',
  });

  useEffect(() => {
    fetchApplication();
    trackFeatureVisit('it_placement');
  }, []);

  const fetchApplication = async () => {
    try {
      const response = await api.get('/it-placement/my-application');
      if (response.data.data) {
        setApplication(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching application:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const response = await api.post('/it-placement/apply', formData);
      setMessage({ text: response.data.message, type: 'success' });
      setApplication(response.data.data);
      setShowForm(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setMessage({
        text: error.response?.data?.message || 'Error submitting application',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return '#f59e0b';
      case 'Under Review': return '#3b82f6';
      case 'Matched': return '#8b5cf6';
      case 'Placed': return '#10b981';
      case 'Rejected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return <FiClock />;
      case 'Under Review': return <FiTrendingUp />;
      case 'Matched': case 'Placed': return <FiCheckCircle />;
      case 'Rejected': return <FiAlertCircle />;
      default: return <FiClock />;
    }
  };

  if (application) {
    return (
      <div className="it-placement-page">
        <SEO
          title="My IT Placement Application - NounPaddi"
          description={`Track your ${application.track} IT placement application status at NounPaddi. Current status: ${application.status}`}
          url="/it-placement"
          keywords="IT placement, industrial training, NOUN IT, tech training, internship tracking"
        />
        <div className="it-hero-section">
          <div className="container">
            <div className="hero-content">
              <div className="status-badge" style={{ background: getStatusColor(application.status) }}>
                {getStatusIcon(application.status)}
                <span>{application.status}</span>
              </div>
              <h1>Your IT Placement Application</h1>
              <p>Track your application status and placement details</p>
            </div>
          </div>
        </div>

        <div className="container">
          {message.text && (
            <div className={`alert alert-${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="application-details-grid">
            <div className="application-card">
              <div className="card-header">
                <h2>Personal Information</h2>
              </div>
              <div className="detail-row">
                <FiUser /> <span>Full Name:</span> <strong>{application.fullName}</strong>
              </div>
              <div className="detail-row">
                <FiMail /> <span>Email:</span> <strong>{application.email}</strong>
              </div>
              <div className="detail-row">
                <FiPhone /> <span>Phone:</span> <strong>{application.phone}</strong>
              </div>
              <div className="detail-row">
                <FiBookOpen /> <span>Department:</span> <strong>{application.department}</strong>
              </div>
              <div className="detail-row">
                <FiMapPin /> <span>Study Center:</span> <strong>{application.studyCenter}</strong>
              </div>
            </div>

            <div className="application-card">
              <div className="card-header">
                <h2>Training Details</h2>
              </div>
              <div className="detail-row">
                <FiCode /> <span>Track:</span> <strong>{application.track}</strong>
              </div>
              <div className="detail-row">
                <FiTrendingUp /> <span>Experience Level:</span> <strong>{application.experienceLevel}</strong>
              </div>
              <div className="detail-row">
                <FiCalendar /> <span>Duration:</span> <strong>{application.duration}</strong>
              </div>
              <div className="detail-row">
                <FiMapPin /> <span>Location Preference:</span> <strong>{application.locationPreference}</strong>
              </div>
              <div className="detail-row">
                <FiCheckCircle /> <span>Has Laptop:</span> <strong>{application.hasLaptop ? 'Yes' : 'No'}</strong>
              </div>
            </div>

            {application.status === 'Placed' && application.placementCompany && (
              <div className="application-card placement-card">
                <div className="card-header success-header">
                  <FiAward />
                  <h2>Placement Confirmed!</h2>
                </div>
                <div className="placement-details">
                  <p><strong>Company:</strong> {application.placementCompany}</p>
                  {application.placementDetails && (
                    <p><strong>Details:</strong> {application.placementDetails}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!showForm) {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "EducationalOccupationalProgram",
      "name": "NOUN IT Placement Program",
      "description": "Industrial Training placement program for National Open University of Nigeria (NOUN) students in technology fields including Frontend, Backend, Mobile App, Cloud Engineering, Full Stack, DevOps, and Data Science.",
      "provider": {
        "@type": "EducationalOrganization",
        "name": "NounPaddi",
        "url": "https://nounpaddi.com"
      },
      "occupationalCategory": [
        "Software Developer",
        "Web Developer",
        "Mobile App Developer",
        "Cloud Engineer",
        "DevOps Engineer",
        "Data Scientist"
      ],
      "timeToComplete": "P3M/P12M",
      "programType": "Internship",
      "educationalCredentialAwarded": "IT Placement Certificate",
      "availableLanguage": "English",
      "offers": {
        "@type": "Offer",
        "category": "Educational",
        "availability": "https://schema.org/InStock"
      }
    };

    return (
      <div className="it-placement-page">
        <SEO
          title="IT Placement Program for NOUN Students - NounPaddi"
          description="Apply for Industrial Training (IT) placement in tech fields: Frontend, Backend, Mobile App, Cloud Engineering. Get real-world experience while completing your NOUN IT requirements."
          url="/it-placement"
          keywords="NOUN IT placement, industrial training Nigeria, tech internship, NOUN industrial training, IT program NOUN, software development training, NounPaddi IT"
          structuredData={structuredData}
        />
        <div className="it-hero-section">
          <div className="container">
            <div className="hero-content">
              <h1 className="hero-title">NOUN IT Placement Program</h1>
              <p className="hero-subtitle">
                Get industry training and real-world experience in tech while completing your Industrial Training (IT)
              </p>
              <button onClick={() => setShowForm(true)} className="cta-button">
                Apply Now <FiArrowRight />
              </button>
            </div>
          </div>
        </div>

        <div className="container">
          {message.text && (
            <div className={`alert alert-${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="section">
            <h2 className="section-title">Choose Your Tech Track</h2>
            <div className="tracks-grid">
              {TECH_TRACKS.map(track => (
                <div
                  key={track.id}
                  className="track-card"
                  style={{ '--track-color': track.color }}
                >
                  <div className="track-icon" style={{ color: track.color }}>
                    {track.icon}
                  </div>
                  <h3>{track.name}</h3>
                  <p>{track.description}</p>
                  <div className="skills-list">
                    {track.skills.map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="section benefits-section">
            <h2 className="section-title">Program Benefits</h2>
            <div className="benefits-grid">
              <div className="benefit-card">
                <FiAward size={32} />
                <h3>Real-World Experience</h3>
                <p>Work on actual projects with industry mentors</p>
              </div>
              <div className="benefit-card">
                <FiTrendingUp size={32} />
                <h3>Skill Development</h3>
                <p>Learn in-demand tech skills from experts</p>
              </div>
              <div className="benefit-card">
                <FiCheckCircle size={32} />
                <h3>IT Credit Completion</h3>
                <p>Fulfill your NOUN IT requirements</p>
              </div>
              <div className="benefit-card">
                <FiGlobe size={32} />
                <h3>Remote Options</h3>
                <p>Flexible remote, on-site, or hybrid placements</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="it-placement-page">
      <SEO
        title="Apply for IT Placement - NounPaddi"
        description="Complete your IT placement application for NOUN. Choose your tech track and get matched with industry partners for hands-on training experience."
        url="/it-placement"
        keywords="IT placement application, NOUN IT form, apply for industrial training, tech training Nigeria"
      />
      <div className="form-container">
        <div className="form-header">
          <h1>IT Placement Application</h1>
          <button onClick={() => setShowForm(false)} className="close-button">
            <FiX />
          </button>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="it-placement-form">
          <div className="form-section">
            <h3>Personal Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Matric Number *</label>
                <input
                  type="text"
                  name="matricNumber"
                  value={formData.matricNumber}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Academic Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Department *</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Level *</label>
                <select name="level" value={formData.level} onChange={handleChange} required>
                  <option value="">Select Level</option>
                  <option value="200">200 Level</option>
                  <option value="300">300 Level</option>
                  <option value="400">400 Level</option>
                  <option value="500">500 Level</option>
                </select>
              </div>
              <div className="form-group">
                <label>Study Center *</label>
                <select name="studyCenter" value={formData.studyCenter} onChange={handleChange} required>
                  <option value="">Select Study Center</option>
                  {STUDY_CENTERS.map(center => (
                    <option key={center} value={center}>{center}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Training Preferences</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Tech Track *</label>
                <select name="track" value={formData.track} onChange={handleChange} required>
                  <option value="">Select Tech Track</option>
                  {TECH_TRACKS.map(track => (
                    <option key={track.id} value={track.id}>{track.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Experience Level *</label>
                <select name="experienceLevel" value={formData.experienceLevel} onChange={handleChange} required>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div className="form-group">
                <label>Preferred Duration *</label>
                <select name="duration" value={formData.duration} onChange={handleChange} required>
                  <option value="3 months">3 Months</option>
                  <option value="6 months">6 Months</option>
                  <option value="12 months">12 Months</option>
                </select>
              </div>
              <div className="form-group">
                <label>Location Preference *</label>
                <select name="locationPreference" value={formData.locationPreference} onChange={handleChange} required>
                  <option value="Remote">Remote</option>
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
              {formData.locationPreference !== 'Remote' && (
                <div className="form-group">
                  <label>Preferred Location</label>
                  <input
                    type="text"
                    name="preferredLocation"
                    value={formData.preferredLocation}
                    onChange={handleChange}
                    placeholder="e.g., Lagos, Abuja"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3>Technical Setup</h3>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="hasLaptop"
                  checked={formData.hasLaptop}
                  onChange={handleChange}
                />
                <span>I have a laptop for training</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="internetAccess"
                  checked={formData.internetAccess}
                  onChange={handleChange}
                />
                <span>I have reliable internet access</span>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3>Additional Information (Optional)</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  name="availableStartDate"
                  value={formData.availableStartDate}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="form-group">
                <label><FiGithub /> GitHub Profile</label>
                <input
                  type="url"
                  name="githubUrl"
                  value={formData.githubUrl}
                  onChange={handleChange}
                  placeholder="https://github.com/yourusername"
                />
              </div>
              <div className="form-group">
                <label><FiLinkedin /> LinkedIn Profile</label>
                <input
                  type="url"
                  name="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={handleChange}
                  placeholder="https://linkedin.com/in/yourname"
                />
              </div>
              <div className="form-group">
                <label><FiGlobe /> Portfolio URL</label>
                <input
                  type="url"
                  name="portfolioUrl"
                  value={formData.portfolioUrl}
                  onChange={handleChange}
                  placeholder="https://yourportfolio.com"
                />
              </div>
              <div className="form-group full-width">
                <label>Previous Experience (Optional)</label>
                <textarea
                  name="previousExperience"
                  value={formData.previousExperience}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Tell us about any previous tech experience, projects, or relevant skills..."
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ITPlacement;
