import React, { useRef, useState } from 'react';
import YouTube from 'react-youtube';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import VideoOverlay from './VideoOverlay';
import { LOCKED_OPTS, extractVideoId } from '../utils/youtube';
import { usePreventLeakage } from '../utils/usePreventLeakage';
// video-frame-wrap/video-frame/video-overlay-* classes below are pixel-positioned
// anti-leak protection (blocking YouTube's own clickable logo/title overlay) — kept
// exactly as-is rather than restyled, since getting that positioning wrong is a real
// content-protection regression, not just a visual one.
import '../pages/Videos.css';

export default function YoutubePlayer({ videoId, title, onEnd, onStateChange }) {
  const wrapperRef = useRef(null);
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const id = extractVideoId(videoId);

  usePreventLeakage(wrapperRef);

  if (!id) {
    return <div className="tw:flex tw:items-center tw:justify-center tw:rounded-2xl tw:bg-slate-100 tw:p-8 tw:text-sm tw:text-slate-500 tw:dark:bg-slate-800 tw:dark:text-slate-400">Invalid video reference.</div>;
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
    <div ref={wrapperRef} className="tw:overflow-hidden tw:rounded-2xl tw:border tw:border-slate-200/70 tw:bg-white tw:dark:border-slate-800 tw:dark:bg-slate-900">
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
      <div className="tw:grid tw:grid-cols-4 tw:gap-2 tw:p-3">
        <button
          type="button"
          onClick={() => seekBy(-10)}
          disabled={!ready}
          aria-label="Go back 10 seconds"
          className="tw:flex tw:flex-col tw:items-center tw:gap-1 tw:rounded-xl tw:bg-slate-100 tw:py-2.5 tw:text-xs tw:font-semibold tw:text-slate-600 tw:transition-colors tw:disabled:opacity-50 tw:dark:bg-slate-800 tw:dark:text-slate-300"
        >
          <RotateCcw className="tw:h-4 tw:w-4" />
          10s
        </button>
        <button
          type="button"
          onClick={play}
          disabled={!ready}
          aria-label="Play video"
          className="tw:flex tw:flex-col tw:items-center tw:gap-1 tw:rounded-xl tw:bg-brand-600 tw:py-2.5 tw:text-xs tw:font-semibold tw:text-white tw:transition-colors tw:disabled:opacity-50 tw:hover:bg-brand-500"
        >
          <Play className="tw:h-4 tw:w-4" />
          Play
        </button>
        <button
          type="button"
          onClick={pause}
          disabled={!ready}
          aria-label="Pause video"
          className="tw:flex tw:flex-col tw:items-center tw:gap-1 tw:rounded-xl tw:bg-slate-100 tw:py-2.5 tw:text-xs tw:font-semibold tw:text-slate-600 tw:transition-colors tw:disabled:opacity-50 tw:dark:bg-slate-800 tw:dark:text-slate-300"
        >
          <Pause className="tw:h-4 tw:w-4" />
          Pause
        </button>
        <button
          type="button"
          onClick={() => seekBy(10)}
          disabled={!ready}
          aria-label="Go forward 10 seconds"
          className="tw:flex tw:flex-col tw:items-center tw:gap-1 tw:rounded-xl tw:bg-slate-100 tw:py-2.5 tw:text-xs tw:font-semibold tw:text-slate-600 tw:transition-colors tw:disabled:opacity-50 tw:dark:bg-slate-800 tw:dark:text-slate-300"
        >
          <RotateCw className="tw:h-4 tw:w-4" />
          10s
        </button>
      </div>
    </div>
  );
}
