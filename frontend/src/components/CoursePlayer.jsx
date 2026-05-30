import React, { useMemo, useState } from 'react';
import { FiArrowLeft, FiBookOpen } from 'react-icons/fi';
import YoutubePlayer from './YoutubePlayer';

export default function CoursePlayer({ courseName, lessons, activeVideoId, onSelectLesson, onBack, onPlayingChange }) {
  const initialIndex = Math.max(0, lessons.findIndex((lesson) => lesson.id === activeVideoId));
  const [activeIdx, setActiveIdx] = useState(initialIndex);

  const active = lessons[activeIdx] || lessons[0];

  const groupedLessons = useMemo(() => lessons.reduce((groups, lesson, index) => {
    const key = lesson.module || 'Lessons';
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...lesson, lessonIndex: index });
    return groups;
  }, {}), [lessons]);

  const handleSelect = (index) => {
    setActiveIdx(index);
    if (typeof onSelectLesson === 'function') onSelectLesson(lessons[index]);
  };

  const handleEnd = () => {
    if (activeIdx < lessons.length - 1) {
      handleSelect(activeIdx + 1);
    }
  };

  if (!active) return null;

  return (
    <main className="videos-layout">
      <section className="videos-main-panel">
        <YoutubePlayer
          videoId={active.id}
          title={active.title}
          onEnd={handleEnd}
          onStateChange={onPlayingChange}
        />
        <div className="video-now-playing">
          <div>
            <p>{courseName} / {active.module}</p>
            <h2>{active.title}</h2>
          </div>
        </div>
      </section>

      <aside className="videos-sidebar">
        <button type="button" className="videos-back-btn" onClick={onBack}>
          <FiArrowLeft />
          <span>Courses</span>
        </button>
        <div className="videos-sidebar-title">
          <FiBookOpen />
          <div>
            <p className="videos-kicker">Selected course</p>
            <h2>{courseName}</h2>
          </div>
        </div>
        <div className="videos-list">
          {Object.entries(groupedLessons).map(([moduleName, moduleLessons]) => (
            <section className="videos-group" key={moduleName}>
              <h3>{moduleName}</h3>
              {moduleLessons.map((lesson) => (
                <button
                  type="button"
                  key={lesson.id}
                  className={active.id === lesson.id ? 'video-list-item active' : 'video-list-item'}
                  onClick={() => handleSelect(lesson.lessonIndex)}
                >
                  <span>{lesson.lessonIndex + 1}. {lesson.title}</span>
                  <small>{lesson.meta}</small>
                </button>
              ))}
            </section>
          ))}
        </div>
      </aside>
    </main>
  );
}
