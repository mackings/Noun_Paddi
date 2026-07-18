import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.css';
import WritingHand3D from './WritingHand3D';
import './Whiteboard.css';

// The board now types at a fixed, predictable pace — it no longer tries to track real
// audio playback time at all. Earlier versions gated reveal speed against elapsed audio
// time (an estimate of narration pace with no real word-level timing data behind it),
// which kept breaking in new ways: dense math, mid-calculation pauses, variable speech
// speed all defeated it, because the board was always the one trying to catch up to an
// unpredictable target. The fix is architectural, not another tuning pass: Tutor.js now
// buffers incoming audio and releases it to the speakers at a pace gated by THIS
// component's own progress (see audioQueueRef/boardStartTimeRef there) — the voice
// waits for the board, not the other way around. That means this component just needs
// to type at a comfortable, reliable speed; it can never be "wrong" anymore.
const CHAR_INTERVAL_MS = 45;
const MATH_DWELL_MS = 650;
const LINE_SETTLE_MS = 250;
const ERASE_DURATION_MS = 550;

// The model is told to keep a whole code snippet in ONE `lines` array entry with real
// embedded newlines, but in practice it sometimes follows its own "one step per line"
// habit even inside a fence — opening ``` on one array entry and closing it several
// entries later, one physical code line per entry. Rather than depend on prompt
// compliance alone (the LaTeX equivalent of this exact failure mode is what caused the
// raw-math-flashing bug earlier), merge any such split fence back into a single entry
// before parsing, so an unclosed ``` never falls through to being displayed as literal
// text.
function normalizeLines(lines) {
  if (!Array.isArray(lines)) return [];
  const normalized = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const fenceOpensHere = trimmed.startsWith('```') && trimmed.indexOf('```', 3) === -1;
    if (fenceOpensHere) {
      const buffer = [line];
      let j = i + 1;
      while (j < lines.length && !lines[j].includes('```')) {
        buffer.push(lines[j]);
        j += 1;
      }
      if (j < lines.length) {
        buffer.push(lines[j]);
        j += 1;
      }
      normalized.push(buffer.join('\n'));
      i = j;
    } else {
      normalized.push(line);
      i += 1;
    }
  }
  return normalized;
}

