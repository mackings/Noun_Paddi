import React, { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.css';
import WritingHand3D from './WritingHand3D';
import './Whiteboard.css';

// Reveal pacing is gated by real audio playback time (the `elapsedMs` prop, driven by
// Tutor.js from actual Gemini audio chunks as they arrive), not an independent wall
// clock. CHAR_INTERVAL_MS is just the fastest the visual is allowed to advance per
// tick — the real speed limiter is whether enough narration time has actually elapsed,
// so writing can never race ahead of (or lag behind) what's being said. MS_PER_UNIT is
// the assumed narration pace (~16 units/sec) used to convert elapsed audio ms into a
// target reveal position.
const CHAR_INTERVAL_MS = 40;
const MS_PER_UNIT = 62;
// A rendered math expression has no "characters" to type — it's written as a whole
// unit — but it still needs to visually sit on the board for roughly as long as the
// spoken narration around it takes, so it gets a flat minimum dwell time instead of a
// per-character one.
const MATH_MIN_WEIGHT = 22;
const LINE_SETTLE_MS = 200;
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
    return [{ type: 'code-block', content, weight: Math.max(content.length, 1), key: 0 }];
  }

  const parts = [];
  const regex = /```([\s\S]+?)```|`([^`]+)`|\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const content = line.slice(lastIndex, match.index);
      parts.push({ type: 'text', content, weight: content.length, key: key++ });
    }

    if (match[1] !== undefined || match[2] !== undefined) {
      const content = match[1] !== undefined ? match[1] : match[2];
      parts.push({ type: 'code-inline', content, weight: Math.max(content.length, 1), key: key++ });
    } else {
      const isDisplay = match[3] !== undefined;
      const expr = isDisplay ? match[3] : match[4];
      let html;
      try {
        html = katex.renderToString(expr, { throwOnError: false, displayMode: isDisplay });
      } catch (error) {
        html = expr;
      }
      parts.push({ type: 'math', html, weight: Math.max(MATH_MIN_WEIGHT, expr.length), key: key++ });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    const content = line.slice(lastIndex);
    parts.push({ type: 'text', content, weight: content.length, key: key++ });
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

// How many reveal "units" have been consumed up to the current segment/progress point.
// Text segments consume one unit per character; a math segment consumes its whole
// weight only once fully dwelt on (see the effect below) — while active, `progress`
// tracks ticks elapsed within it, capped at its weight.
function unitsConsumed(segments, segmentIndex, progress) {
  let units = 0;
  for (let i = 0; i < segmentIndex && i < segments.length; i++) {
    units += segments[i].weight;
  }
  if (segmentIndex < segments.length) units += progress;
  return units;
}

const Whiteboard = ({ title, lines: rawLines, elapsedMs, turnComplete }) => {
  const lines = normalizeLines(rawLines);
  const [renderedLines, setRenderedLines] = useState([]);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isErasing, setIsErasing] = useState(false);
  const contentKeyRef = useRef('');
  const timeoutRef = useRef(null);
  const lineStartElapsedMsRef = useRef(0);

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
      lineStartElapsedMsRef.current = elapsedMs || 0;
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

  // Typewriter: reveal one segment-unit at a time, gated by how much narration time has
  // actually elapsed (or, once the model has finished speaking, just finish naturally
  // without waiting further — there's no more speech left to sync against).
  useEffect(() => {
    if (isErasing || !lines || lines.length === 0) return undefined;
    const lineIndex = renderedLines.length;
    if (lineIndex >= lines.length) return undefined;

    const segments = renderLineSegments(lines[lineIndex]);
    if (segmentIndex >= segments.length) {
      timeoutRef.current = setTimeout(() => {
        setRenderedLines((current) => [...current, lines[lineIndex]]);
        setSegmentIndex(0);
        setProgress(0);
        lineStartElapsedMsRef.current = elapsedMs || 0;
      }, LINE_SETTLE_MS);
      return () => clearTimeout(timeoutRef.current);
    }

    const segment = segments[segmentIndex];
    // Math reveals as a whole rendered unit with a flat dwell time; text and code
    // (inline or block) type out character-by-character up to their own length.
    const targetLength = segment.type === 'math' ? segment.weight : segment.content.length;
    if (progress >= targetLength) {
      timeoutRef.current = setTimeout(() => {
        setSegmentIndex((i) => i + 1);
        setProgress(0);
      }, 0);
      return () => clearTimeout(timeoutRef.current);
    }

    const lineElapsedMs = Math.max(0, (elapsedMs || 0) - lineStartElapsedMsRef.current);
    const targetUnits = turnComplete ? Infinity : Math.floor(lineElapsedMs / MS_PER_UNIT);
    const behind = targetUnits - unitsConsumed(segments, segmentIndex, progress);

    if (behind <= 0) {
      // Caught up to (or ahead of) the actual narration pace — wait for more audio to
      // arrive (which re-triggers this effect via the elapsedMs prop) rather than
      // advancing on an independent clock, so writing never outruns speech.
      return undefined;
    }

    // Narration can speed up mid-explanation and pull further ahead than a single
    // normal step would ever close — left as a flat +1 per tick, the board would fall
    // behind and simply never catch up again for the rest of that line. Once the gap
    // exceeds a small buffer, burst forward proportionally (faster ticks, bigger
    // steps) to close it quickly, then settle back into the normal one-at-a-time
    // typing cadence as soon as it's caught up.
    const CATCH_UP_THRESHOLD = 6;
    const isCatchingUp = behind > CATCH_UP_THRESHOLD;
    const step = isCatchingUp ? Math.min(targetLength - progress, Math.ceil(behind / 2)) : 1;
    const tickMs = isCatchingUp ? 18 : CHAR_INTERVAL_MS;

    timeoutRef.current = setTimeout(() => setProgress((p) => Math.min(targetLength, p + step)), tickMs);
    return () => clearTimeout(timeoutRef.current);
  }, [segmentIndex, progress, renderedLines, lines, isErasing, elapsedMs, turnComplete]);

  if (!lines || lines.length === 0) return null;

  const lineIndex = renderedLines.length;
  const activeSegments = !isErasing && lineIndex < lines.length ? renderLineSegments(lines[lineIndex]) : [];

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
          const segments = renderLineSegments(line);
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
