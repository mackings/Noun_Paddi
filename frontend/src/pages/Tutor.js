import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiBookOpen, FiChevronDown, FiPlusCircle, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { TalkingHead } from '@met4citizen/talkinghead';
import api from '../utils/api';
import GeminiLiveClient from '../utils/geminiLiveClient';
import Whiteboard from '../components/Whiteboard';
import DiagramBoard from '../components/DiagramBoard';
import './Tutor.css';

// Ready Player Me's hosting service shut down (acquired by Netflix, sunset Jan 2026),
// so we self-host a sample avatar instead of depending on any external CDN.
// "brunette.glb" is TalkingHead's own demo avatar, free for non-commercial use
// (CC BY-NC 4.0) per https://github.com/met4citizen/TalkingHead — served from
// frontend/public/avatars/. Override with REACT_APP_TUTOR_AVATAR_URL if you have
// your own GLB avatar to use instead.
const DEFAULT_AVATAR_URL = process.env.REACT_APP_TUTOR_AVATAR_URL || '/avatars/brunette.glb';

// TalkingHead internally loads its own audio-playback worklet via
// `new URL('./playback-worklet.js', import.meta.url)` (a module-level constant with no
// constructor option to override). That file is plain, self-contained AudioWorklet code
// with zero imports — meant to be served untouched. CRA's production build doesn't know
// that and bundles it as a normal webpack chunk (CommonJS-wrapped, `require()` calls and
// all), which throws immediately once loaded, since AudioWorkletGlobalScope has no
// `require` at all. This only breaks in the production build, not the dev server, which
// is why it worked locally and went silent once deployed. Since there's no supported way
// to redirect the library's internal path, intercept the one addModule() call that
// targets it and redirect to our own static copy in public/worklets/ (same pattern
// already used for the mic's capture-processor.js) — untouched by webpack either way.
if (window.AudioWorklet && !window.AudioWorklet.prototype.__nounpaddiPatchedAddModule) {
  const originalAddModule = window.AudioWorklet.prototype.addModule;
  window.AudioWorklet.prototype.addModule = function patchedAddModule(url, ...rest) {
    if (typeof url === 'string' && url.includes('playback-worklet')) {
      return originalAddModule.call(this, '/worklets/playback-worklet.js', ...rest);
    }
    return originalAddModule.call(this, url, ...rest);
  };
  window.AudioWorklet.prototype.__nounpaddiPatchedAddModule = true;
}

// This is a preview model, and we've directly verified (by testing several concrete
// hypotheses against the real API) that at least some fraction of mid-session closes
// aren't caused by anything in our own protocol usage — they're transient server-side
// hiccups. Rather than hard-failing the student's session on one of those, retry a
// bounded number of times using the same reconnect path built for the graceful
// 15-minute goAway case, and only surface an error once retries are exhausted.
const MAX_RECONNECT_ATTEMPTS = 3;

// Gemini's Live audio output is 24kHz. TalkingHead's constructor opens its AudioContext
// at whatever rate the device defaults to (usually 44100/48000, never 24000), so the
// first real streamStart() call finds a mismatch and recreates the whole audio graph —
// see initAudioGraph() in talkinghead.mjs, called from streamStart when
// sr !== this.audioCtx.sampleRate. That recreation normally happens asynchronously
// inside the onAudio WebSocket callback, i.e. outside any user gesture. Desktop
// browsers tolerate a context resumed outside a gesture; mobile browsers (iOS Safari
// especially) do not — they leave it permanently suspended, which is why audio played
// on desktop but never on mobile despite everything else (video, mic, whiteboard)
// working. Forcing the 24000Hz graph into existence here, synchronously inside the
// "Start Session" click handler, means streamStart() later finds the rate already
// matches and never recreates it — the context playing audio is the same one this
// gesture unlocked.
const AUDIO_SAMPLE_RATE = 24000;

function unlockAudioForMobile(head) {
  head.initAudioGraph(AUDIO_SAMPLE_RATE);
  head.audioCtx?.resume?.();
}

const SESSION_STATES = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  CONNECTING: 'connecting',
  ACTIVE: 'active',
  ERROR: 'error',
};

