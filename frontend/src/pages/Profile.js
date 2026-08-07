import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, User, Mail, BookOpen, MapPin, Lock, Save, LogOut, MessageCircle, Star, Send, Loader2 } from 'lucide-react';
import api from '../utils/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import ShellHeader from '../shell/ShellHeader';
import { cn } from '../lib/utils';

const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe',
  'Zamfara', 'Federal Capital Territory (FCT)',
];
const OTHER_STUDY_CENTER_OPTION = '__other__';

const TABS = [
  { id: 'profile', label: 'Profile Information', icon: User },
  { id: 'password', label: 'Change Password', icon: Lock },
  { id: 'review', label: 'Send us a Review', icon: MessageCircle },
];

const selectClass = 'tw:h-11 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';
const textareaClass = 'tw:w-full tw:resize-none tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState({ type: '', text: '' });
  const [showStudyCenterDialog, setShowStudyCenterDialog] = useState(false);
  const [studyCenterSelection, setStudyCenterSelection] = useState('');
  const [customStudyCenter, setCustomStudyCenter] = useState('');
  const [studyCenterSaving, setStudyCenterSaving] = useState(false);

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    bio: '',
    faculty: '',
    department: '',
    studyCenter: '',
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

  const syncCachedUser = (updates) => {
    try {
      const cached = localStorage.getItem('user');
      if (!cached) return;
      const parsed = JSON.parse(cached);
      const next = { ...parsed, ...updates };
      localStorage.setItem('user', JSON.stringify(next));
    } catch (error) {
      // Ignore cache sync failures
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      const nextProfile = response.data.data || {};
      setProfile(nextProfile);
      const hasStudyCenter = String(nextProfile.studyCenter || '').trim().length > 0;
      setShowStudyCenterDialog(!hasStudyCenter);
      if (!hasStudyCenter) {
        setStudyCenterSelection('');
        setCustomStudyCenter('');
      }
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
      formData.append('studyCenter', profile.studyCenter);
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
      if (String(response.data?.data?.studyCenter || '').trim()) {
        setShowStudyCenterDialog(false);
        syncCachedUser({ studyCenter: response.data.data.studyCenter });
      }
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

  const handleStudyCenterDialogSave = async () => {
    const resolvedStudyCenter =
      studyCenterSelection === OTHER_STUDY_CENTER_OPTION
        ? customStudyCenter.trim()
        : studyCenterSelection.trim();

    if (!resolvedStudyCenter) {
      setMessage({ type: 'error', text: 'Please choose or enter your study center.' });
      return;
    }

    try {
      setStudyCenterSaving(true);
      await api.put('/users/profile', { studyCenter: resolvedStudyCenter });
      setProfile((prev) => ({ ...prev, studyCenter: resolvedStudyCenter }));
      setShowStudyCenterDialog(false);
      syncCachedUser({ studyCenter: resolvedStudyCenter });
      setMessage({ type: 'success', text: 'Study center updated successfully.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to update study center.',
      });
    } finally {
      setStudyCenterSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="np-shell tw:flex tw:flex-col tw:items-center tw:gap-2 tw:py-16 tw:text-slate-500 tw:dark:text-slate-400">
        <Loader2 className="tw:h-6 tw:w-6 tw:animate-spin" />
        <p className="tw:text-sm">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="np-shell">
      <ShellHeader title="My Profile" />
      <div className="tw:space-y-4 tw:p-4">
      <div className="tw:flex tw:justify-end">
        <button
          type="button"
          onClick={handleLogout}
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-xl tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300"
        >
          <LogOut className="tw:h-3.5 tw:w-3.5" /> Logout
        </button>
      </div>

      {message.text && (
        <div
          className={cn(
            'tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm',
            message.type === 'success'
              ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
              : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
          )}
        >
          {message.text}
        </div>
      )}

      <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-5 tw:text-center">
        <div className="tw:relative">
          <img
            src={imagePreview || profile.profileImage || `https://ui-avatars.com/api/?name=${profile.name}&size=200&background=4f46e5&color=fff`}
            alt={profile.name}
            className="tw:h-20 tw:w-20 tw:rounded-full tw:object-cover"
          />
          <label
            htmlFor="avatar-upload"
            className="tw:absolute tw:right-0 tw:bottom-0 tw:flex tw:h-7 tw:w-7 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-600 tw:text-white tw:ring-2 tw:ring-white tw:dark:ring-slate-900"
          >
            <Camera className="tw:h-3.5 tw:w-3.5" />
          </label>
          <input id="avatar-upload" type="file" accept="image/*" onChange={handleImageSelect} className="tw:hidden" />
        </div>
        <h2 className="tw:font-heading tw:text-base tw:font-bold">{profile.name}</h2>
        <p className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{profile.email}</p>
      </Card>

      <div className="tw:flex tw:gap-2 tw:overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'tw:flex tw:flex-none tw:items-center tw:gap-1.5 tw:rounded-xl tw:border tw:px-3 tw:py-2 tw:text-xs tw:font-semibold tw:whitespace-nowrap tw:transition-colors',
              activeTab === id
                ? 'tw:border-brand-600 tw:bg-brand-600 tw:text-white'
                : 'tw:border-slate-200 tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300',
            )}
          >
            <Icon className="tw:h-3.5 tw:w-3.5" /> {label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="tw:p-5">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="tw:space-y-4">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><User className="tw:h-3.5 tw:w-3.5" /> Full Name</span>
                <Input type="text" name="name" value={profile.name} onChange={handleProfileChange} required />
              </label>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Mail className="tw:h-3.5 tw:w-3.5" /> Email (Cannot be changed)</span>
                <Input type="email" name="email" value={profile.email} disabled />
              </label>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><BookOpen className="tw:h-3.5 tw:w-3.5" /> Bio</span>
                <textarea
                  name="bio"
                  value={profile.bio}
                  onChange={handleProfileChange}
                  rows={4}
                  maxLength={500}
                  placeholder="Tell us about yourself..."
                  className={textareaClass}
                />
                <small className="tw:text-xs tw:text-slate-400">{profile.bio.length}/500 characters</small>
              </label>

              <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><MapPin className="tw:h-3.5 tw:w-3.5" /> Faculty</span>
                  <Input type="text" name="faculty" value={profile.faculty} onChange={handleProfileChange} />
                </label>
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><BookOpen className="tw:h-3.5 tw:w-3.5" /> Department</span>
                  <Input type="text" name="department" value={profile.department} onChange={handleProfileChange} />
                </label>
              </div>

              <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><MapPin className="tw:h-3.5 tw:w-3.5" /> Study Center</span>
                  <select name="studyCenter" value={profile.studyCenter || ''} onChange={handleProfileChange} required className={selectClass}>
                    <option value="">Select your study center</option>
                    {NIGERIA_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                  </select>
                </label>
                <label className="tw:block tw:space-y-1.5">
                  <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><BookOpen className="tw:h-3.5 tw:w-3.5" /> Matric Number</span>
                  <Input type="text" name="matricNumber" value={profile.matricNumber} onChange={handleProfileChange} />
                </label>
              </div>

              <Button type="submit" disabled={saving} className="tw:w-full">
                <Save className="tw:h-4 tw:w-4" /> {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordUpdate} className="tw:space-y-4">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Lock className="tw:h-3.5 tw:w-3.5" /> Current Password</span>
                <Input type="password" name="currentPassword" value={passwords.currentPassword} onChange={handlePasswordChange} required />
              </label>
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Lock className="tw:h-3.5 tw:w-3.5" /> New Password</span>
                <Input type="password" name="newPassword" value={passwords.newPassword} onChange={handlePasswordChange} required minLength={6} />
              </label>
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Lock className="tw:h-3.5 tw:w-3.5" /> Confirm New Password</span>
                <Input type="password" name="confirmPassword" value={passwords.confirmPassword} onChange={handlePasswordChange} required minLength={6} />
              </label>

              <Button type="submit" disabled={saving} className="tw:w-full">
                <Save className="tw:h-4 tw:w-4" /> {saving ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}

          {activeTab === 'review' && (
            <form onSubmit={handleReviewSubmit} className="tw:space-y-4">
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Which feature did you use?</span>
                <select
                  value={review.featureUsed}
                  onChange={(e) => handleReviewChange('featureUsed', e.target.value)}
                  required
                  className={selectClass}
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
              </label>

              <div className="tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">How was your experience?</span>
                <div className="tw:flex tw:gap-2">
                  {['positive', 'neutral', 'negative'].map((option) => (
                    <label
                      key={option}
                      className={cn(
                        'tw:flex-1 tw:cursor-pointer tw:rounded-xl tw:border tw:px-3 tw:py-2 tw:text-center tw:text-xs tw:font-semibold tw:transition-colors',
                        review.sentiment === option
                          ? 'tw:border-brand-600 tw:bg-brand-600 tw:text-white'
                          : 'tw:border-slate-200 tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300',
                      )}
                    >
                      <input
                        type="radio"
                        name="sentiment"
                        value={option}
                        checked={review.sentiment === option}
                        onChange={(e) => handleReviewChange('sentiment', e.target.value)}
                        className="tw:hidden"
                      />
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Your rating</span>
                <div className="tw:flex tw:items-center tw:gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => handleReviewChange('rating', value)}
                      aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                      className={cn('tw:p-0.5', review.rating >= value ? 'tw:text-amber-400' : 'tw:text-slate-200 tw:dark:text-slate-700')}
                    >
                      <Star className="tw:h-6 tw:w-6" fill="currentColor" />
                    </button>
                  ))}
                  <span className="tw:ml-1 tw:text-xs tw:text-slate-400">{review.rating}/5</span>
                </div>
              </div>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Why did you rate it this way?</span>
                <textarea
                  value={review.reasons}
                  onChange={(e) => handleReviewChange('reasons', e.target.value)}
                  rows={4}
                  required
                  placeholder="Tell us what worked well or what needs improvement."
                  className={textareaClass}
                />
              </label>

              <label className="tw:block tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">More details (optional)</span>
                <textarea
                  value={review.details}
                  onChange={(e) => handleReviewChange('details', e.target.value)}
                  rows={3}
                  placeholder="Extra context or suggestions."
                  className={textareaClass}
                />
              </label>

              {reviewMessage.text && (
                <div
                  className={cn(
                    'tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-sm',
                    reviewMessage.type === 'success'
                      ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                      : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
                  )}
                >
                  {reviewMessage.text}
                </div>
              )}

              <Button type="submit" disabled={reviewSubmitting} className="tw:w-full">
                <Send className="tw:h-4 tw:w-4" /> {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      </div>

      <Dialog open={showStudyCenterDialog} onOpenChange={setShowStudyCenterDialog}>
        <DialogPopup showClose={false}>
          <DialogHeader>
            <DialogTitle>Update Your Study Center</DialogTitle>
            <DialogDescription>
              Your profile is missing a study center. Please update it so your account information is complete.
            </DialogDescription>
          </DialogHeader>

          <div className="tw:mt-4 tw:space-y-3">
            <label className="tw:block tw:space-y-1.5">
              <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><MapPin className="tw:h-3.5 tw:w-3.5" /> Choose Study Center</span>
              <select
                value={studyCenterSelection}
                onChange={(e) => setStudyCenterSelection(e.target.value)}
                className={selectClass}
              >
                <option value="">Select your study center</option>
                {NIGERIA_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                <option value={OTHER_STUDY_CENTER_OPTION}>Other (write manually)</option>
              </select>
            </label>

            {studyCenterSelection === OTHER_STUDY_CENTER_OPTION && (
              <label className="tw:block tw:space-y-1.5">
                <span className="tw:flex tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><MapPin className="tw:h-3.5 tw:w-3.5" /> Enter Study Center</span>
                <Input type="text" value={customStudyCenter} onChange={(e) => setCustomStudyCenter(e.target.value)} placeholder="Type your study center" />
              </label>
            )}

            <Button type="button" onClick={handleStudyCenterDialogSave} disabled={studyCenterSaving} className="tw:w-full">
              {studyCenterSaving ? 'Saving...' : 'Save Study Center'}
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
    </div>
  );
};

export default Profile;
