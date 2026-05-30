import React from 'react';

export default function VideoOverlay() {
  return (
    <>
      <div className="video-overlay-hitbox" aria-hidden="true" />
      <div className="video-overlay-mask video-overlay-top-right" aria-hidden="true" />
      <div className="video-overlay-mask video-overlay-bottom-right" aria-hidden="true" />
      <div className="video-overlay-mask video-overlay-bottom-left" aria-hidden="true" />
    </>
  );
}
