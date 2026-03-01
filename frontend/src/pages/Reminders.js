import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { FiBell, FiPlus, FiTrash2, FiToggleLeft, FiToggleRight, FiMusic } from 'react-icons/fi';
import './Reminders.css';

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
        icon: '/logo192.png',
        badge: '/logo192.png',
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
    <div className="reminders-container">
      <div className="container">
        {/* Stop Alarm Button - Shows when alarm is ringing */}
        {isRinging && (
          <div className="alarm-overlay">
            <div className="alarm-card">
              <FiBell size={64} className="alarm-icon pulsing" />
              <h2>⏰ {currentReminderTitle}</h2>
              <p>Time to study! Your reminder is ringing.</p>
              <button onClick={stopAlarm} className="btn btn-danger btn-lg stop-alarm-btn">
                Stop Alarm
              </button>
            </div>
          </div>
        )}

        <div className="reminders-header">
          <div className="header-content">
            <FiBell size={48} className="header-icon" />
            <h1>Reading Reminders</h1>
            <p>Set up reminders to stay on track with your studies</p>
            <div className="music-note">
              <FiMusic /> Get notified with sound alerts
            </div>
          </div>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-add">
            <FiPlus /> New Reminder
          </button>
        </div>

        <div className="reminders-grid">
          {reminders.length === 0 ? (
            <div className="no-reminders">
              <FiBell size={64} />
              <p>No reminders yet. Create your first reminder to get started!</p>
            </div>
          ) : (
            reminders.map((reminder) => (
              <div key={reminder._id} className={`reminder-card ${!reminder.isActive ? 'inactive' : ''}`}>
                <div className="reminder-header">
                  <h3>{reminder.title}</h3>
                  <div className="reminder-actions">
                    <button
                      onClick={() => toggleReminder(reminder._id)}
                      className={`toggle-btn ${reminder.isActive ? 'active' : ''}`}
                      title={reminder.isActive ? 'Disable' : 'Enable'}
                    >
                      {reminder.isActive ? <FiToggleRight size={24} /> : <FiToggleLeft size={24} />}
                    </button>
                    <button
                      onClick={() => deleteReminder(reminder._id)}
                      className="delete-btn"
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>

                <div className="reminder-time">
                  <span className="time-icon">⏰</span>
                  <span className="time-value">{reminder.time}</span>
                </div>

                <div className="reminder-days">
                  {daysOfWeek.map(day => (
                    <span
                      key={day}
                      className={`day-badge ${reminder.days.includes(day) ? 'active' : ''}`}
                    >
                      {day.substring(0, 3)}
                    </span>
                  ))}
                </div>

                <div className="reminder-footer">
                  <FiMusic size={14} /> <span>Notification sound will play</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Reminder Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Reminder</h2>
                <button onClick={() => setShowModal(false)} className="close-btn">×</button>
              </div>

              <form onSubmit={handleSubmit} className="reminder-form">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Reading Time"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Time</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Days of the Week</label>
                  <div className="days-selector">
                    {daysOfWeek.map(day => (
                      <button
                        key={day}
                        type="button"
                        className={`day-btn ${formData.days.includes(day) ? 'selected' : ''}`}
                        onClick={() => handleDayToggle(day)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="reminder-info">
                  <FiMusic />
                  <p>A notification sound will play at the selected time to remind you to study!</p>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Reminder'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reminders;
