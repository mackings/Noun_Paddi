import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Layers, MessageSquare, Search, Shield, Loader2 } from 'lucide-react';
import api from '../utils/api';
import SEO from '../components/SEO';
import CoursePlayer from '../components/CoursePlayer';
import { trackFeatureVisit } from '../utils/featureTracking';
import emostelVideos from '../data/emostelVideos';
import ShellHeader from '../shell/ShellHeader';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

const getInitials = (name) => String(name || 'S')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part.charAt(0).toUpperCase())
  .join('') || 'S';

const buildCourseGroups = (videos) => videos.reduce((groups, video) => {
  if (!groups[video.course]) {
    groups[video.course] = {
      name: video.course,
      modules: new Set(),
      videos: [],
    };
  }

  groups[video.course].modules.add(video.module);
  groups[video.course].videos.push(video);
  return groups;
}, {});

function VideoComments({ selectedVideo }) {
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [savingComment, setSavingComment] = useState(false);

  useEffect(() => {
    if (!selectedVideo?.id) return undefined;

    let active = true;
    setCommentsLoading(true);
    setCommentError('');

    api.get(`/videos/${selectedVideo.id}/comments`)
      .then((response) => {
        if (active) setComments(response.data?.data || []);
      })
      .catch((error) => {
        if (active) setCommentError(error.response?.data?.message || 'Comments could not be loaded.');
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedVideo?.id]);

  const handleSubmitComment = async (event) => {
    event.preventDefault();
    const trimmed = commentDraft.trim();

    if (!trimmed) {
      setCommentError('Please enter a comment.');
      return;
    }

    setSavingComment(true);
    setCommentError('');

    try {
      const response = await api.post(`/videos/${selectedVideo.id}/comments`, { comment: trimmed });
      setComments((current) => [response.data.data, ...current]);
      setCommentDraft('');
    } catch (error) {
      setCommentError(error.response?.data?.message || 'Comment could not be saved.');
    } finally {
      setSavingComment(false);
    }
  };

  return (
    <Card className="tw:space-y-3 tw:p-4">
      <div className="tw:flex tw:items-center tw:justify-between">
        <div>
          <p className="tw:text-xs tw:font-bold tw:tracking-wide tw:text-brand-600 tw:uppercase tw:dark:text-brand-400">Discussion</p>
          <h3 className="tw:font-heading tw:text-sm tw:font-bold">Lesson comments</h3>
        </div>
        <MessageSquare className="tw:h-4 tw:w-4 tw:text-slate-400" />
      </div>

      <form className="tw:space-y-2" onSubmit={handleSubmitComment}>
        <textarea
          value={commentDraft}
          onChange={(event) => setCommentDraft(event.target.value)}
          placeholder="Add a helpful comment or question..."
          maxLength={1000}
          rows={3}
          className="tw:w-full tw:resize-none tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-3 tw:text-sm tw:outline-none tw:focus:border-brand-500 tw:dark:border-slate-800 tw:dark:bg-slate-900 tw:dark:text-slate-100"
        />
        <div className="tw:flex tw:items-center tw:justify-between">
          <span className="tw:text-xs tw:text-slate-400">{commentDraft.length}/1000</span>
          <Button type="submit" size="sm" disabled={savingComment}>
            {savingComment ? <><Loader2 className="tw:h-3.5 tw:w-3.5 tw:animate-spin" /> Posting...</> : 'Post comment'}
          </Button>
        </div>
      </form>

      {commentError && (
        <p className="tw:rounded-xl tw:bg-red-100 tw:px-3 tw:py-2 tw:text-xs tw:text-red-700 tw:dark:bg-red-500/15 tw:dark:text-red-300">{commentError}</p>
      )}
      {commentsLoading && <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">Loading comments...</p>}
      {!commentsLoading && comments.length === 0 && (
        <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">No comments yet. Start the discussion.</p>
      )}
      <div className="tw:space-y-3">
        {comments.map((comment) => (
          <article key={comment._id} className="tw:flex tw:gap-2.5">
            <span className="tw:flex tw:h-8 tw:w-8 tw:flex-none tw:items-center tw:justify-center tw:rounded-full tw:bg-brand-100 tw:text-xs tw:font-bold tw:text-brand-700 tw:dark:bg-brand-950 tw:dark:text-brand-300">
              {getInitials(comment.user?.name)}
            </span>
            <div>
              <div className="tw:flex tw:items-center tw:gap-2">
                <strong className="tw:text-sm tw:font-semibold">{comment.user?.name || 'Student'}</strong>
                <span className="tw:text-xs tw:text-slate-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="tw:text-sm tw:text-slate-600 tw:dark:text-slate-300">{comment.comment}</p>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

const Videos = () => {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  const courseGroups = useMemo(() => buildCourseGroups(emostelVideos), []);
  const courses = useMemo(() => Object.values(courseGroups), [courseGroups]);

  const filteredCourses = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return courses;

    return courses.filter((course) => {
      const searchable = `${course.name} ${Array.from(course.modules).join(' ')} ${course.videos.map((video) => video.title).join(' ')}`.toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [courses, searchQuery]);

  const selectedLessons = selectedCourse ? courseGroups[selectedCourse]?.videos || [] : [];
  const activeLesson = selectedVideo || selectedLessons[0] || null;

  useEffect(() => {
    trackFeatureVisit('videos');
  }, []);

  const handleSelectCourse = (courseName) => {
    const lessons = courseGroups[courseName]?.videos || [];
    setSelectedCourse(courseName);
    setSelectedVideo(lessons[0] || null);
    setIsPlaying(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToCourses = () => {
    setSelectedCourse('');
    setSelectedVideo(null);
    setIsPlaying(false);
  };

  return (
    <div className="np-shell tw:space-y-4 tw:p-4">
      <SEO
        title="Emostel Academy Videos - NounPaddi"
        description="Watch Emostel Academy video lessons inside NounPaddi with grouped courses and student comments."
        url="/videos"
        robots="noindex, nofollow"
      />
      <ShellHeader title="Video Lessons" className="tw:-mx-4 tw:-mt-4" />

      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
        <p className="tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">
          Select a course, then open the lessons and stream them inside Paddi.
        </p>
        <span className="tw:flex tw:flex-none tw:items-center tw:gap-1.5 tw:rounded-full tw:bg-emerald-100 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-semibold tw:text-emerald-700 tw:dark:bg-emerald-950 tw:dark:text-emerald-300">
          <Shield className="tw:h-3 tw:w-3" />
          {isPlaying ? 'Streaming' : 'Protected'}
        </span>
      </div>

      {!selectedCourse && (
        <div className="tw:space-y-3">
          <div className="tw:relative">
            <Search className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3.5 tw:h-4 tw:w-4 tw:-translate-y-1/2 tw:text-slate-400" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search courses or topics"
              className="tw:pl-10"
            />
          </div>

          <div className="tw:grid tw:grid-cols-2 tw:gap-3">
            {filteredCourses.map((course) => (
              <button
                type="button"
                key={course.name}
                onClick={() => handleSelectCourse(course.name)}
                className="tw:block tw:text-left"
              >
                <Card interactive className="tw:flex tw:h-full tw:flex-col tw:gap-2 tw:p-4">
                  <span className="tw:flex tw:h-9 tw:w-9 tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-600 tw:dark:bg-brand-950 tw:dark:text-brand-300">
                    <BookOpen className="tw:h-4 tw:w-4" />
                  </span>
                  <span className="tw:font-heading tw:text-sm tw:font-bold">{course.name}</span>
                  <span className="tw:text-xs tw:text-slate-500 tw:dark:text-slate-400">
                    {course.videos.length} lesson{course.videos.length === 1 ? '' : 's'} / {course.modules.size} topic{course.modules.size === 1 ? '' : 's'}
                  </span>
                  <span className="tw:mt-auto tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:text-slate-400">
                    <Layers className="tw:h-3.5 tw:w-3.5" />
                    {Array.from(course.modules).slice(0, 3).join(', ')}
                  </span>
                </Card>
              </button>
            ))}
          </div>
          {filteredCourses.length === 0 && (
            <Card className="tw:p-6 tw:text-center tw:text-sm tw:text-slate-500 tw:dark:text-slate-400">
              No course or category matches your search.
            </Card>
          )}
        </div>
      )}

      {selectedCourse && (
        <>
          <CoursePlayer
            courseName={selectedCourse}
            lessons={selectedLessons}
            activeVideoId={activeLesson?.id}
            onSelectLesson={setSelectedVideo}
            onBack={handleBackToCourses}
            onPlayingChange={setIsPlaying}
          />
          {activeLesson && <VideoComments selectedVideo={activeLesson} />}
        </>
      )}
    </div>
  );
};

export default Videos;
