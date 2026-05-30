import React, { useEffect, useMemo, useState } from 'react';
import { FiBookOpen, FiLayers, FiMessageSquare, FiSearch, FiShield } from 'react-icons/fi';
import api from '../utils/api';
import SEO from '../components/SEO';
import CoursePlayer from '../components/CoursePlayer';
import { trackFeatureVisit } from '../utils/featureTracking';
import emostelVideos from '../data/emostelVideos';
import './Videos.css';

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
    <section className="video-comments-panel">
      <div className="video-comments-head">
        <div>
          <p className="videos-kicker">Discussion</p>
          <h3>Lesson comments</h3>
        </div>
        <FiMessageSquare />
      </div>

      <form className="video-comment-form" onSubmit={handleSubmitComment}>
        <textarea
          value={commentDraft}
          onChange={(event) => setCommentDraft(event.target.value)}
          placeholder="Add a helpful comment or question..."
          maxLength={1000}
        />
        <div className="video-comment-form-row">
          <span>{commentDraft.length}/1000</span>
          <button type="submit" disabled={savingComment}>
            {savingComment ? 'Posting...' : 'Post comment'}
          </button>
        </div>
      </form>

      {commentError && <div className="video-comment-error">{commentError}</div>}
      {commentsLoading && <div className="video-comment-empty">Loading comments...</div>}
      {!commentsLoading && comments.length === 0 && (
        <div className="video-comment-empty">No comments yet. Start the discussion.</div>
      )}
      <div className="video-comments-list">
        {comments.map((comment) => (
          <article className="video-comment" key={comment._id}>
            <div className="video-comment-avatar">{getInitials(comment.user?.name)}</div>
            <div>
              <div className="video-comment-meta">
                <strong>{comment.user?.name || 'Student'}</strong>
                <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
              </div>
              <p>{comment.comment}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
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
    <div className="videos-page">
      <SEO
        title="Emostel Academy Videos - NounPaddi"
        description="Watch Emostel Academy video lessons inside NounPaddi with grouped courses and student comments."
        url="/videos"
        robots="noindex, nofollow"
      />
      <div className="container">
        <header className="videos-header">
          <div>
            <p className="videos-kicker">Emostel Academy</p>
            <h1>Video Lessons</h1>
            <p>
              Select a course or category first, then open the lessons and stream them inside Paddi.
            </p>
          </div>
          <div className="videos-protection-pill">
            <FiShield />
            <span>{isPlaying ? 'Streaming in Paddi' : 'Protected in-app playback'}</span>
          </div>
        </header>

        {!selectedCourse && (
          <section className="videos-course-picker">
            <div className="videos-picker-head">
              <div>
                <p className="videos-kicker">Choose category</p>
                <h2>Select a course to begin</h2>
              </div>
              <div className="videos-search">
                <FiSearch />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search courses or topics"
                />
              </div>
            </div>

            <div className="videos-course-grid">
              {filteredCourses.map((course) => (
                <button
                  type="button"
                  className="videos-course-card"
                  key={course.name}
                  onClick={() => handleSelectCourse(course.name)}
                >
                  <span className="videos-course-icon">
                    <FiBookOpen />
                  </span>
                  <span className="videos-course-name">{course.name}</span>
                  <span className="videos-course-meta">
                    {course.videos.length} lesson{course.videos.length === 1 ? '' : 's'} / {course.modules.size} topic{course.modules.size === 1 ? '' : 's'}
                  </span>
                  <span className="videos-course-topics">
                    <FiLayers />
                    {Array.from(course.modules).slice(0, 3).join(', ')}
                  </span>
                </button>
              ))}
            </div>
            {filteredCourses.length === 0 && (
              <div className="videos-empty">No course or category matches your search.</div>
            )}
          </section>
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
    </div>
  );
};

export default Videos;
