/**
 * WebSocket audio client for SpeakFlow audio rooms.
 */

export class WSAudioClient {
  private mediaRecorder: MediaRecorder | null = null;
  private _localStream: MediaStream | null = null;
  private remoteAudioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private _isMuted: boolean = false;
  private _mimeType: string = "";
  private _playbackReadyPromise: Promise<void> | null = null;
  private _playbackReadyResolve: (() => void) | null = null;
  private _pendingChunks: ArrayBuffer[] = [];
  private _isAppending = false;

  get isMuted(): boolean { return this._isMuted; }
  get remoteAudioElement(): HTMLAudioElement | null { return this.remoteAudioEl; }
  get localStream(): MediaStream | null { return this._localStream; }

  onAudioData: ((buffer: ArrayBuffer) => void) | null = null;

  // ------------------------------------------------------------------
  // Microphone
  // ------------------------------------------------------------------

  async startMicrophone(): Promise<void> {
    try {
      this._localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      console.error("[WSAudio] Microphone error:", err);
      throw err;
    }

    this._mimeType = this.getSupportedMimeType();
    this.startMediaRecorder();
    console.log(`[WSAudio] MediaRecorder started: ${this._mimeType || "default"}`);
  }

  private getSupportedMimeType(): string {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4;codecs=opus",
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "";
  }

  private startMediaRecorder(): void {
    if (!this._localStream) return;
    
    const options: MediaRecorderOptions = {};
    if (this._mimeType) options.mimeType = this._mimeType;
    options.audioBitsPerSecond = 32000;

    this.mediaRecorder = new MediaRecorder(this._localStream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && !this._isMuted) {
        event.data.arrayBuffer().then((buffer) => {
          this.onAudioData?.(buffer);
        });
      }
    };

    this.mediaRecorder.start(100);
  }

  restartMediaRecorder(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }
    this.startMediaRecorder();
    console.log("[WSAudio] MediaRecorder restarted - fresh WebM header generated");
  }

  // ------------------------------------------------------------------
  // Playback
  // ------------------------------------------------------------------

  async startPlayback(): Promise<HTMLAudioElement> {
    this._playbackReadyPromise = new Promise<void>((resolve) => {
      this._playbackReadyResolve = resolve;
    });

    this.remoteAudioEl = new Audio();
    this.remoteAudioEl.autoplay = true;
    this.remoteAudioEl.volume = 1.0;

    this.mediaSource = new MediaSource();
    this.remoteAudioEl.src = URL.createObjectURL(this.mediaSource);

    const mimeType = this._mimeType || "audio/webm;codecs=opus";

    this.mediaSource.addEventListener("sourceopen", () => {
      try {
        const supportedType = MediaSource.isTypeSupported(mimeType) 
          ? mimeType 
          : "audio/webm;codecs=opus";
        
        this.sourceBuffer = this.mediaSource!.addSourceBuffer(supportedType);
        this.sourceBuffer.mode = "sequence";

        const sb = this.sourceBuffer;
        const audio = this.remoteAudioEl;
        
        sb.addEventListener("updateend", () => {
          this._isAppending = false;
          
          // Process next chunk if queued
          if (this._pendingChunks.length > 0) {
            const chunk = this._pendingChunks.shift()!;
            this._appendChunk(chunk);
          }
          
          // Try to play if we have data
          if (audio && sb.buffered.length > 0 && audio.paused) {
            audio.play().catch(() => {});
          }
        });

        this._playbackReadyResolve?.();
        this._playbackReadyResolve = null;
        console.log("[WSAudio] Playback ready");
      } catch (err) {
        console.error("[WSAudio] SourceBuffer error:", err);
      }
    });

    this.remoteAudioEl.addEventListener("error", (e) => {
      console.error("[WSAudio] Audio element error:", e);
    });

    this.remoteAudioEl.addEventListener("canplay", () => {
      console.log("[WSAudio] Audio can play through");
      this.remoteAudioEl?.play().catch(() => {});
    });

    this.remoteAudioEl.load();
    return this.remoteAudioEl;
  }

  async waitForPlaybackReady(): Promise<void> {
    if (this._playbackReadyPromise) {
      await this._playbackReadyPromise;
    }
  }

  handleRemoteAudio(data: ArrayBuffer): void {
    if (!this.sourceBuffer || !this.mediaSource) return;
    if (this.mediaSource.readyState !== "open") return;

    // Queue the chunk and process
    this._pendingChunks.push(data);
    
    if (!this._isAppending) {
      this._processQueue();
    }
  }

  private _processQueue(): void {
    if (this._pendingChunks.length === 0 || this._isAppending) return;
    
    const chunk = this._pendingChunks.shift()!;
    this._appendChunk(chunk);
  }

  private _appendChunk(data: ArrayBuffer): void {
    if (!this.sourceBuffer || this.sourceBuffer.updating) {
      // Put back at front of queue
      this._pendingChunks.unshift(data);
      return;
    }

    this._isAppending = true;
    
    try {
      this.sourceBuffer.appendBuffer(data);
    } catch (err: unknown) {
      this._isAppending = false;
      
      if (err instanceof DOMException && err.name === "QuotaExceededError") {
        // Trim and retry
        if (!this.sourceBuffer.updating && this.sourceBuffer.buffered.length > 0) {
          try {
            const start = this.sourceBuffer.buffered.start(0);
            const end = this.sourceBuffer.buffered.end(0);
            if (end - start > 1.0) {
              this.sourceBuffer.remove(start, end - 0.5);
            }
          } catch {
            // Ignore trim errors
          }
        }
        this._pendingChunks.unshift(data);
      } else if (err instanceof DOMException && err.name !== "InvalidStateError") {
        console.warn("[WSAudio] Append error:", err.name);
      }
    }
  }

  // ------------------------------------------------------------------
  // Mute
  // ------------------------------------------------------------------

  toggleMute(): boolean {
    this._isMuted = !this._isMuted;
    if (this._localStream) {
      for (const track of this._localStream.getAudioTracks()) {
        track.enabled = !this._isMuted;
      }
    }
    return this._isMuted;
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------

  close(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try { this.mediaRecorder.stop(); } catch {}
    }
    this.mediaRecorder = null;

    if (this._localStream) {
      for (const track of this._localStream.getTracks()) {
        track.stop();
      }
      this._localStream = null;
    }

    try {
      if (this.mediaSource && this.mediaSource.readyState === "open") {
        this.mediaSource.endOfStream();
      }
    } catch {}

    if (this.remoteAudioEl?.src) {
      URL.revokeObjectURL(this.remoteAudioEl.src);
    }

    this.sourceBuffer = null;
    this.mediaSource = null;
    this._pendingChunks = [];
    this._isAppending = false;

    if (this.remoteAudioEl) {
      this.remoteAudioEl.src = "";
      this.remoteAudioEl.remove();
      this.remoteAudioEl = null;
    }

    this._playbackReadyPromise = null;
    this._playbackReadyResolve = null;
    this.onAudioData = null;
    this._isMuted = false;
    console.log("[WSAudio] Client closed");
  }
}