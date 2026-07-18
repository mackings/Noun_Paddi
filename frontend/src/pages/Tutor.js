import React, { useEffect, useRef, useState } from 'react';
import { TalkingHead } from '@met4citizen/talkinghead';
import api from '../utils/api';
import GeminiLiveClient from '../utils/geminiLiveClient';
import Whiteboard from '../components/Whiteboard';
import './Tutor.css';

// Ready Player Me's hosting service shut down (acquired by Netflix, sunset Jan 2026),
// so we self-host a sample avatar instead of depending on any external CDN.
// "brunette.glb" is TalkingHead's own demo avatar, free for non-commercial use
// (CC BY-NC 4.0) per https://github.com/met4citizen/TalkingHead — served from
// frontend/public/avatars/. Override with REACT_APP_TUTOR_AVATAR_URL if you have
// your own GLB avatar to use instead.
const DEFAULT_AVATAR_URL = process.env.REACT_APP_TUTOR_AVATAR_URL || '/avatars/brunette.glb';

// This is a preview model, and we've directly verified (by testing several concrete
// hypotheses against the real API) that at least some fraction of mid-session closes
// aren't caused by anything in our own protocol usage — they're transient server-side
// hiccups. Rather than hard-failing the student's session on one of those, retry a
// bounded number of times using the same reconnect path built for the graceful
// 15-minute goAway case, and only surface an error once retries are exhausted.
const MAX_RECONNECT_ATTEMPTS = 3;

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
const JAW_OPEN_INTENSITY = 0.9;
const MOUTH_OPEN_INTENSITY = 0.55;

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
  const [pastSources, setPastSources] = useState([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  // Drives the whiteboard's writing pace directly off real audio playback time (rather
  // than an independent timer), so the board can never race ahead of what's being said.
  const [audioElapsedMs, setAudioElapsedMs] = useState(0);
  const [speechTurnComplete, setSpeechTurnComplete] = useState(true);

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
      setPastSources(response.data.data.sources || []);
    } catch (error) {
      console.error('Failed to load past materials:', error);
    } finally {
      setSourcesLoaded(true);
    }
  };

  useEffect(() => {
    loadPastSources();
  }, []);

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

  const handleToolCall = async (functionCalls) => {
    try {
      const responses = await Promise.all(functionCalls.map(async (call) => {
        if (call.name === 'show_working') {
          const lines = Array.isArray(call.args?.lines) ? call.args.lines : [];
          setBoard({ title: call.args?.title || '', lines });
          return { id: call.id, name: call.name, response: { result: 'Shown to the student.' } };
        }

        if (call.name === 'search_course_material') {
          try {
            const response = await api.post(`/tutor/sources/${sourceIdRef.current}/search`, {
              query: call.args?.query || '',
            });
            return { id: call.id, name: call.name, response: { result: response.data.data.results } };
          } catch (error) {
            return { id: call.id, name: call.name, response: { result: 'Search failed.' } };
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
    const { token, model, systemInstruction, tools, speechConfig } = tokenResponse.data.data;
    const head = headRef.current;

    const client = new GeminiLiveClient({
      token,
      model,
      systemInstruction,
      tools,
      speechConfig,
      resumptionHandle,
      onOpen: () => {
        reconnectAttemptsRef.current = 0;
        setSessionState(SESSION_STATES.ACTIVE);
        setStatusMessage('Listening. Ask Theresa anything about this material.');
      },
      onAudio: (base64Audio) => {
        setSpeechTurnComplete(false);
        if (!streamStartedRef.current) {
          head.streamStart({ sampleRate: 24000, lipsyncType: 'blendshapes' });
          streamStartedRef.current = true;
        }
        const int16 = base64ToInt16Array(base64Audio);
        const anims = buildAmplitudeBlendshapes(
          int16,
          24000,
          streamElapsedMsRef.current,
          visemeCycleRef.current
        );
        streamElapsedMsRef.current += (int16.length / 24000) * 1000;
        setAudioElapsedMs(streamElapsedMsRef.current);
        head.streamAudio({ audio: int16, anims });
      },
      onToolCall: handleToolCall,
      onTurnComplete: () => {
        head.streamNotifyEnd();
        // The library resets its audio-start anchor to null after each pause between
        // turns, then re-anchors on the next turn's first chunk — so our cumulative
        // offset must restart from 0 too, or the next turn's visemes land too early.
        streamElapsedMsRef.current = 0;
        setSpeechTurnComplete(true);
      },
      onInterrupted: () => {
        head.streamInterrupt();
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
    setAudioElapsedMs(0);
    setSpeechTurnComplete(true);

    const client = await connectLiveSession(sourceId);
    liveClientRef.current = client;
    // Only on the initial start, not on silent goAway/error reconnects (which reuse
    // connectLiveSession too) — otherwise the tutor would re-greet the student every
    // time a reconnect happens behind the scenes.
    client.sendTextTurn('__SESSION_START__');
    await startMic();
  };

  const startSession = async () => {
    if (!uploadForm.file || !headRef.current) return;

    try {
      setErrorMessage('');
      setBoard(null);
      setSessionState(SESSION_STATES.UPLOADING);
      setStatusMessage('Reading your material. This can take a minute for larger files...');

      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('title', uploadForm.title || uploadForm.file.name);
      formData.append('courseLabel', uploadForm.courseLabel);

      const uploadResponse = await api.post('/tutor/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { sourceId, title } = uploadResponse.data.data;
      loadPastSources();
      await beginSession(sourceId, title);
    } catch (error) {
      console.error('Failed to start tutor session:', error);
      setErrorMessage(error.response?.data?.message || 'Could not start the tutor session.');
      setSessionState(SESSION_STATES.ERROR);
    }
  };

  const continueWithSource = async (source) => {
    if (!headRef.current) return;
    try {
      setErrorMessage('');
      setBoard(null);
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
    setSessionState(SESSION_STATES.IDLE);
    setStatusMessage('');
    setActiveSource(null);
    setBoard(null);
    setUploadForm({ title: '', courseLabel: '', file: null });
  };

  const isBusy = sessionState === SESSION_STATES.UPLOADING || sessionState === SESSION_STATES.CONNECTING;
  const isActive = sessionState === SESSION_STATES.ACTIVE;

  return (
    <div className="tutor-page">
      <div className="tutor-avatar-bubble">
        <div className="tutor-avatar-canvas" ref={avatarContainerRef}>
          {!avatarReady && <div className="tutor-avatar-loading">...</div>}
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
            <p className="tutor-kicker">Theresa</p>
            <h1>Learn With Theresa</h1>
            <p>Upload the material you want to learn, then ask Theresa anything. Solutions and explanations will be written out right here.</p>

            {sourcesLoaded && pastSources.length > 0 && (
              <div className="tutor-past-sources">
                <span className="tutor-past-sources-label">Continue with material you already uploaded</span>
                <ul className="tutor-past-sources-list">
                  {pastSources.map((source) => (
                    <li key={source._id}>
                      <button
                        type="button"
                        className="tutor-past-source-btn"
                        onClick={() => continueWithSource(source)}
                        disabled={isBusy}
                      >
                        <strong>{source.title}</strong>
                        {source.courseLabel && <span>{source.courseLabel}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                <span className="tutor-past-sources-divider">or upload something new</span>
              </div>
            )}

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

            <label>
              <span>Document</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                disabled={isBusy}
              />
            </label>

            <button
              type="button"
              className="btn btn-primary tutor-action-btn"
              onClick={startSession}
              disabled={!uploadForm.file || isBusy || !avatarReady}
            >
              {isBusy ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        ) : board ? (
          <Whiteboard
            title={board.title}
            lines={board.lines}
            elapsedMs={audioElapsedMs}
            turnComplete={speechTurnComplete}
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
