export default class GeminiLiveClient {
  constructor({
    token, model, systemInstruction, tools, speechConfig, resumptionHandle,
    onAudio, onToolCall, onTurnComplete, onOpen, onClose, onError, onInterrupted, onGoAway,
  }) {
    this.token = token;
    this.model = model;
    this.systemInstruction = systemInstruction;
    this.tools = tools;
    this.speechConfig = speechConfig;
    this.resumptionHandle = resumptionHandle || null;
    this.onAudio = onAudio;
    this.onToolCall = onToolCall;
    this.onTurnComplete = onTurnComplete;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onError = onError;
    this.onInterrupted = onInterrupted;
    this.onGoAway = onGoAway;
    this.ws = null;
  }

  // Audio-only Live sessions hit a hard 15-minute server-side limit. Gemini warns via a
  // goAway message before dropping the connection, and periodically hands out a
  // sessionResumptionUpdate handle that a NEW connection can present to continue the
  // same logical conversation instead of losing context. Callers should reconnect with
  // this handle when onGoAway fires.
  getResumptionHandle() {
    return this.resumptionHandle;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${this.token}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // The "Constrained" endpoint validates that the client's own setup message
        // matches what's locked into the ephemeral token's liveConnectConstraints —
        // it does NOT simply apply the constraint regardless of what the client sends.
        // So the client must echo the same systemInstruction/tools/responseModalities
        // the backend used when minting the token, or the session errors out.
        this.ws.send(JSON.stringify({
          setup: {
            model: `models/${this.model}`,
            // speechConfig lives INSIDE generationConfig on the raw WebSocket protocol —
            // unlike the Node SDK's flattened LiveConnectConfig shape (where it sits
            // alongside responseModalities), the wire format nests it here. Placing it as
            // a top-level sibling of generationConfig produces:
            // 'Unknown name "speechConfig" at setup: Cannot find field.'
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: this.speechConfig || undefined,
            },
            systemInstruction: { parts: [{ text: this.systemInstruction || '' }] },
            tools: this.tools || [],
            sessionResumption: this.resumptionHandle ? { handle: this.resumptionHandle } : {},
          },
        }));
        // Do NOT resolve here: the server hasn't actually processed the setup message
        // yet, only received it. Until it replies with setupComplete, the session is
        // still in its default (non-audio) state — sending realtimeInput audio in that
        // window is what produces "audio content type not supported for this model
        // configuration" errors. Resolve connect() only once setupComplete arrives, so
        // callers (Tutor.js starts the mic right after connect() resolves) never race it.
        this._setupResolve = resolve;
      };

      this.ws.onerror = (event) => {
        console.error('Gemini Live WebSocket error:', event);
        this.onError?.(event);
        reject(event);
      };

      this.ws.onclose = (event) => {
        console.warn('Gemini Live WebSocket closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        this.onClose?.(event);
      };

      this.ws.onmessage = async (event) => {
        let raw = event.data;
        if (raw instanceof Blob) {
          raw = await raw.text();
        }
        let message;
        try {
          message = typeof raw === 'string' ? JSON.parse(raw) : null;
        } catch (error) {
          console.error('Failed to parse Gemini Live message', error, raw);
          return;
        }
        if (!message) return;
        try {
          this._handleMessage(message);
        } catch (error) {
          console.error('Error handling Gemini Live message', error, message);
        }
      };
    });
  }

  _handleMessage(message) {
    if (message.setupComplete) {
      this.onOpen?.();
      this._setupResolve?.();
      this._setupResolve = null;
      return;
    }

    // Note: a single message can carry a toolCall alongside serverContent (audio,
    // turnComplete, etc.) — handle both instead of returning early after the tool call,
    // or audio bundled in the same message would silently get dropped.
    if (message.toolCall?.functionCalls?.length) {
      this.onToolCall?.(message.toolCall.functionCalls);
    }

    const parts = message.serverContent?.modelTurn?.parts || [];
    parts.forEach((part) => {
      if (part.inlineData?.data) {
        this.onAudio?.(part.inlineData.data);
      }
    });

    if (message.serverContent?.interrupted) {
      this.onInterrupted?.();
    }

    if (message.serverContent?.turnComplete) {
      this.onTurnComplete?.();
    }

    if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate?.newHandle) {
      this.resumptionHandle = message.sessionResumptionUpdate.newHandle;
    }

    if (message.goAway) {
      this.onGoAway?.(message.goAway.timeLeft);
    }
  }

  sendAudioChunk(base64Pcm) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      realtimeInput: {
        audio: { mimeType: 'audio/pcm;rate=16000', data: base64Pcm },
      },
    }));
  }

  sendToolResponse(functionResponses) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ toolResponse: { functionResponses } }));
  }

  // The model otherwise waits for the student to speak first. To make the tutor greet
  // the student proactively as soon as it's ready, the caller sends one hidden
  // clientContent turn right after connecting — see systemInstruction's handling of the
  // literal "__SESSION_START__" cue for how the model is told to treat this.
  sendTextTurn(text) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      },
    }));
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
