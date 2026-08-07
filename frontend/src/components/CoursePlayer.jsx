import React, { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import YoutubePlayer from './YoutubePlayer';
import { Card } from './ui/card';
import { cn } from '../lib/utils';

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
    <div className="tw:space-y-4">
      <YoutubePlayer
        videoId={active.id}
        title={active.title}
        onEnd={handleEnd}
        onStateChange={onPlayingChange}
      />
      <Card className="tw:p-4">
        <p className="tw:text-xs tw:font-bold tw:text-brand-600 tw:dark:text-brand-400">{courseName} / {active.module}</p>
        <h2 className="tw:font-heading tw:mt-0.5 tw:text-base tw:font-bold">{active.title}</h2>
      </Card>

      <button
        type="button"
        onClick={onBack}
        className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-semibold tw:text-brand-600 tw:dark:text-brand-400"
      >
        <ArrowLeft className="tw:h-3.5 tw:w-3.5" /> Courses
      </button>

      <Card className="tw:space-y-3 tw:p-4">
        <div className="tw:flex tw:items-center tw:gap-2.5">
          <span className="tw:flex tw:h-9 tw:w-9 tw:flex-none tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
            <BookOpen className="tw:h-4 tw:w-4" />
          </span>
          <div>
            <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-slate-400 tw:uppercase">Selected course</p>
            <h2 className="tw:font-heading tw:text-sm tw:font-bold">{courseName}</h2>
          </div>
        </div>

        <div className="tw:space-y-4">
          {Object.entries(groupedLessons).map(([moduleName, moduleLessons]) => (
            <div key={moduleName}>
              <h3 className="tw:mb-1.5 tw:text-xs tw:font-bold tw:text-slate-500 tw:uppercase tw:tracking-wide tw:dark:text-slate-400">{moduleName}</h3>
              <div className="tw:space-y-1.5">
                {moduleLessons.map((lesson) => (
                  <button
                    type="button"
                    key={lesson.id}
                    onClick={() => handleSelect(lesson.lessonIndex)}
                    className={cn(
                      'tw:block tw:w-full tw:rounded-xl tw:border tw:p-3 tw:text-left tw:text-sm tw:transition-colors',
                      active.id === lesson.id
                        ? 'tw:border-brand-500 tw:bg-brand-50 tw:font-semibold tw:text-brand-700 tw:dark:bg-brand-950/40 tw:dark:text-brand-300'
                        : 'tw:border-slate-200 tw:text-slate-700 tw:dark:border-slate-800 tw:dark:text-slate-200',
                    )}
                  >
                    <span className="tw:block">{lesson.lessonIndex + 1}. {lesson.title}</span>
                    <small className="tw:text-xs tw:text-slate-400">{lesson.meta}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