function base64ToInt16Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Gemini Live's audio output has no phoneme/word timing attached, so true viseme
// accuracy isn't available. This approximates lip movement from raw loudness instead:
// silent/quiet windows close the mouth, louder windows cycle through open vowel shapes.
//
// We build raw blend-shape animations ('anims', streamLipsyncType: 'blendshapes')
// rather than using the named-viseme path ('visemes', streamLipsyncType: 'visemes').
// TalkingHead's own viseme handler hardcodes the mouth-opening intensity to 0.6
// (0.9 only for PP/FF) with no way to override it from the caller — which reads as
// "barely opens, no visible teeth." Blendshapes let us drive jawOpen/mouthOpen at
// whatever intensity we choose directly, while still cycling through viseme_* shapes
// for some variety. Each anim mirrors the library's own 3-point rise/peak/fall
// envelope shape (see its internal _processLipsyncData) so it composes the same way.
const VISEME_CYCLE = ['aa', 'E', 'I', 'O', 'U'];
const WINDOW_MS = 110;
// Tuned down twice now: 0.9/0.55 (too wide/comical) -> 0.62/0.4 (still a bit wide) ->
// this, a more moderate/natural setting.
const JAW_OPEN_INTENSITY = 0.48;
const MOUTH_OPEN_INTENSITY = 0.3;

function buildAmplitudeBlendshapes(int16, sampleRate, startOffsetMs, cycleState) {
  const windowSize = Math.max(1, Math.round((sampleRate * WINDOW_MS) / 1000));
  const anims = [];

  for (let start = 0; start < int16.length; start += windowSize) {
    const end = Math.min(start + windowSize, int16.length);
    let sumSquares = 0;
    for (let i = start; i < end; i++) {
      const sample = int16[i] / 32768;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / (end - start));
    const windowMs = ((end - start) / sampleRate) * 1000;
    const time = startOffsetMs + (start / sampleRate) * 1000;

    // Adaptive threshold: track a decaying peak rather than assuming a fixed loudness
    // scale, since we don't know in advance how "loud" Gemini's raw PCM output runs.
    cycleState.peak = Math.max(rms, cycleState.peak * 0.985);
    const threshold = Math.max(cycleState.peak * 0.25, 0.006);

    if (rms >= threshold) {
      const loudness = Math.min(1, rms / Math.max(cycleState.peak, 0.02));
      const viseme = VISEME_CYCLE[cycleState.index % VISEME_CYCLE.length];
      cycleState.index += 1;

      anims.push({
        delay: time,
        dt: [windowMs * 0.4, windowMs * 0.6],
        vs: {
          jawOpen: [null, JAW_OPEN_INTENSITY * (0.6 + 0.4 * loudness), 0],
          mouthOpen: [null, MOUTH_OPEN_INTENSITY * (0.6 + 0.4 * loudness), 0],
          ['viseme_' + viseme]: [null, 0.5, 0],
        },
      });
    }
  }

  return anims;
}

