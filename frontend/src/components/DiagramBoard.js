import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import './Whiteboard.css';
import './DiagramBoard.css';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'neutral',
  fontFamily: 'inherit',
});

let diagramCounter = 0;

// Mermaid needs to lay out and measure a real SVG, so there's no per-character typewriter
// equivalent to Whiteboard's reveal — the diagram just appears once render() resolves.
// To stop narration from instantly racing ahead of something students haven't had a
// moment to actually look at, hold the board "not done" for a short fixed dwell after the
// SVG appears, then signal onComplete exactly like Whiteboard does.
const REVEAL_DWELL_MS = 1400;

const DiagramBoard = ({ title, mermaid: mermaidText, onComplete }) => {
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);
  const contentKeyRef = useRef('');
  const completedRef = useRef(false);
  const dwellTimeoutRef = useRef(null);

  const contentKey = `${title}::${mermaidText}`;

  useEffect(() => {
    if (!mermaidText || contentKeyRef.current === contentKey) return undefined;
    contentKeyRef.current = contentKey;
    completedRef.current = false;
    setSvg('');
    setFailed(false);
    clearTimeout(dwellTimeoutRef.current);

    diagramCounter += 1;
    const renderId = `tutor-diagram-${diagramCounter}`;
    // Capture which content this particular render is for, and check that against the
    // ref (not a closure-local "cancelled on cleanup" flag) once it resolves. React 18
    // StrictMode double-invokes this effect in dev (mount -> cleanup -> mount) against
    // the SAME component instance, so a closure flag flipped in cleanup would discard the
    // one real render's result as "cancelled" — leaving the spinner spinning forever even
    // though mermaid rendered successfully. Comparing against the ref instead only treats
    // a render as stale when the actual diagram content has since changed.
    const renderedForKey = contentKey;

    const finish = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete?.();
    };

    mermaid.render(renderId, mermaidText)
      .then(({ svg: renderedSvg }) => {
        if (contentKeyRef.current !== renderedForKey) return;
        setSvg(renderedSvg);
        dwellTimeoutRef.current = setTimeout(finish, REVEAL_DWELL_MS);
      })
      .catch((error) => {
        console.error('Failed to render diagram:', error);
        if (contentKeyRef.current !== renderedForKey) return;
        setFailed(true);
        finish();
      });

    return () => clearTimeout(dwellTimeoutRef.current);
  }, [contentKey, mermaidText, onComplete]);

  if (!mermaidText) return null;

  return (
    <div className="whiteboard diagram-board">
      {title && <p className="whiteboard-title">{title}</p>}
      <div className="diagram-board-body">
        {failed ? (
          <p className="diagram-board-error">Couldn&apos;t draw this diagram.</p>
        ) : svg ? (
          <div className="diagram-board-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <span className="tutor-spinner" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};

export default DiagramBoard;