// Splits a line into plain-text, $...$ / $$...$$ math, and ```code```/`code` segments —
// pre-rendering math via KaTeX's string API (not its DOM-mutating auto-render, which
// would conflict with React's own reconciliation) and pre-parsing code so it can be
// shown in a monospace font instead of the handwriting one used for prose (needed for
// courses like Computing, where a snippet written out in a cursive font is unreadable).
// Doing this up front — rather than only once a line is "done" — is what lets the
// active line reveal a fully-rendered symbol/block the moment it's reached instead of
// ever flashing raw source ($...$, \sqrt{}, ``` fences) at students while mid-type.
function renderLineSegments(line) {
  // A line that is ENTIRELY a fenced code block (the model's own convention for "this
  // whole step is a code snippet") renders as a standalone block, not inline prose.
  const codeBlockMatch = line.trim().match(/^```(?:[a-zA-Z0-9_+-]*\n)?([\s\S]*?)```$/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].replace(/\n$/, '');
    return [{ type: 'code-block', content, key: 0 }];
  }

  const parts = [];
  const regex = /```([\s\S]+?)```|`([^`]+)`|\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: line.slice(lastIndex, match.index), key: key++ });
    }

    if (match[1] !== undefined || match[2] !== undefined) {
      const content = match[1] !== undefined ? match[1] : match[2];
      parts.push({ type: 'code-inline', content, key: key++ });
    } else {
      const isDisplay = match[3] !== undefined;
      const expr = isDisplay ? match[3] : match[4];
      let html;
      try {
        html = katex.renderToString(expr, { throwOnError: false, displayMode: isDisplay });
      } catch (error) {
        html = expr;
      }
      parts.push({ type: 'math', html, key: key++ });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push({ type: 'text', content: line.slice(lastIndex), key: key++ });
  }

  return parts;
}

// Renders one already-fully-revealed segment (used for completed lines and for
// segments the active line has already passed).
function renderSegment(segment) {
  if (segment.type === 'math') {
    return <span key={segment.key} dangerouslySetInnerHTML={{ __html: segment.html }} />;
  }
  if (segment.type === 'code-inline') {
    return <code key={segment.key} className="whiteboard-code-inline">{segment.content}</code>;
  }
  return <span key={segment.key}>{segment.content}</span>;
}

const Whiteboard = ({ title, lines: rawLines, onComplete }) => {
  const lines = useMemo(() => normalizeLines(rawLines), [rawLines]);
  const boardSegments = useMemo(() => lines.map(renderLineSegments), [lines]);

  const [renderedLines, setRenderedLines] = useState([]);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isErasing, setIsErasing] = useState(false);
  const contentKeyRef = useRef('');
  const timeoutRef = useRef(null);
  // Guards onComplete so it only fires once per piece of content, not on every effect
  // re-run after the board has already finished typing.
  const completedRef = useRef(false);

  const contentKey = JSON.stringify({ title, lines });

  // New board content arrived: if the board already had something on it, play a
  // brief "erase" transition first, then start writing the new content.
  useEffect(() => {
    if (contentKeyRef.current === contentKey) return undefined;
    clearTimeout(timeoutRef.current);
    const hadContent = renderedLines.length > 0 || segmentIndex > 0 || progress > 0;

    const reset = () => {
      contentKeyRef.current = contentKey;
      setRenderedLines([]);
      setSegmentIndex(0);
      setProgress(0);
      setIsErasing(false);
      completedRef.current = false;
    };

    if (hadContent) {
      setIsErasing(true);
      timeoutRef.current = setTimeout(reset, ERASE_DURATION_MS);
    } else {
      reset();
    }
    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey]);

  // Typewriter: reveal one segment at a time at a fixed, predictable pace. No audio
  // timing involved here at all anymore — see the comment near CHAR_INTERVAL_MS.
  useEffect(() => {
    if (isErasing || lines.length === 0) return undefined;
    const lineIndex = renderedLines.length;
    if (lineIndex >= lines.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return undefined;
    }

    const segments = boardSegments[lineIndex];
    if (segmentIndex >= segments.length) {
      timeoutRef.current = setTimeout(() => {
        setRenderedLines((current) => [...current, lines[lineIndex]]);
        setSegmentIndex(0);
        setProgress(0);
      }, LINE_SETTLE_MS);
      return () => clearTimeout(timeoutRef.current);
    }

    const segment = segments[segmentIndex];
    if (segment.type === 'math') {
      // Math reveals as a whole rendered unit, then just sits for a fixed dwell —
      // there's no "typing" a symbol character by character.
      timeoutRef.current = setTimeout(() => {
        setSegmentIndex((i) => i + 1);
        setProgress(0);
      }, MATH_DWELL_MS);
      return () => clearTimeout(timeoutRef.current);
    }

    if (progress >= segment.content.length) {
      timeoutRef.current = setTimeout(() => {
        setSegmentIndex((i) => i + 1);
        setProgress(0);
      }, 0);
      return () => clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => setProgress((p) => p + 1), CHAR_INTERVAL_MS);
    return () => clearTimeout(timeoutRef.current);
  }, [segmentIndex, progress, renderedLines, lines, boardSegments, isErasing, onComplete]);

  if (lines.length === 0) return null;

  const lineIndex = renderedLines.length;
  const activeSegments = (!isErasing && lineIndex < lines.length ? boardSegments[lineIndex] : []) || [];

  return (
    <div className={`whiteboard ${isErasing ? 'is-erasing' : ''}`}>
      {isErasing && (
        <div className="whiteboard-erase-sweep" aria-hidden="true">
          <span>🧽</span>
        </div>
      )}
      {title && <p className="whiteboard-title">{title}</p>}
      <div className="whiteboard-body">
        {renderedLines.map((line, index) => {
          const segments = boardSegments[index];
          // boardSegments is recomputed from `lines` the instant the prop changes, but
          // `renderedLines` (state) only catches up once the content-reset effect runs
          // on the NEXT render — for that one transitional render, renderedLines can be
          // longer than the new boardSegments, making this undefined. Skip rather than
          // crash; the reset effect clears renderedLines a moment later regardless.
          if (!segments) return null;
          if (segments.length === 1 && segments[0].type === 'code-block') {
            return <pre key={index} className="whiteboard-code-block"><code>{segments[0].content}</code></pre>;
          }
          return (
            <p key={index} className="whiteboard-line">
              {segments.map(renderSegment)}
            </p>
          );
        })}
        {activeSegments.length > 0 && (
          activeSegments.length === 1 && activeSegments[0].type === 'code-block' ? (
            <pre className="whiteboard-code-block whiteboard-line-active">
              <code>{activeSegments[0].content.slice(0, progress)}</code>
              <WritingHand3D />
            </pre>
          ) : (
            <p className="whiteboard-line whiteboard-line-active">
              {activeSegments.map((segment, index) => {
                if (index < segmentIndex) return renderSegment(segment);
                if (index === segmentIndex) {
                  if (segment.type === 'math') {
                    return <span key={segment.key} className="whiteboard-math-pop" dangerouslySetInnerHTML={{ __html: segment.html }} />;
                  }
                  if (segment.type === 'code-inline') {
                    return <code key={segment.key} className="whiteboard-code-inline">{segment.content.slice(0, progress)}</code>;
                  }
                  return <span key={segment.key}>{segment.content.slice(0, progress)}</span>;
                }
                return null;
              })}
              <WritingHand3D />
            </p>
          )
        )}
      </div>
    </div>
  );
};

export default Whiteboard;
