import React, { useEffect, useRef } from 'react';

const ADSENSE_CLIENT = process.env.REACT_APP_ADSENSE_CLIENT || 'ca-pub-3269360543228464';
const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

// Load the AdSense library once, only when a page actually renders an ad slot.
const ensureAdSenseScript = () => {
  if (document.querySelector(`script[src^="${ADSENSE_SRC}"]`)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `${ADSENSE_SRC}?client=${ADSENSE_CLIENT}`;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
};

// Renders nothing until an ad unit slot id is configured, so pages are unaffected without one.
const AdSlot = ({ slot, className }) => {
  const insRef = useRef(null);

  useEffect(() => {
    const ins = insRef.current;
    if (!slot || !ins) return;
    // Each <ins> may only be filled once (StrictMode runs effects twice in development).
    if (ins.getAttribute('data-adsbygoogle-status')) return;

    ensureAdSenseScript();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      // Ad blockers and unfilled requests must never break the page.
    }
  }, [slot]);

  if (!slot) return null;

  return (
    <div className={className}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdSlot;
