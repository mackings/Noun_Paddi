import React, { useEffect, useMemo, useState } from 'react';
import { FiBell, FiImage, FiLink2, FiMail, FiSend, FiSmartphone, FiType, FiUsers } from 'react-icons/fi';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import './AdminBroadcast.css';

const AdminBroadcast = () => {
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [channels, setChannels] = useState({
    push: true,
    email: false,
  });
  const [emailTarget, setEmailTarget] = useState('all');
  const [singleEmails, setSingleEmails] = useState(['', '', '']);
  const [deliveryMode, setDeliveryMode] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    url: '/explore',
  });

  useEffect(() => {
    trackFeatureVisit('admin_broadcast');
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const onBroadcastInputChange = (event) => {
    const { name, value } = event.target;
    setBroadcastForm((prev) => ({ ...prev, [name]: value }));
  };

  const selectedChannels = useMemo(() => {
    return Object.entries(channels)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);
  }, [channels]);

  const recipientSummary = useMemo(() => {
    if (!channels.email) return 'Push only';
    if (emailTarget === 'all') return 'Email to all students';
    const entered = singleEmails.map((item) => item.trim()).filter(Boolean).length;
    return `Email to ${entered || 0} specific recipient${entered === 1 ? '' : 's'}`;
  }, [channels.email, emailTarget, singleEmails]);

  const onImageFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setSelectedImageFile(file);
    setUploadedImageUrl('');
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const uploadNotificationImage = async () => {
    if (!selectedImageFile) {
      return uploadedImageUrl;
    }

    const formData = new FormData();
    formData.append('image', selectedImageFile);
    setUploadingImage(true);

    try {
      const response = await api.post('/admin/notifications/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const nextImageUrl = response?.data?.data?.imageUrl || '';
      setUploadedImageUrl(nextImageUrl);
      return nextImageUrl;
    } finally {
      setUploadingImage(false);
    }
  };

  const sendBroadcast = async (event) => {
    event.preventDefault();
    setSendingBroadcast(true);
    setBroadcastResult(null);

    try {
      if (selectedChannels.length === 0) {
        setBroadcastResult({
          type: 'error',
          text: 'Select at least one channel: Push Notification or Email.',
        });
        return;
      }

      const emails = singleEmails
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 3);

      if (channels.email && emailTarget === 'single' && emails.length === 0) {
        setBroadcastResult({
          type: 'error',
          text: 'Enter at least one email address for single email mode.',
        });
        return;
      }

      if (deliveryMode === 'schedule' && !scheduledAt) {
        setBroadcastResult({
          type: 'error',
          text: 'Select a schedule date and time.',
        });
        return;
      }

      let sendAt = '';
      if (deliveryMode === 'schedule') {
        const parsedDate = new Date(scheduledAt);
        if (Number.isNaN(parsedDate.getTime())) {
          setBroadcastResult({
            type: 'error',
            text: 'Invalid schedule date/time.',
          });
          return;
        }
        sendAt = parsedDate.toISOString();
      }

      const imageUrl = await uploadNotificationImage();
      const response = await api.post('/admin/notifications', {
        ...broadcastForm,
        imageUrl,
        channels: selectedChannels,
        emailTarget,
        emails,
        sendAt,
      });

      const scheduled = response?.data?.data?.scheduled;

      const pushResult = response?.data?.data?.push;
      const emailResult = response?.data?.data?.email;
      const errors = response?.data?.data?.errors || [];

      const pushText = pushResult
        ? `Push sent: ${pushResult.sent}/${pushResult.total}, failed: ${pushResult.failed}, removed: ${pushResult.removed}.`
        : null;
      const emailText = emailResult
        ? `Email sent: ${emailResult.sent}/${emailResult.total}, failed: ${emailResult.failed}.`
        : null;

      setBroadcastResult({
        type: errors.length > 0 ? 'error' : 'success',
        text: scheduled
          ? `Broadcast scheduled for ${new Date(response?.data?.data?.sendAt).toLocaleString()}.`
          : [pushText, emailText, ...errors].filter(Boolean).join(' '),
        scheduled,
        sendAt: response?.data?.data?.sendAt || null,
        pushResult: pushResult || null,
        emailResult: emailResult || null,
        errors,
      });
      setShowResultDialog(true);

      setBroadcastForm((prev) => ({ ...prev, title: '', message: '' }));
      setSelectedImageFile(null);
      setUploadedImageUrl('');
      setSingleEmails(['', '', '']);
      setScheduledAt('');
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImagePreviewUrl('');
    } catch (error) {
      setBroadcastResult({
        type: 'error',
        text: error?.response?.data?.message || 'Broadcast failed. Please try again.',
        errors: [error?.response?.data?.message || 'Broadcast failed.'],
      });
      setShowResultDialog(true);
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="admin-broadcast-page">
      <section className="broadcast-hero">
        <p className="broadcast-kicker">Admin Messaging</p>
        <h1>Broadcast Center</h1>
        <p>Send updates by push notification, email, or both from one control panel.</p>
      </section>

      <section className="broadcast-form-panel">
        <form className="broadcast-modern-form" onSubmit={sendBroadcast}>
          <div className="broadcast-main-col">
            <article className="broadcast-card">
              <h2>Message</h2>
              <div className="broadcast-modern-field">
                <label htmlFor="broadcast-title"><FiType /> Title</label>
                <input
                  id="broadcast-title"
                  name="title"
                  type="text"
                  value={broadcastForm.title}
                  onChange={onBroadcastInputChange}
                  placeholder="Important update for all students"
                  required
                  maxLength={120}
                />
              </div>

              <div className="broadcast-modern-field">
                <label htmlFor="broadcast-message"><FiBell /> Message</label>
                <textarea
                  id="broadcast-message"
                  name="message"
                  value={broadcastForm.message}
                  onChange={onBroadcastInputChange}
                  placeholder="Write what users should see in the push notification."
                  required
                  maxLength={300}
                  rows={5}
                />
                <small>{broadcastForm.message.length}/300</small>
              </div>

              <div className="broadcast-modern-field">
                <label htmlFor="broadcast-url"><FiLink2 /> Open URL</label>
                <input
                  id="broadcast-url"
                  name="url"
                  type="text"
                  value={broadcastForm.url}
                  onChange={onBroadcastInputChange}
                  placeholder="/explore"
                />
              </div>
            </article>

            <article className="broadcast-card">
              <h2>Audience & Channels</h2>
              <div className="broadcast-modern-field">
                <label><FiSend /> Delivery Channels</label>
                <div className="broadcast-channel-grid">
                  <label className={`broadcast-check ${channels.push ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={channels.push}
                      onChange={() => setChannels((prev) => ({ ...prev, push: !prev.push }))}
                    />
                    <span className="check-indicator" />
                    <FiSmartphone />
                    <span>Push Notification</span>
                  </label>
                  <label className={`broadcast-check ${channels.email ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={channels.email}
                      onChange={() => setChannels((prev) => ({ ...prev, email: !prev.email }))}
                    />
                    <span className="check-indicator" />
                    <FiMail />
                    <span>Email Notification</span>
                  </label>
                </div>
              </div>

              {channels.email && (
                <div className="broadcast-modern-field">
                  <label><FiUsers /> Email Target</label>
                  <div className="broadcast-target-row">
                    <label className={`broadcast-check compact ${emailTarget === 'all' ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={emailTarget === 'all'}
                        onChange={() => setEmailTarget('all')}
                      />
                      <span className="check-indicator" />
                      <span>All Students</span>
                    </label>
                    <label className={`broadcast-check compact ${emailTarget === 'single' ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={emailTarget === 'single'}
                        onChange={() => setEmailTarget('single')}
                      />
                      <span className="check-indicator" />
                      <span>Specific Emails</span>
                    </label>
                  </div>

                  {emailTarget === 'single' && (
                    <div className="broadcast-email-grid">
                      {singleEmails.map((email, index) => (
                        <input
                          key={`email-${index + 1}`}
                          type="email"
                          placeholder={`Recipient email ${index + 1}`}
                          value={email}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSingleEmails((prev) => prev.map((item, idx) => (idx === index ? value : item)));
                          }}
                        />
                      ))}
                      <small>Enter 1 to 3 email addresses.</small>
                    </div>
                  )}
                </div>
              )}
            </article>

            <article className="broadcast-card">
              <h2>Media</h2>
              <div className="broadcast-modern-field">
                <label htmlFor="broadcast-image-file"><FiImage /> Image (optional)</label>
                <input
                  id="broadcast-image-file"
                  name="image"
                  type="file"
                  accept="image/*"
                  onChange={onImageFileChange}
                />
                <small>JPG, PNG, WEBP. Max 5MB.</small>
                {imagePreviewUrl && (
                  <div className="broadcast-preview-shell">
                    <img src={imagePreviewUrl} alt="Broadcast preview" />
                  </div>
                )}
              </div>
            </article>
          </div>

          <aside className="broadcast-side-col">
            <article className="broadcast-card broadcast-sticky">
              <h2>Delivery</h2>
              <div className="broadcast-modern-field">
                <label><FiBell /> Delivery Time</label>
                <div className="broadcast-target-row">
                  <label className={`broadcast-check compact ${deliveryMode === 'now' ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={deliveryMode === 'now'}
                      onChange={() => setDeliveryMode('now')}
                    />
                    <span className="check-indicator" />
                    <span>Send Now</span>
                  </label>
                  <label className={`broadcast-check compact ${deliveryMode === 'schedule' ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={deliveryMode === 'schedule'}
                      onChange={() => setDeliveryMode('schedule')}
                    />
                    <span className="check-indicator" />
                    <span>Schedule</span>
                  </label>
                </div>
                {deliveryMode === 'schedule' && (
                  <div className="broadcast-email-grid">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                    />
                    <small>Uses your local time zone.</small>
                  </div>
                )}
              </div>

              <div className="broadcast-summary">
                <h3>Summary</h3>
                <p><strong>Channels:</strong> {selectedChannels.join(' + ') || 'None selected'}</p>
                <p><strong>Recipients:</strong> {recipientSummary}</p>
                <p><strong>Mode:</strong> {deliveryMode === 'schedule' ? 'Scheduled' : 'Immediate'}</p>
              </div>

              <button
                type="submit"
                className="btn btn-primary broadcast-submit-btn"
                disabled={sendingBroadcast || uploadingImage}
              >
                <FiSend />
                {sendingBroadcast || uploadingImage
                  ? 'Sending...'
                  : deliveryMode === 'schedule'
                    ? 'Schedule Broadcast'
                    : 'Send Broadcast'}
              </button>

              {broadcastResult && (
                <p className={`broadcast-status ${broadcastResult.type}`}>{broadcastResult.text}</p>
              )}
            </article>
          </aside>
        </form>
      </section>

      {showResultDialog && broadcastResult && (
        <div className="broadcast-result-overlay" role="dialog" aria-modal="true">
          <div className="broadcast-result-dialog">
            <h3>{broadcastResult.type === 'success' ? 'Broadcast Result' : 'Broadcast Error'}</h3>
            {broadcastResult.scheduled ? (
              <p className="result-main">
                Scheduled for <strong>{new Date(broadcastResult.sendAt).toLocaleString()}</strong>
              </p>
            ) : (
              <div className="result-grid">
                {broadcastResult.pushResult && (
                  <div className="result-card">
                    <h4>Push</h4>
                    <p>Sent: {broadcastResult.pushResult.sent}/{broadcastResult.pushResult.total}</p>
                    <p>Failed: {broadcastResult.pushResult.failed}</p>
                    <p>Removed: {broadcastResult.pushResult.removed}</p>
                  </div>
                )}
                {broadcastResult.emailResult && (
                  <div className="result-card">
                    <h4>Email</h4>
                    <p>Sent: {broadcastResult.emailResult.sent}/{broadcastResult.emailResult.total}</p>
                    <p>Failed: {broadcastResult.emailResult.failed}</p>
                  </div>
                )}
              </div>
            )}
            {Array.isArray(broadcastResult.errors) && broadcastResult.errors.length > 0 && (
              <div className="result-errors">
                {broadcastResult.errors.map((item, index) => (
                  <p key={`result-err-${index}`}>{item}</p>
                ))}
              </div>
            )}
            <div className="result-actions">
              <button type="button" className="btn btn-primary" onClick={() => setShowResultDialog(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBroadcast;
