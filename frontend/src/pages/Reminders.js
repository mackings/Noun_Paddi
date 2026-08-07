import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Music2, Clock } from 'lucide-react';
import ShellHeader from '../shell/ShellHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog, DialogPopup, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../components/ui/dialog';
import { cn } from '../lib/utils';

const Reminders = () => {
  const [reminders, setReminders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [currentReminderTitle, setCurrentReminderTitle] = useState('');
  const [formData, setFormData] = useState({
    title: 'Reading Time',
    days: [],
    time: '09:00',
  });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const response = await api.get('/reminders');
      setReminders(response.data.data);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    }
  };

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.days.length === 0) {
      alert('Please select at least one day');
      return;
    }

    try {
      setLoading(true);
      await api.post('/reminders', formData);
      await fetchReminders();
      setShowModal(false);
      setFormData({
        title: 'Reading Time',
        days: [],
        time: '09:00',
      });

      // Schedule browser notifications
      scheduleNotifications(formData);
    } catch (error) {
      console.error('Error creating reminder:', error);
      alert('Failed to create reminder');
    } finally {
      setLoading(false);
    }
  };

  const scheduleNotifications = (reminder) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    // This would ideally be handled by a service worker for persistent reminders
    // For now, we'll set up immediate notifications when the time matches
    const checkAndNotify = () => {
      const now = new Date();
      const currentDay = daysOfWeek[now.getDay() === 0 ? 6 : now.getDay() - 1];
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (reminder.days.includes(currentDay) && reminder.time === currentTime) {
        playObleeAndNotify(reminder.title);
      }
    };

    // Check every minute
    setInterval(checkAndNotify, 60000);
  };

  const stopAlarm = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    setIsRinging(false);
    setCurrentReminderTitle('');
  };

  const playObleeAndNotify = (title) => {
    // Set ringing state
    setIsRinging(true);
    setCurrentReminderTitle(title);

    // Play notification sound - using a reliable audio source
    // You can replace this URL with Oblee by DJ YK once you upload it to your server
    const audioUrl = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
    const audio = new Audio(audioUrl);
    audio.loop = true; // Loop the audio
    setCurrentAudio(audio);

    audio.play().catch(err => {
      console.log('Audio play failed:', err);
      // Fallback: Create repeating beep with Web Audio API
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        let beepInterval;

        const playBeep = () => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.3);
        };

        // Play beep every 1 second
        playBeep();
        beepInterval = setInterval(playBeep, 1000);

        // Store interval ID for cleanup
        setCurrentAudio({
          pause: () => clearInterval(beepInterval),
          currentTime: 0
        });
      } catch (error) {
        console.log('Fallback audio also failed:', error);
      }
    });

    // Show notification
    if (Notification.permission === 'granted') {
      new Notification('📚 ' + title, {
        body: 'Time to read! Your reminder is ringing 🎵 Click "Stop Alarm" to dismiss.',
        icon: '/nounpaddi-icon.svg',
        badge: '/nounpaddi-icon.svg',
        requireInteraction: true,
      });
    }

    // Auto-stop alarm after 1 minute
    setTimeout(() => {
      if (currentAudio) {
        stopAlarm();
      }
    }, 60000);
  };

  const toggleReminder = async (id) => {
    try {
      await api.patch(`/reminders/${id}/toggle`);
      await fetchReminders();
    } catch (error) {
      console.error('Error toggling reminder:', error);
    }
  };

  const deleteReminder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this reminder?')) {
      return;
    }

    try {
      await api.delete(`/reminders/${id}`);
      await fetchReminders();
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  return (
    <div className="np-shell">
      <ShellHeader title="Reading Reminders" />

      {isRinging && (
        <div className="tw:fixed tw:inset-0 tw:z-50 tw:flex tw:items-center tw:justify-center tw:bg-slate-950/70 tw:p-6">
          <Card className="tw:flex tw:max-w-xs tw:flex-col tw:items-center tw:gap-3 tw:p-6 tw:text-center">
            <Bell className="tw:h-14 tw:w-14 tw:animate-pulse tw:text-brand-600 tw:dark:text-brand-400" />
            <h2 className="tw:font-heading tw:text-lg tw:font-bold">⏰ {currentReminderTitle}</h2>
            <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Time to study! Your reminder is ringing.</p>
            <Button variant="destructive" size="lg" className="tw:w-full" onClick={stopAlarm}>
              Stop Alarm
            </Button>
          </Card>
        </div>
      )}

      <div className="tw:space-y-4 tw:p-4">
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
          <div>
            <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Set up reminders to stay on track with your studies.</p>
            <p className="tw:mt-1 tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400">
              <Music2 className="tw:h-3.5 tw:w-3.5" /> Get notified with sound alerts
            </p>
          </div>
          <Button size="icon" onClick={() => setShowModal(true)} aria-label="New reminder">
            <Plus className="tw:h-4 tw:w-4" />
          </Button>
        </div>

        {reminders.length === 0 ? (
          <Card className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:p-10 tw:text-center">
            <Bell className="tw:h-10 tw:w-10 tw:text-slate-300 tw:dark:text-slate-600" />
            <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">No reminders yet. Create your first reminder to get started!</p>
          </Card>
        ) : (
          <div className="tw:space-y-3">
            {reminders.map((reminder) => (
              <Card key={reminder._id} className={cn('tw:p-4', !reminder.isActive && 'tw:opacity-60')}>
                <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
                  <h3 className="tw:font-heading tw:text-sm tw:font-bold">{reminder.title}</h3>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <button
                      type="button"
                      onClick={() => toggleReminder(reminder._id)}
                      title={reminder.isActive ? 'Disable' : 'Enable'}
                      className={cn(
                        'tw:rounded-lg tw:p-1.5 tw:transition-colors',
                        reminder.isActive ? 'tw:text-brand-600 tw:dark:text-brand-400' : 'tw:text-slate-300 tw:dark:text-slate-600',
                      )}
                    >
                      {reminder.isActive ? <ToggleRight className="tw:h-5 tw:w-5" /> : <ToggleLeft className="tw:h-5 tw:w-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteReminder(reminder._id)}
                      title="Delete"
                      className="tw:rounded-lg tw:p-1.5 tw:text-slate-400 tw:transition-colors tw:hover:bg-red-50 tw:hover:text-red-600 tw:dark:hover:bg-red-500/10 tw:dark:hover:text-red-400"
                    >
                      <Trash2 className="tw:h-4 tw:w-4" />
                    </button>
                  </div>
                </div>

                <div className="tw:mt-2 tw:flex tw:items-center tw:gap-1.5 tw:text-sm tw:font-semibold tw:text-slate-700 tw:dark:text-slate-200">
                  <Clock className="tw:h-3.5 tw:w-3.5" /> {reminder.time}
                </div>

                <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-1.5">
                  {daysOfWeek.map(day => (
                    <span
                      key={day}
                      className={cn(
                        'tw:rounded-full tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-semibold',
                        reminder.days.includes(day)
                          ? 'tw:bg-brand-100 tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300'
                          : 'tw:bg-slate-100 tw:text-slate-400 tw:dark:bg-slate-800 tw:dark:text-slate-500',
                      )}
                    >
                      {day.substring(0, 3)}
                    </span>
                  ))}
                </div>

                <div className="tw:mt-3 tw:flex tw:items-center tw:gap-1.5 tw:border-t tw:border-slate-100 tw:pt-3 tw:text-xs tw:text-slate-400 tw:dark:border-slate-800">
                  <Music2 className="tw:h-3.5 tw:w-3.5" /> Notification sound will play
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Create New Reminder</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="tw:mt-4 tw:space-y-4">
            <label className="tw:block tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Title</span>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Reading Time"
                required
              />
            </label>

            <label className="tw:block tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Time</span>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
              />
            </label>

            <div className="tw:space-y-1.5">
              <span className="tw:text-xs tw:font-semibold tw:text-slate-700 tw:dark:text-slate-300">Days of the Week</span>
              <div className="tw:flex tw:flex-wrap tw:gap-1.5">
                {daysOfWeek.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayToggle(day)}
                    className={cn(
                      'tw:rounded-full tw:border tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:transition-colors',
                      formData.days.includes(day)
                        ? 'tw:border-brand-600 tw:bg-brand-600 tw:text-white'
                        : 'tw:border-slate-200 tw:text-slate-600 tw:dark:border-slate-800 tw:dark:text-slate-300',
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <p className="tw:flex tw:items-start tw:gap-2 tw:rounded-xl tw:bg-slate-50 tw:p-3 tw:text-xs tw:text-slate-500 tw:dark:bg-slate-800/60 tw:dark:text-slate-400">
              <Music2 className="tw:h-4 tw:w-4 tw:flex-none" />
              A notification sound will play at the selected time to remind you to study!
            </p>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="secondary">Cancel</Button>} />
              <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Reminder'}</Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
};

export default Reminders;
