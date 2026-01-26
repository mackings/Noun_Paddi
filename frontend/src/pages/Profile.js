import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCamera, FiUser, FiMail, FiBook, FiMapPin, FiLock, FiSave, FiLogOut, FiArrowLeft, FiMessageCircle, FiStar, FiSend } from 'react-icons/fi';
import api from '../utils/api';
import './Profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState({ type: '', text: '' });

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    bio: '',
    faculty: '',
    department: '',
    matricNumber: '',
    profileImage: '',
  });

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [imagePreview, setImagePreview] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [review, setReview] = useState({
    featureUsed: '',
    sentiment: 'positive',
    rating: 5,
    reasons: '',
    details: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      setProfile(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setMessage({ type: 'error', text: 'Failed to load profile' });
      setLoading(false);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile({ ...profile, [name]: value });
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswords({ ...passwords, [name]: value });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size should be less than 5MB' });
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('name', profile.name);
      formData.append('bio', profile.bio);
      formData.append('faculty', profile.faculty);
      formData.append('department', profile.department);
      formData.append('matricNumber', profile.matricNumber);

      if (selectedImage) {
        formData.append('profileImage', selectedImage);
      }

      const response = await api.put('/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setProfile(response.data.data);
      setImagePreview(null);
      setSelectedImage(null);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update profile',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      setSaving(false);
      return;
    }

    if (passwords.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      setSaving(false);
      return;
    }

    try {
      await api.put('/users/update-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });

      setPasswords({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setMessage({ type: 'success', text: 'Password updated successfully!' });
    } catch (error) {
      console.error('Error updating password:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update password',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleReviewChange = (field, value) => {
    setReview((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewSubmitting(true);
    setReviewMessage({ type: '', text: '' });

    try {
      await api.post('/reviews', review);
      setReviewMessage({ type: 'success', text: 'Thanks for your feedback! We appreciate it.' });
      setReview({
        featureUsed: '',
        sentiment: 'positive',
        rating: 5,
        reasons: '',
        details: '',
      });
    } catch (error) {
      setReviewMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to submit review. Please try again.',
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-spinner">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-wrapper">
        <div className="profile-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <FiArrowLeft size={20} />
            Back
          </button>
          <h1>My Profile</h1>
          <button className="logout-button" onClick={handleLogout}>
            <FiLogOut size={18} />
            Logout
          </button>
        </div>

        {message.text && (
          <div className={`message-banner ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="profile-content">
          <div className="profile-sidebar">
            <div className="profile-avatar-section">
              <div className="avatar-wrapper">
                <img
                  src={imagePreview || profile.profileImage || `https://ui-avatars.com/api/?name=${profile.name}&size=200&background=667eea&color=fff`}
                  alt={profile.name}
                  className="profile-avatar"
                />
                <label htmlFor="avatar-upload" className="avatar-upload-label">
                  <FiCamera size={20} />
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </div>
              <h2>{profile.name}</h2>
              <p className="profile-email">{profile.email}</p>
            </div>

            <nav className="profile-nav">
              <button
                className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <FiUser size={18} />
                Profile Information
              </button>
              <button
                className={`nav-item ${activeTab === 'password' ? 'active' : ''}`}
                onClick={() => setActiveTab('password')}
              >
                <FiLock size={18} />
                Change Password
              </button>
              <button
                className={`nav-item ${activeTab === 'review' ? 'active' : ''}`}
                onClick={() => setActiveTab('review')}
              >
                <FiMessageCircle size={18} />
                Send us a Review
              </button>
            </nav>
          </div>

          <div className="profile-main">
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileUpdate} className="profile-form">
                <h3>Profile Information</h3>

                <div className="form-group">
                  <label htmlFor="name">
                    <FiUser size={16} />
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={profile.name}
                    onChange={handleProfileChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">
                    <FiMail size={16} />
                    Email (Cannot be changed)
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={profile.email}
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bio">
                    <FiBook size={16} />
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={profile.bio}
                    onChange={handleProfileChange}
                    rows="4"
                    maxLength="500"
                    placeholder="Tell us about yourself..."
                  />
                  <small>{profile.bio.length}/500 characters</small>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="faculty">
                      <FiMapPin size={16} />
                      Faculty
                    </label>
                    <input
                      type="text"
                      id="faculty"
                      name="faculty"
                      value={profile.faculty}
                      onChange={handleProfileChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="department">
                      <FiBook size={16} />
                      Department
                    </label>
                    <input
                      type="text"
                      id="department"
                      name="department"
                      value={profile.department}
                      onChange={handleProfileChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="matricNumber">
                    <FiBook size={16} />
                    Matric Number
                  </label>
                  <input
                    type="text"
                    id="matricNumber"
                    name="matricNumber"
                    value={profile.matricNumber}
                    onChange={handleProfileChange}
                  />
                </div>

                <button type="submit" className="save-button" disabled={saving}>
                  <FiSave size={18} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            )}

            {activeTab === 'password' && (
              <form onSubmit={handlePasswordUpdate} className="profile-form">
                <h3>Change Password</h3>

                <div className="form-group">
                  <label htmlFor="currentPassword">
                    <FiLock size={16} />
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    name="currentPassword"
                    value={passwords.currentPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword">
                    <FiLock size={16} />
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={passwords.newPassword}
                    onChange={handlePasswordChange}
                    required
                    minLength="6"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">
                    <FiLock size={16} />
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={passwords.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    minLength="6"
                  />
                </div>

                <button type="submit" className="save-button" disabled={saving}>
                  <FiSave size={18} />
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}

            {activeTab === 'review' && (
              <form onSubmit={handleReviewSubmit} className="profile-form review-form">
                <h3>Send us a Review</h3>

                <div className="form-group">
                  <label htmlFor="featureUsed">Which feature did you use?</label>
                  <select
                    id="featureUsed"
                    value={review.featureUsed}
                    onChange={(e) => handleReviewChange('featureUsed', e.target.value)}
                    required
                  >
                    <option value="">Select a feature</option>
                    <option value="Course Summaries">Course Summaries</option>
                    <option value="Practice Exams">Practice Exams</option>
                    <option value="POP Exams">POP Exams</option>
                    <option value="Projects Topics">Project Topics</option>
                    <option value="Plagiarism Check">Plagiarism Check</option>
                    <option value="Project Consultation">Project Consultation</option>
                    <option value="IT Placement">IT Placement</option>
                    <option value="Reminders">Reminders</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>How was your experience?</label>
                  <div className="review-sentiment">
                    {['positive', 'neutral', 'negative'].map((option) => (
                      <label key={option} className={`sentiment-chip ${review.sentiment === option ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="sentiment"
                          value={option}
                          checked={review.sentiment === option}
                          onChange={(e) => handleReviewChange('sentiment', e.target.value)}
                        />
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Your rating</label>
                  <div className="review-rating">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={`star-button ${review.rating >= value ? 'active' : ''}`}
                        onClick={() => handleReviewChange('rating', value)}
                        aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                      >
                        <FiStar />
                      </button>
                    ))}
                    <span className="rating-label">{review.rating}/5</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reasons">Why did you rate it this way?</label>
                  <textarea
                    id="reasons"
                    value={review.reasons}
                    onChange={(e) => handleReviewChange('reasons', e.target.value)}
                    rows="4"
                    required
                    placeholder="Tell us what worked well or what needs improvement."
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="details">More details (optional)</label>
                  <textarea
                    id="details"
                    value={review.details}
                    onChange={(e) => handleReviewChange('details', e.target.value)}
                    rows="3"
                    placeholder="Extra context or suggestions."
                  />
                </div>

                {reviewMessage.text && (
                  <div className={`message-banner ${reviewMessage.type}`}>
                    {reviewMessage.text}
                  </div>
                )}

                <button type="submit" className="save-button" disabled={reviewSubmitting}>
                  <FiSend size={18} />
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
