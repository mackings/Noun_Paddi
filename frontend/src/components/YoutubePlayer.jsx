import React, { useRef, useState } from 'react';
import YouTube from 'react-youtube';
import { FiPause, FiPlay, FiRotateCcw, FiRotateCw } from 'react-icons/fi';
import VideoOverlay from './VideoOverlay';
import { LOCKED_OPTS, extractVideoId } from '../utils/youtube';
import { usePreventLeakage } from '../utils/usePreventLeakage';

export default function YoutubePlayer({ videoId, title, onEnd, onStateChange }) {
  const wrapperRef = useRef(null);
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const id = extractVideoId(videoId);

  usePreventLeakage(wrapperRef);

  if (!id) {
    return <div className="video-player-error">Invalid video reference.</div>;
  }

  const setPlaying = (isPlaying) => {
    if (typeof onStateChange === 'function') onStateChange(isPlaying);
  };

  const handleReady = (event) => {
    playerRef.current = event.target;
    setReady(true);
  };

  const handleStateChange = (event) => {
    const state = event.data;
    const YTState = window.YT?.PlayerState;
    if (!YTState) return;
    setPlaying(state === YTState.PLAYING);
  };

  const play = () => {
    playerRef.current?.playVideo?.();
  };

  const pause = () => {
    playerRef.current?.pauseVideo?.();
  };

  const seekBy = (seconds) => {
    if (!playerRef.current?.getCurrentTime || !playerRef.current?.seekTo) return;

    const currentTime = Number(playerRef.current.getCurrentTime()) || 0;
    const duration = Number(playerRef.current.getDuration?.()) || 0;
    const targetTime = Math.max(0, duration ? Math.min(duration, currentTime + seconds) : currentTime + seconds);

    playerRef.current.seekTo(targetTime, true);
  };

  return (
    <div ref={wrapperRef} className="video-player-shell">
      <div className="video-frame-wrap" aria-label={title}>
        <YouTube
          videoId={id}
          opts={LOCKED_OPTS}
          host="https://www.youtube-nocookie.com"
          className="video-frame"
          iframeClassName="video-frame-iframe"
          title={title}
          onReady={handleReady}
          onStateChange={handleStateChange}
          onEnd={onEnd}
        />
        <VideoOverlay />
      </div>
      <div className="video-player-controls">
        <button type="button" className="video-control-btn" onClick={() => seekBy(-10)} disabled={!ready} aria-label="Go back 10 seconds">
          <FiRotateCcw />
          <span>10s</span>
        </button>
        <button type="button" className="video-control-btn" onClick={play} disabled={!ready} aria-label="Play video">
          <FiPlay />
          <span>Play</span>
        </button>
        <button type="button" className="video-control-btn" onClick={pause} disabled={!ready} aria-label="Pause video">
          <FiPause />
          <span>Pause</span>
        </button>
        <button type="button" className="video-control-btn" onClick={() => seekBy(10)} disabled={!ready} aria-label="Go forward 10 seconds">
          <FiRotateCw />
          <span>10s</span>
        </button>
      </div>
    </div>
  );
}
