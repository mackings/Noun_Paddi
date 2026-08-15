import React, { useEffect, useMemo, useState } from 'react';
import { Bell, PenSquare, Image, Link2, Mail, Send, Smartphone, Type, Users, Loader2 } from 'lucide-react';
import api from '../utils/api';
import { trackFeatureVisit } from '../utils/featureTracking';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { cn } from '../lib/utils';

const textareaClass = 'tw:w-full tw:resize-none tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100';

const ChoiceChip = ({ active, icon: Icon, label, onChange, compact }) => (
  <label className={cn(
    'tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:px-3 tw:text-sm tw:font-semibold tw:transition-colors',
    compact ? 'tw:py-2' : 'tw:py-2.5',
    active
      ? 'tw:border-brand-600 tw:bg-brand-50 tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300'
      : 'tw:border-slate-200 tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300',
  )}>
    <input type="checkbox" checked={active} onChange={onChange} className="tw:hidden" />
    {Icon && <Icon className="tw:h-4 tw:w-4" />}
    <span>{label}</span>
  </label>
);

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
    <div className="tw:space-y-5">
      <div>
        <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase">Admin Messaging</p>
        <h1 className="tw:font-heading tw:text-xl tw:font-bold tw:tracking-tight">Broadcast Center</h1>
        <p className="tw:mt-1 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Send updates by push notification, email, or both from one control panel.</p>
      </div>

      <form onSubmit={sendBroadcast} className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-[1.4fr_1fr]">
        <Card className="tw:space-y-5 tw:p-5">
          <div className="tw:space-y-3">
            <p className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase"><PenSquare className="tw:h-3.5 tw:w-3.5" /> Content</p>
            <label className="tw:block tw:space-y-1.5">
              <span className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Type className="tw:h-3.5 tw:w-3.5" /> Title</span>
              <Input
                id="broadcast-title"
                name="title"
                type="text"
                value={broadcastForm.title}
                onChange={onBroadcastInputChange}
                placeholder="Important update for all students"
                required
                maxLength={120}
              />
            </label>

            <label className="tw:block tw:space-y-1.5">
              <span className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Bell className="tw:h-3.5 tw:w-3.5" /> Message</span>
              <textarea
                id="broadcast-message"
                name="message"
                value={broadcastForm.message}
                onChange={onBroadcastInputChange}
                placeholder="Write what users should see in the push notification."
                required
                maxLength={300}
                rows={5}
                className={textareaClass}
              />
              <small className="tw:text-xs tw:text-slate-400">{broadcastForm.message.length}/300</small>
            </label>

            <label className="tw:block tw:space-y-1.5">
              <span className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300"><Link2 className="tw:h-3.5 tw:w-3.5" /> Open URL</span>
              <Input
                id="broadcast-url"
                name="url"
                type="text"
                value={broadcastForm.url}
                onChange={onBroadcastInputChange}
                placeholder="/explore"
              />
            </label>
          </div>

          <div className="tw:border-t tw:border-slate-200/70 tw:pt-4 tw:dark:border-slate-800">
            <p className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase"><Image className="tw:h-3.5 tw:w-3.5" /> Media</p>
            <label htmlFor="broadcast-image-file" className="tw:mt-2 tw:block tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Image (optional)</span>
              <div className="tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:p-4 tw:dark:border-slate-700">
                <input
                  id="broadcast-image-file"
                  name="image"
                  type="file"
                  accept="image/*"
                  onChange={onImageFileChange}
                  className="tw:block tw:w-full tw:text-sm tw:text-slate-500 tw:dark:text-slate-400"
                />
                <small className="tw:mt-1 tw:block tw:text-xs tw:text-slate-400">JPG, PNG, WEBP. Max 5MB. Shown in the live preview.</small>
              </div>
            </label>
          </div>

          <div className="tw:border-t tw:border-slate-200/70 tw:pt-4 tw:dark:border-slate-800">
            <p className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase"><Users className="tw:h-3.5 tw:w-3.5" /> Audience & Channels</p>
            <div className="tw:mt-2 tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Delivery Channels</span>
              <div className="tw:grid tw:grid-cols-2 tw:gap-2">
                <ChoiceChip active={channels.push} icon={Smartphone} label="Push Notification" onChange={() => setChannels((prev) => ({ ...prev, push: !prev.push }))} />
                <ChoiceChip active={channels.email} icon={Mail} label="Email Notification" onChange={() => setChannels((prev) => ({ ...prev, email: !prev.email }))} />
              </div>
            </div>

            {channels.email && (
              <div className="tw:mt-3 tw:space-y-1.5">
                <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Email Target</span>
                <div className="tw:flex tw:gap-2">
                  <ChoiceChip compact active={emailTarget === 'all'} label="All Students" onChange={() => setEmailTarget('all')} />
                  <ChoiceChip compact active={emailTarget === 'single'} label="Specific Emails" onChange={() => setEmailTarget('single')} />
                </div>

                {emailTarget === 'single' && (
                  <div className="tw:space-y-2 tw:pt-1">
                    {singleEmails.map((email, index) => (
                      <Input
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
                    <small className="tw:text-xs tw:text-slate-400">Enter 1 to 3 email addresses.</small>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="tw:border-t tw:border-slate-200/70 tw:pt-4 tw:dark:border-slate-800">
            <p className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase"><Send className="tw:h-3.5 tw:w-3.5" /> Delivery Timing</p>
            <div className="tw:mt-2 tw:flex tw:gap-2">
              <ChoiceChip compact active={deliveryMode === 'now'} label="Send Now" onChange={() => setDeliveryMode('now')} />
              <ChoiceChip compact active={deliveryMode === 'schedule'} label="Schedule" onChange={() => setDeliveryMode('schedule')} />
            </div>
            {deliveryMode === 'schedule' && (
              <div className="tw:mt-2 tw:space-y-1">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className="tw:h-10 tw:w-full tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100"
                />
                <small className="tw:text-xs tw:text-slate-400">Uses your local time zone.</small>
              </div>
            )}
          </div>
        </Card>

        <aside className="tw:space-y-4">
          <Card className="tw:space-y-3 tw:p-5">
            <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-slate-400 tw:uppercase">Live Preview</p>
            <div className="tw:rounded-2xl tw:border tw:border-slate-200/70 tw:bg-slate-50 tw:p-3 tw:dark:border-slate-800 tw:dark:bg-slate-900">
              <div className="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-slate-400">
                <span className="tw:flex tw:h-5 tw:w-5 tw:items-center tw:justify-center tw:rounded tw:bg-brand-600 tw:text-white"><Bell className="tw:h-3 tw:w-3" /></span>
                <span className="tw:font-semibold tw:text-slate-600 tw:dark:text-slate-300">NounPaddi</span>
                <span>now</span>
              </div>
              <p className={cn('tw:mt-2 tw:text-sm tw:font-bold', !broadcastForm.title && 'tw:text-slate-400 tw:font-normal')}>
                {broadcastForm.title || 'Your notification title'}
              </p>
              <p className={cn('tw:mt-0.5 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400', !broadcastForm.message && 'tw:text-slate-400')}>
                {broadcastForm.message || 'Your message will appear here as you type.'}
              </p>
              {imagePreviewUrl && (
                <img src={imagePreviewUrl} alt="Broadcast preview" className="tw:mt-2 tw:w-full tw:rounded-lg tw:object-cover" />
              )}
            </div>

            {channels.email && (
              <>
                <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-slate-400 tw:uppercase">Email Preview</p>
                <div className="tw:rounded-2xl tw:border tw:border-slate-200/70 tw:p-3 tw:dark:border-slate-800">
                  <p className="tw:text-sm tw:font-bold">{broadcastForm.title || 'Subject line'}</p>
                  <p className="tw:mt-1 tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">{broadcastForm.message || 'Email body preview will appear here as you type.'}</p>
                </div>
              </>
            )}
          </Card>

          <Card className="tw:space-y-3 tw:p-5">
            <div className="tw:flex tw:flex-wrap tw:gap-2">
              <span className="tw:flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300"><Send className="tw:h-3 tw:w-3" /> {selectedChannels.join(' + ') || 'No channel'}</span>
              <span className="tw:flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300"><Users className="tw:h-3 tw:w-3" /> {recipientSummary}</span>
              <span className="tw:flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-slate-600 tw:dark:bg-slate-800 tw:dark:text-slate-300"><Bell className="tw:h-3 tw:w-3" /> {deliveryMode === 'schedule' ? 'Scheduled' : 'Immediate'}</span>
            </div>

            <Button type="submit" disabled={sendingBroadcast || uploadingImage} className="tw:w-full">
              {sendingBroadcast || uploadingImage ? <Loader2 className="tw:h-4 tw:w-4 tw:animate-spin" /> : <Send className="tw:h-4 tw:w-4" />}
              {sendingBroadcast || uploadingImage
                ? 'Sending...'
                : deliveryMode === 'schedule'
                  ? 'Schedule Broadcast'
                  : 'Send Broadcast'}
            </Button>

            {broadcastResult && (
              <p className={cn(
                'tw:rounded-xl tw:px-3 tw:py-2 tw:text-xs',
                broadcastResult.type === 'success'
                  ? 'tw:bg-emerald-100 tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300'
                  : 'tw:bg-red-100 tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300',
              )}>{broadcastResult.text}</p>
            )}
          </Card>
        </aside>
      </form>

      <Dialog open={showResultDialog && !!broadcastResult} onOpenChange={setShowResultDialog}>
        <DialogPopup>
          {broadcastResult && (
            <>
              <DialogHeader>
                <DialogTitle>{broadcastResult.type === 'success' ? 'Broadcast Result' : 'Broadcast Error'}</DialogTitle>
              </DialogHeader>
              {broadcastResult.scheduled ? (
                <p className="tw:mt-2 tw:text-sm">
                  Scheduled for <strong>{new Date(broadcastResult.sendAt).toLocaleString()}</strong>
                </p>
              ) : (
                <div className="tw:mt-2 tw:grid tw:grid-cols-2 tw:gap-3">
                  {broadcastResult.pushResult && (
                    <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:text-xs tw:dark:bg-slate-900">
                      <h4 className="tw:text-sm tw:font-bold">Push</h4>
                      <p>Sent: {broadcastResult.pushResult.sent}/{broadcastResult.pushResult.total}</p>
                      <p>Failed: {broadcastResult.pushResult.failed}</p>
                      <p>Removed: {broadcastResult.pushResult.removed}</p>
                    </div>
                  )}
                  {broadcastResult.emailResult && (
                    <div className="tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:text-xs tw:dark:bg-slate-900">
                      <h4 className="tw:text-sm tw:font-bold">Email</h4>
                      <p>Sent: {broadcastResult.emailResult.sent}/{broadcastResult.emailResult.total}</p>
                      <p>Failed: {broadcastResult.emailResult.failed}</p>
                    </div>
                  )}
                </div>
              )}
              {Array.isArray(broadcastResult.errors) && broadcastResult.errors.length > 0 && (
                <div className="tw:mt-2 tw:space-y-1">
                  {broadcastResult.errors.map((item, index) => (
                    <p key={`result-err-${index}`} className="tw:text-xs tw:text-red-600 tw:dark:text-red-400">{item}</p>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button type="button" onClick={() => setShowResultDialog(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogPopup>
      </Dialog>
    </div>
  );
};

export default AdminBroadcast;