const Tutor = () => {
  const [uploadForm, setUploadForm] = useState({ title: '', courseLabel: '', file: null });
  const [sessionState, setSessionState] = useState(SESSION_STATES.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [avatarReady, setAvatarReady] = useState(false);
  const [activeSource, setActiveSource] = useState(null);
  const [board, setBoard] = useState(null);
  const [diagram, setDiagram] = useState(null);
  const [pastSources, setPastSources] = useState([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [wantsNewUpload, setWantsNewUpload] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState('');
  const sourceMenuRef = useRef(null);

  const avatarContainerRef = useRef(null);
  const headRef = useRef(null);
  const liveClientRef = useRef(null);
  const micStreamRef = useRef(null);
  const micContextRef = useRef(null);
  const micWorkletRef = useRef(null);
  const sourceIdRef = useRef('');
  const streamStartedRef = useRef(false);
  const streamElapsedMsRef = useRef(0);
  const visemeCycleRef = useRef({ index: 0, peak: 0 });
  const intentionalCloseRef = useRef(false);
  const reconnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  // Audio no longer plays the instant it arrives — it's queued here and released to the
  // speakers at a pace gated by the whiteboard's own (fixed-speed) typing progress, so
  // the voice waits for the board instead of the board trying to chase the voice. See
  // releaseQueuedAudio below for the actual mechanism.
  const audioQueueRef = useRef([]);
  const boardStartTimeRef = useRef(null); // wall-clock (performance.now()) when current board content started typing; null = nothing to sync against
  const boardDoneRef = useRef(true); // true = board has finished typing (or has no active content) — release audio unthrottled
  const releasedMsRef = useRef(0); // cumulative ms of audio actually released since boardStartTimeRef was last set
  const releaseIntervalRef = useRef(null);
  const turnEndedRef = useRef(true); // Gemini has said turnComplete for the current turn (queue may still have unreleased audio)
  const notifiedEndRef = useRef(true); // guards against calling head.streamNotifyEnd() more than once per turn

  useEffect(() => {
    if (!avatarContainerRef.current || headRef.current) return undefined;

    let cancelled = false;
    // lipsyncModules must stay empty: the library dynamically imports these language
    // modules with a non-static path ('./lipsync-' + lang + '.mjs'), which webpack
    // cannot bundle — it would throw on every load. We stream raw audio only (no
    // text-to-viseme conversion), so these modules are never actually needed.
    const head = new TalkingHead(avatarContainerRef.current, {
      lipsyncModules: [],
      cameraView: 'head',
      modelFPS: 30,
      // The default (0.5) reads as fidgety/erratic for a tutor explaining something —
      // calm this down so the head stays mostly still while occasionally nodding.
      avatarIdleHeadMove: 0.1,
      avatarSpeakingHeadMove: 0.15,
    });
    headRef.current = head;

    head.showAvatar({
      url: DEFAULT_AVATAR_URL,
      body: 'F',
      lipsyncLang: 'en',
    }).then(() => {
      if (!cancelled) setAvatarReady(true);
    }).catch((error) => {
      console.error('Failed to load avatar:', error);
      if (!cancelled) setErrorMessage('Could not load the 3D avatar. Check REACT_APP_TUTOR_AVATAR_URL.');
    });

    return () => {
      cancelled = true;
      // React 18 StrictMode double-invokes effects in development, so this can run
      // before showAvatar() has finished loading — TalkingHead's dispose() assumes a
      // fully-loaded model and throws if called too early. Safe to swallow either way.
      try {
        head.dispose();
      } catch (error) {
        console.warn('TalkingHead dispose warning (safe to ignore):', error);
      }
      if (headRef.current === head) {
        headRef.current = null;
      }
    };
  }, []);

  useEffect(() => () => {
    micWorkletRef.current?.disconnect();
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micContextRef.current?.close().catch(() => {});
    liveClientRef.current?.close();
  }, []);

  const loadPastSources = async () => {
    try {
      const response = await api.get('/tutor/sources');
      const sources = response.data.data.sources || [];
      setPastSources(sources);
      // Default to the most recent upload (already sorted newest-first) so returning
      // students can pick up where they left off with one click, without clobbering a
      // selection already in progress if this reloads later (e.g. after a fresh upload).
      setSelectedSourceId((current) => current || (sources[0]?._id || ''));
    } catch (error) {
      console.error('Failed to load past materials:', error);
    } finally {
      setSourcesLoaded(true);
    }
  };

  useEffect(() => {
    loadPastSources();
  }, []);

  const handleDeleteSource = async (event, source) => {
    // Stops the click from also bubbling to the option's own select button underneath it.
    event.stopPropagation();
    if (!window.confirm(`Delete "${source.title}"? This can't be undone.`)) return;

    setDeletingSourceId(source._id);
    try {
      await api.delete(`/tutor/sources/${source._id}`);
      const remaining = pastSources.filter((item) => item._id !== source._id);
      setPastSources(remaining);
      if (selectedSourceId === source._id) {
        setSelectedSourceId(remaining[0]?._id || '');
      }
    } catch (error) {
      console.error('Failed to delete material:', error);
      setErrorMessage(error.response?.data?.message || 'Could not delete this material.');
    } finally {
      setDeletingSourceId('');
    }
  };

  useEffect(() => {
    if (!sourceMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(event.target)) {
        setSourceMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setSourceMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [sourceMenuOpen]);

  const stopMic = () => {
    micWorkletRef.current?.disconnect();
    micWorkletRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    micContextRef.current?.close().catch(() => {});
    micContextRef.current = null;
  };

  const startMic = async () => {
    // Ask the browser for echo cancellation so the mic doesn't pick the avatar's own
    // voice back up and forward it to Gemini as if the student were talking over it.
    // We deliberately do NOT also suppress mic input while the model is speaking —
    // that would silently drop genuine "wait"/"pause" interruptions from the student.
    // Gemini's own server-side VAD is what decides whether incoming audio counts as a
    // real barge-in (see onInterrupted below); AEC is enough defense against feedback.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    micStreamRef.current = stream;

    const audioContext = new AudioContext({ sampleRate: 16000 });
    micContextRef.current = audioContext;
    await audioContext.audioWorklet.addModule('/worklets/capture-processor.js');

    const source = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, 'capture-processor');
    micWorkletRef.current = workletNode;

    workletNode.port.onmessage = (event) => {
      const base64 = arrayBufferToBase64(event.data);
      liveClientRef.current?.sendAudioChunk(base64);
    };

    source.connect(workletNode);
  };

  // Releases queued audio chunks to the avatar's speaker output, gated by how much wall
  // time has passed since the board started typing (the board itself now just types at
  // a fixed pace, no audio awareness at all — see Whiteboard.js). When there's no active
  // board content to sync against, audio drains immediately for lowest latency.
  const releaseQueuedAudio = () => {
    const head = headRef.current;
    if (!head) return;

    while (audioQueueRef.current.length > 0) {
      const allowedMs = boardDoneRef.current || boardStartTimeRef.current === null
        ? Infinity
        : performance.now() - boardStartTimeRef.current;
      if (releasedMsRef.current >= allowedMs) break;

      const { int16, durationMs } = audioQueueRef.current.shift();
      if (!streamStartedRef.current) {
        head.streamStart({ sampleRate: AUDIO_SAMPLE_RATE, lipsyncType: 'blendshapes' });
        streamStartedRef.current = true;
      }
      const anims = buildAmplitudeBlendshapes(int16, AUDIO_SAMPLE_RATE, streamElapsedMsRef.current, visemeCycleRef.current);
      streamElapsedMsRef.current += durationMs;
      releasedMsRef.current += durationMs;
      head.streamAudio({ audio: int16, anims });
    }

    // Gemini said turnComplete a while ago and the queue has now actually finished
    // draining (everything's been released) — only now is it true that streaming has
    // ended, regardless of when Gemini itself said so.
    if (turnEndedRef.current && !notifiedEndRef.current && audioQueueRef.current.length === 0) {
      head.streamNotifyEnd();
      notifiedEndRef.current = true;
      // The library resets its audio-start anchor to null after each pause between
      // turns, then re-anchors on the next turn's first chunk — so our cumulative
      // offset must restart from 0 too, or the next turn's visemes land too early.
      streamElapsedMsRef.current = 0;
    }
  };

  // Runs for the component's whole lifetime (cheap no-op when there's nothing queued),
  // rather than being started/stopped per session — releaseQueuedAudio only ever reads
  // refs, never state/props, so this doesn't need to re-subscribe on every render.
  useEffect(() => {
    releaseIntervalRef.current = setInterval(releaseQueuedAudio, 30);
    return () => clearInterval(releaseIntervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whiteboard/DiagramBoard both list this in a typewriter/dwell effect's dependency
  // array — passing a fresh arrow function here on every Tutor render would reset that
  // effect (and restart its pending timeout) on any unrelated re-render while a board is
  // still mid-reveal, not just when the board actually finishes. useCallback keeps the
  // identity stable so the effect only re-runs for reasons that actually matter.
  const handleBoardComplete = useCallback(() => {
    boardDoneRef.current = true;
  }, []);

  const handleToolCall = async (functionCalls) => {
    try {
      const responses = await Promise.all(functionCalls.map(async (call) => {
        if (call.name === 'show_working') {
          // Gemini's function calling occasionally hands back an array-typed parameter
          // as a JSON-encoded STRING instead of a real array (a known quirk of LLM tool
          // calling, not specific to our prompt) — Array.isArray on that string was
          // silently false, so `lines` fell through to [], we still showed an "empty"
          // board (which just renders nothing, see Whiteboard's lines.length===0 guard),
          // and still told Gemini it succeeded. That's exactly the "board never shows
          // until you ask again" bug: the model had no idea its call was effectively a
          // no-op, so it never retried on its own — only a fresh student question
          // happened to produce a valid call later. Coerce the string case here, and
          // when lines still comes up empty, leave whatever's on the board alone
          // (no erase-to-blank) and tell Gemini the call failed so it retries now.
          let lines = call.args?.lines;
          if (typeof lines === 'string') {
            try {
              const parsed = JSON.parse(lines);
              lines = Array.isArray(parsed) ? parsed : [lines];
            } catch (error) {
              lines = lines ? [lines] : [];
            }
          }
          if (!Array.isArray(lines)) lines = [];
          lines = lines.filter((line) => typeof line === 'string' && line.trim().length > 0);

          if (lines.length === 0) {
            return {
              id: call.id,
              name: call.name,
              response: { result: 'No lines were received. Call show_working again with the full ordered lines array.' },
            };
          }

          setDiagram(null);
          setBoard({ title: call.args?.title || '', lines });
          // A new board just started typing (at its own fixed pace) — anchor audio
          // release to this exact moment so narration waits to match it, instead of
          // racing ahead the instant more audio arrives.
          boardStartTimeRef.current = performance.now();
          boardDoneRef.current = false;
          releasedMsRef.current = 0;
          return { id: call.id, name: call.name, response: { result: 'Shown to the student.' } };
        }

        if (call.name === 'draw_diagram') {
          const mermaidText = typeof call.args?.mermaid === 'string' ? call.args.mermaid.trim() : '';

          if (!mermaidText) {
            return {
              id: call.id,
              name: call.name,
              response: { result: 'No diagram was received. Call draw_diagram again with valid Mermaid syntax.' },
            };
          }

          setBoard(null);
          setDiagram({ title: call.args?.title || '', mermaid: mermaidText });
          // Same audio-gating anchor as show_working — see releaseQueuedAudio/DiagramBoard's
          // own dwell period for how "done" gets signalled for a diagram instead of a typed line.
          boardStartTimeRef.current = performance.now();
          boardDoneRef.current = false;
          releasedMsRef.current = 0;
          return { id: call.id, name: call.name, response: { result: 'Drawn on the board for the student.' } };
        }

        if (call.name === 'search_course_material') {
          // Theresa is now prompted to say something out loud before this runs, but
          // that's only a spoken cue — this is the visual backstop for the actual
          // wait, so it's never just silence + a static "Listening..." label if the
          // search happens to take a moment.
          setStatusMessage('Checking your material...');
          const stillCheckingTimer = setTimeout(() => {
            setStatusMessage('Still checking your material...');
          }, 2500);
          try {
            const response = await api.post(`/tutor/sources/${sourceIdRef.current}/search`, {
              query: call.args?.query || '',
            });
            return { id: call.id, name: call.name, response: { result: response.data.data.results } };
          } catch (error) {
            return { id: call.id, name: call.name, response: { result: 'Search failed.' } };
          } finally {
            clearTimeout(stillCheckingTimer);
            setStatusMessage('Listening. Ask Theresa anything about this material.');
          }
        }

        return { id: call.id, name: call.name, response: { result: 'Unknown tool.' } };
      }));
      liveClientRef.current?.sendToolResponse(responses);
    } catch (error) {
      console.error('Error handling tool call:', error, functionCalls);
    }
  };

  // Builds and connects a fresh GeminiLiveClient for `sourceId`, wiring it to the avatar
  // and whiteboard. Used both for the initial session start and for the seamless
  // reconnect triggered by onGoAway (see reconnectSession below) — the two cases only
  // differ in whether a resumptionHandle is carried over and whether the mic needs
  // (re)starting, both handled by the caller.
  const connectLiveSession = async (sourceId, { resumptionHandle } = {}) => {
    const tokenResponse = await api.post('/tutor/session-token', { sourceId });
    const { token, model } = tokenResponse.data.data;
    const head = headRef.current;

    const client = new GeminiLiveClient({
      token,
      model,
      resumptionHandle,
      onOpen: () => {
        reconnectAttemptsRef.current = 0;
        setSessionState(SESSION_STATES.ACTIVE);
        setStatusMessage('Listening. Ask Theresa anything about this material.');
      },
      onAudio: (base64Audio) => {
        // Queue only — released later, gated by board progress, in releaseQueuedAudio.
        turnEndedRef.current = false;
        notifiedEndRef.current = false;
        const int16 = base64ToInt16Array(base64Audio);
        audioQueueRef.current.push({ int16, durationMs: (int16.length / AUDIO_SAMPLE_RATE) * 1000 });
      },
      onToolCall: handleToolCall,
      onTurnComplete: () => {
        // No MORE audio is coming for this turn, but whatever's already queued may not
        // have finished playing yet (that's the whole point — it's gated by the board's
        // pace, not Gemini's). releaseQueuedAudio notifies the avatar once the queue is
        // actually empty, not the instant this fires.
        turnEndedRef.current = true;
      },
      onInterrupted: () => {
        audioQueueRef.current = [];
        head.streamInterrupt();
        streamElapsedMsRef.current = 0;
      },
      onGoAway: (timeLeftMs) => {
        // Audio-only Live sessions hit a hard 15-minute server limit. Gemini warns us
        // here before dropping the connection — reconnect now, ahead of time, using the
        // resumption handle so the student never sees the session actually die.
        console.warn(`Tutor session ending in ${timeLeftMs}ms; reconnecting seamlessly...`);
        reconnectSession();
      },
      onError: (event) => {
        if (liveClientRef.current !== client) return; // stale client from a completed reconnect
        console.error('Tutor session error:', event);
        setErrorMessage('Lost connection to the tutor. Please try again.');
        setSessionState(SESSION_STATES.ERROR);
      },
      onClose: (event) => {
        // A reconnect swaps liveClientRef.current to a new client, then closes this one —
        // that close event arrives asynchronously later, after the swap. Checking identity
        // (rather than a timing-based flag) is what correctly tells old closes from real ones.
        if (liveClientRef.current !== client) return;
        if (intentionalCloseRef.current) {
          setSessionState(SESSION_STATES.IDLE);
          setStatusMessage('');
          return;
        }
        const detail = event?.reason ? `${event.code}: ${event.reason}` : `code ${event?.code ?? 'unknown'}`;
        console.error('Tutor session closed unexpectedly:', detail);

        // Some closes on this preview model aren't caused by anything wrong on our end
        // (verified directly against the live API — see notes near MAX_RECONNECT_ATTEMPTS).
        // Retry a few times before bothering the student with an error.
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          setStatusMessage('Reconnecting to Theresa...');
          reconnectSession();
          return;
        }

        setErrorMessage(`The tutor session ended unexpectedly (${detail}). Please try again.`);
        setSessionState(SESSION_STATES.ERROR);
      },
    });

    await client.connect();
    return client;
  };

  const reconnectSession = async () => {
    if (reconnectingRef.current || !sourceIdRef.current) return;
    reconnectingRef.current = true;
    const oldClient = liveClientRef.current;
    try {
      const resumptionHandle = oldClient?.getResumptionHandle?.();
      const newClient = await connectLiveSession(sourceIdRef.current, { resumptionHandle });
      liveClientRef.current = newClient;
      oldClient?.close();
    } catch (error) {
      console.error('Failed to reconnect tutor session:', error);
      setErrorMessage('Lost connection to the tutor and could not reconnect. Please try again.');
      setSessionState(SESSION_STATES.ERROR);
    } finally {
      reconnectingRef.current = false;
    }
  };

  const beginSession = async (sourceId, title) => {
    sourceIdRef.current = sourceId;
    setActiveSource({ id: sourceId, title });

    setStatusMessage('Connecting to Theresa...');
    setSessionState(SESSION_STATES.CONNECTING);

    streamStartedRef.current = false;
    streamElapsedMsRef.current = 0;
    visemeCycleRef.current = { index: 0, peak: 0 };
    intentionalCloseRef.current = false;
    reconnectAttemptsRef.current = 0;
    audioQueueRef.current = [];
    boardStartTimeRef.current = null;
    boardDoneRef.current = true;
    releasedMsRef.current = 0;
    turnEndedRef.current = true;
    notifiedEndRef.current = true;

    const client = await connectLiveSession(sourceId);
    liveClientRef.current = client;
    // Only on the initial start, not on silent goAway/error reconnects (which reuse
    // connectLiveSession too) — otherwise the tutor would re-greet the student every
    // time a reconnect happens behind the scenes.
    client.sendTextTurn('__SESSION_START__');

    try {
      await startMic();
    } catch (error) {
      // connectLiveSession's onOpen already fired by the time we get here (setupComplete
      // arrives before this function's await returns), so the Live session is open and
      // Theresa may already be greeting the student — but without a working mic she can
      // never hear them back. Left alone, that's a connected, billable, one-way session
      // with no visible "End Session" button (isActive flips false once the caller below
      // sets sessionState to ERROR) — a real stuck-and-uncontrollable state, not just an
      // error message. Tear the connection down immediately instead of leaving it orphaned.
      intentionalCloseRef.current = true;
      client.close();
      liveClientRef.current = null;
      headRef.current?.streamStop();
      streamStartedRef.current = false;
      audioQueueRef.current = [];

      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        throw new Error('Microphone access was blocked. Please allow microphone access for this site in your browser settings, then try again.');
      }
      throw error;
    }
  };

  const startSession = async () => {
    if (!uploadForm.file || !headRef.current) return;

    unlockAudioForMobile(headRef.current);

    try {
      setErrorMessage('');
      setBoard(null);
      setDiagram(null);
      setSessionState(SESSION_STATES.UPLOADING);
      setStatusMessage('Uploading your file...');

      // Vercel's serverless functions hard-cap request bodies at 4.5MB, which most real
      // course material (scanned PDFs, slide decks) blows past — sending the file
      // through our own /tutor/upload endpoint as multipart would just fail for anyone
      // with a real document. Instead, upload the file straight from the browser to
      // Cloudinary (same signed-upload pattern StudentDashboard.js already uses for the
      // exact same reason), then hand our backend only the resulting URL — a JSON body
      // nowhere near the size limit.
      const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.REACT_APP_CLOUDINARY_API_KEY;
      if (!cloudName || !apiKey) {
        throw new Error('Cloudinary configuration is missing on the frontend');
      }

      const signatureResponse = await api.post('/tutor/upload-signature');
      const { timestamp, signature, folder } = signatureResponse.data.data;

      const cloudinaryData = new FormData();
      cloudinaryData.append('file', uploadForm.file);
      cloudinaryData.append('api_key', apiKey);
      cloudinaryData.append('timestamp', timestamp);
      cloudinaryData.append('signature', signature);
      cloudinaryData.append('folder', folder);

      const cloudinaryResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
        method: 'POST',
        body: cloudinaryData,
      });
      const cloudinaryJson = await cloudinaryResp.json().catch(() => null);
      if (!cloudinaryResp.ok) {
        throw new Error(cloudinaryJson?.error?.message || 'Failed to upload your file to storage.');
      }

      const cloudinaryUrl = cloudinaryJson?.secure_url;
      const cloudinaryPublicId = cloudinaryJson?.public_id;
      if (!cloudinaryUrl || !cloudinaryPublicId) {
        throw new Error('Upload failed. Missing storage reference for uploaded file.');
      }

      setStatusMessage('Reading your material. This can take a minute for larger files...');

      const uploadResponse = await api.post('/tutor/upload', {
        title: uploadForm.title || uploadForm.file.name,
        courseLabel: uploadForm.courseLabel,
        cloudinaryUrl,
        cloudinaryPublicId,
        fileType: uploadForm.file.type,
        originalFilename: uploadForm.file.name,
      });
      const { sourceId, title } = uploadResponse.data.data;
      loadPastSources();
      await beginSession(sourceId, title);
    } catch (error) {
      console.error('Failed to start tutor session:', error);
      const message = error.response?.data?.error?.message
        || error.response?.data?.message
        || error.message
        || 'Could not start the tutor session.';
      setErrorMessage(message);
      setSessionState(SESSION_STATES.ERROR);
    }
  };

  const continueWithSource = async (source) => {
    if (!headRef.current) return;
    unlockAudioForMobile(headRef.current);
    try {
      setErrorMessage('');
      setBoard(null);
      setDiagram(null);
      await beginSession(source._id, source.title);
    } catch (error) {
      console.error('Failed to resume tutor session:', error);
      setErrorMessage(error.response?.data?.message || 'Could not start the tutor session.');
      setSessionState(SESSION_STATES.ERROR);
    }
  };

  const endSession = () => {
    intentionalCloseRef.current = true;
    stopMic();
    liveClientRef.current?.close();
    liveClientRef.current = null;
    headRef.current?.streamStop();
    streamStartedRef.current = false;
    audioQueueRef.current = [];
    boardStartTimeRef.current = null;
    boardDoneRef.current = true;
    setSessionState(SESSION_STATES.IDLE);
    setStatusMessage('');
    setActiveSource(null);
    setBoard(null);
    setDiagram(null);
    setUploadForm({ title: '', courseLabel: '', file: null });
    setWantsNewUpload(false);
  };

  const isBusy = sessionState === SESSION_STATES.UPLOADING || sessionState === SESSION_STATES.CONNECTING;
  const isActive = sessionState === SESSION_STATES.ACTIVE;
  const selectedSource = pastSources.find((source) => source._id === selectedSourceId) || null;
  // Gating on sourcesLoaded (not just pastSources.length) matters: pastSources starts
  // as [] before the fetch resolves, which used to make this default to "show upload
  // form" for a frame, then flip to the dropdown once real data arrived — a visible
  // flash on every page load. Waiting for sourcesLoaded means nothing in this section
  // renders until we actually know which case applies.
  const showUploadFields = sourcesLoaded && (pastSources.length === 0 || wantsNewUpload);
  const primaryLabel = !sourcesLoaded
    ? 'Loading...'
    : !avatarReady
      ? 'Loading avatar...'
      : isBusy
        ? (showUploadFields ? 'Starting...' : 'Connecting...')
        : (showUploadFields ? 'Start Session' : 'Continue Session');
  const primaryDisabled = !sourcesLoaded || !avatarReady || isBusy || (showUploadFields ? !uploadForm.file : !selectedSource);
  const handlePrimaryAction = () => {
    if (showUploadFields) startSession();
    else if (selectedSource) continueWithSource(selectedSource);
  };

  return (
    <div className="tutor-page">
      <div className="tutor-avatar-bubble">
        <div className="tutor-avatar-canvas" ref={avatarContainerRef}>
          {!avatarReady && (
            <div className="tutor-avatar-loading">
              <span className="tutor-spinner" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      {isActive && (
        <div className="tutor-session-bar">
          <div>
            <span className="tutor-session-label">Now studying</span>
            <strong>{activeSource?.title}</strong>
          </div>
          {statusMessage && <span className="tutor-session-status">{statusMessage}</span>}
          <button type="button" className="btn btn-outline-primary tutor-end-btn" onClick={endSession}>
            End Session
          </button>
        </div>
      )}

      {errorMessage && <p className="tutor-error-banner">{errorMessage}</p>}

      <div className="tutor-board-stage">
        {!isActive ? (
          <div className="tutor-setup-card">
            <div className="tutor-setup-header">
              <p className="tutor-kicker">Theresa</p>
              <h1>Learn With Theresa</h1>
              <p className="tutor-setup-intro">Upload the material you want to learn, then ask Theresa anything. Solutions and explanations will be written out right here.</p>
            </div>

            {!avatarReady && (
              <div className="tutor-avatar-status">
                <span className="tutor-spinner" aria-hidden="true" />
                <span>Preparing Theresa's avatar — this only takes a moment, hang tight...</span>
              </div>
            )}

            {sourcesLoaded && pastSources.length > 0 && !wantsNewUpload && (
              <div className="tutor-source-select" ref={sourceMenuRef}>
                <span className="tutor-field-label">Choose material</span>
                <button
                  type="button"
                  className={`tutor-source-trigger ${sourceMenuOpen ? 'is-open' : ''}`}
                  onClick={() => setSourceMenuOpen((open) => !open)}
                  disabled={isBusy}
                  aria-haspopup="listbox"
                  aria-expanded={sourceMenuOpen}
                >
                  <FiBookOpen className="tutor-select-icon" aria-hidden="true" />
                  <span className="tutor-source-trigger-label">{selectedSource?.title || 'Select material'}</span>
                  <FiChevronDown className={`tutor-select-caret ${sourceMenuOpen ? 'is-open' : ''}`} aria-hidden="true" />
                </button>

                {sourceMenuOpen && (
                  <div className="tutor-source-menu" role="listbox">
                    {pastSources.map((source) => (
                      <div
                        key={source._id}
                        role="option"
                        aria-selected={source._id === selectedSourceId}
                        className={`tutor-source-option ${source._id === selectedSourceId ? 'is-selected' : ''}`}
                      >
                        <button
                          type="button"
                          className="tutor-source-option-main"
                          onClick={() => { setSelectedSourceId(source._id); setSourceMenuOpen(false); }}
                        >
                          <FiBookOpen aria-hidden="true" />
                          <span className="tutor-source-option-text">
                            <strong>{source.title}</strong>
                            {source.courseLabel && <span>{source.courseLabel}</span>}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="tutor-source-option-delete"
                          onClick={(event) => handleDeleteSource(event, source)}
                          disabled={deletingSourceId === source._id}
                          aria-label={`Delete ${source.title}`}
                          title="Delete this material"
                        >
                          <FiTrash2 aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sourcesLoaded && pastSources.length > 0 && (
              <button
                type="button"
                className="tutor-upload-toggle"
                onClick={() => setWantsNewUpload((current) => !current)}
                disabled={isBusy}
              >
                {wantsNewUpload ? (
                  <><FiArrowLeft aria-hidden="true" /> Back to your materials</>
                ) : (
                  <><FiPlusCircle aria-hidden="true" /> Upload new material instead</>
                )}
              </button>
            )}

            {showUploadFields && (
              <>
                <label>
                  <span>Title (optional)</span>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="e.g. GST 105 Chapter 3"
                    disabled={isBusy}
                  />
                </label>

                <label>
                  <span>Course (optional)</span>
                  <input
                    type="text"
                    value={uploadForm.courseLabel}
                    onChange={(event) => setUploadForm((current) => ({ ...current, courseLabel: event.target.value }))}
                    placeholder="e.g. GST 105"
                    disabled={isBusy}
                  />
                </label>

                <label className="tutor-file-label">
                  <span>Document</span>
                  <div className="tutor-file-input">
                    <FiUploadCloud aria-hidden="true" />
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                      disabled={isBusy}
                    />
                  </div>
                </label>
              </>
            )}

            <button
              type="button"
              className="btn btn-primary tutor-action-btn"
              onClick={handlePrimaryAction}
              disabled={primaryDisabled}
            >
              {primaryLabel}
            </button>
          </div>
        ) : board ? (
          <Whiteboard
            title={board.title}
            lines={board.lines}
            onComplete={handleBoardComplete}
          />
        ) : diagram ? (
          <DiagramBoard
            title={diagram.title}
            mermaid={diagram.mermaid}
            onComplete={handleBoardComplete}
          />
        ) : (
          <div className="tutor-board-placeholder">
            <p>Ask Theresa a question. The explanation will be written out here as she talks.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tutor;
