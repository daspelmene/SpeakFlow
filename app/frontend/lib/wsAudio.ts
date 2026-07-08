/**
 * WebSocket audio client for SpeakFlow audio rooms.
 */

const TARGET_LIVE_LATENCY_SECONDS = 0.35;
const MAX_ALLOWED_LATENCY_SECONDS = 1.2;
const MAX_BUFFER_SECONDS = 3.0;
const MAX_PENDING_CHUNKS = 200;

export class WSAudioClient {
  private mediaRecorder: MediaRecorder | null = null;
  private _localStream: MediaStream | null = null;

  private remoteAudioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;

  private _isMuted = false;
  private _mimeType = "";

  private _playbackReadyPromise: Promise<void> | null = null;
  private _playbackReadyResolve: (() => void) | null = null;

  private _pendingChunks: ArrayBuffer[] = [];
  private _isAppending = false;

  private _receivedChunksCount = 0;
  private _sentChunksCount = 0;

  private _dropChunksUntilRestart = false;

  get isMuted(): boolean {
    return this._isMuted;
  }

  get remoteAudioElement(): HTMLAudioElement | null {
    return this.remoteAudioEl;
  }

  get localStream(): MediaStream | null {
    return this._localStream;
  }

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
    } catch (error) {
      console.error("[WSAudio] Microphone error:", error);
      throw error;
    }

    this._mimeType = this.getSupportedMimeType();
    this.startMediaRecorder();

    console.log(
      `[WSAudio] MediaRecorder started: ${this._mimeType || "default"}`,
    );
  }

  private getSupportedMimeType(): string {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4;codecs=opus",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "";
  }

  private startMediaRecorder(): void {
    if (!this._localStream) {
      return;
    }

    const options: MediaRecorderOptions = {};

    if (this._mimeType) {
      options.mimeType = this._mimeType;
    }

    options.audioBitsPerSecond = 32000;

    this.mediaRecorder = new MediaRecorder(this._localStream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size <= 0 || this._isMuted) {
        return;
      }

      if (this._dropChunksUntilRestart) {
        console.log("[WSAudio] Dropped old recorder chunk during restart", {
          bytes: event.data.size,
        });
        return;
      }

      event.data.arrayBuffer().then((buffer) => {
        this._sentChunksCount += 1;

        if (this._sentChunksCount === 1 || this._sentChunksCount % 50 === 0) {
          console.log("[WSAudio] Sending audio chunk", {
            count: this._sentChunksCount,
            bytes: buffer.byteLength,
            mimeType: this._mimeType || "default",
          });
        }

        this.onAudioData?.(buffer);
      });
    };

    this.mediaRecorder.onerror = (event) => {
      console.warn("[WSAudio] MediaRecorder warning:", event);
    };

    this.mediaRecorder.start(100);
  }

  restartMediaRecorder(): void {
    if (!this._localStream) {
      return;
    }

    const oldRecorder = this.mediaRecorder;

    if (!oldRecorder || oldRecorder.state !== "recording") {
      this.startMediaRecorder();
      console.log("[WSAudio] MediaRecorder started during restart");
      return;
    }

    this._dropChunksUntilRestart = true;

    oldRecorder.onstop = () => {
      window.setTimeout(() => {
        this._dropChunksUntilRestart = false;
        this.startMediaRecorder();

        console.log(
          "[WSAudio] MediaRecorder restarted - old final chunk dropped, fresh WebM header generated",
        );
      }, 150);
    };

    try {
      oldRecorder.stop();
    } catch (error) {
      console.warn("[WSAudio] Failed to stop old MediaRecorder:", error);

      this._dropChunksUntilRestart = false;
      this.startMediaRecorder();
    }
  }

  // ------------------------------------------------------------------
  // Playback
  // ------------------------------------------------------------------

  async startPlayback(): Promise<HTMLAudioElement> {
    this._playbackReadyPromise = new Promise<void>((resolve) => {
      this._playbackReadyResolve = resolve;
    });

    this._pendingChunks = [];
    this._isAppending = false;
    this._receivedChunksCount = 0;

    const audioElement = new Audio();
    const mediaSource = new MediaSource();

    audioElement.autoplay = true;
    audioElement.volume = 1.0;
    audioElement.playbackRate = 1.0;

    this.remoteAudioEl = audioElement;
    this.mediaSource = mediaSource;
    this.sourceBuffer = null;

    audioElement.src = URL.createObjectURL(mediaSource);

    const mimeType = this._mimeType || "audio/webm;codecs=opus";

    mediaSource.addEventListener("sourceopen", () => {
      if (this.mediaSource !== mediaSource || this.remoteAudioEl !== audioElement) {
        return;
      }

      try {
        const supportedType = MediaSource.isTypeSupported(mimeType)
          ? mimeType
          : "audio/webm;codecs=opus";

        const sourceBuffer = mediaSource.addSourceBuffer(supportedType);
        sourceBuffer.mode = "sequence";

        this.sourceBuffer = sourceBuffer;

        sourceBuffer.addEventListener("updateend", () => {
          this._isAppending = false;

          this.correctPlaybackLatency();
          this.trimOldBufferedAudio();

          if (this._pendingChunks.length > 0) {
            this.processQueue();
          }
        });

        sourceBuffer.addEventListener("error", () => {
          console.warn("[WSAudio] SourceBuffer error");
        });

        this._playbackReadyResolve?.();
        this._playbackReadyResolve = null;

        console.log("[WSAudio] Playback ready", {
          mimeType: supportedType,
        });

        if (this._pendingChunks.length > 0) {
          this.processQueue();
        }
      } catch (error) {
        console.warn("[WSAudio] SourceBuffer warning:", error);

        this._playbackReadyResolve?.();
        this._playbackReadyResolve = null;
      }
    });

    audioElement.addEventListener("error", () => {
      const mediaError = audioElement.error;

      console.warn("[WSAudio] Audio element warning:", {
        code: mediaError?.code,
        message: mediaError?.message,
      });
    });

    audioElement.addEventListener("canplay", () => {
      console.log("[WSAudio] Audio can play through");

      audioElement.play().catch(() => {
        // Browser may block autoplay until user interaction.
      });
    });

    audioElement.load();

    return audioElement;
  }

  async resetPlayback(): Promise<HTMLAudioElement> {
    console.log("[WSAudio] Resetting playback pipeline");

    this.cleanupPlaybackOnly();

    const audioElement = await this.startPlayback();
    await this.waitForPlaybackReady();

    return audioElement;
  }

  async waitForPlaybackReady(): Promise<void> {
    if (this._playbackReadyPromise) {
      await this._playbackReadyPromise;
    }
  }

  handleRemoteAudio(data: ArrayBuffer): void {
    this._receivedChunksCount += 1;

    if (this._receivedChunksCount === 1 || this._receivedChunksCount % 50 === 0) {
      console.log("[WSAudio] Received remote audio chunk", {
        count: this._receivedChunksCount,
        bytes: data.byteLength,
        sourceBufferReady: Boolean(this.sourceBuffer),
        mediaSourceState: this.mediaSource?.readyState,
      });
    }

    this.enqueueChunk(data);

    if (
      this.sourceBuffer &&
      this.mediaSource?.readyState === "open" &&
      !this._isAppending
    ) {
      this.processQueue();
    }
  }

  private enqueueChunk(data: ArrayBuffer): void {
    this._pendingChunks.push(data);

    if (this._pendingChunks.length > MAX_PENDING_CHUNKS) {
      const dropped = this._pendingChunks.splice(
        0,
        this._pendingChunks.length - MAX_PENDING_CHUNKS,
      );

      console.warn("[WSAudio] Dropped pending chunks to keep stream live", {
        dropped: dropped.length,
        remaining: this._pendingChunks.length,
      });
    }
  }

  private processQueue(): void {
    if (
      this._pendingChunks.length === 0 ||
      this._isAppending ||
      !this.sourceBuffer ||
      !this.mediaSource ||
      this.mediaSource.readyState !== "open"
    ) {
      return;
    }

    const chunk = this._pendingChunks.shift();

    if (chunk) {
      this.appendChunk(chunk);
    }
  }

  private appendChunk(data: ArrayBuffer): void {
    if (!this.sourceBuffer || this.sourceBuffer.updating) {
      this._pendingChunks.unshift(data);
      return;
    }

    this._isAppending = true;

    try {
      this.sourceBuffer.appendBuffer(data);
    } catch (error: unknown) {
      this._isAppending = false;

      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        this.trimOldBufferedAudio();
        this._pendingChunks.unshift(data);
        return;
      }

      if (error instanceof DOMException && error.name === "InvalidStateError") {
        console.warn("[WSAudio] Append skipped because SourceBuffer is invalid");
        return;
      }

      console.warn("[WSAudio] Append warning:", error);
    }
  }

  private correctPlaybackLatency(): void {
    const audio = this.remoteAudioEl;
    const sourceBuffer = this.sourceBuffer;

    if (!audio || !sourceBuffer || sourceBuffer.buffered.length === 0) {
      return;
    }

    try {
      const bufferedEnd = sourceBuffer.buffered.end(
        sourceBuffer.buffered.length - 1,
      );

      const latency = bufferedEnd - audio.currentTime;

      if (latency > MAX_ALLOWED_LATENCY_SECONDS) {
        const nextTime = Math.max(
          0,
          bufferedEnd - TARGET_LIVE_LATENCY_SECONDS,
        );

        console.log("[WSAudio] Correcting playback latency", {
          latency,
          currentTime: audio.currentTime,
          bufferedEnd,
          nextTime,
        });

        audio.currentTime = nextTime;
        audio.playbackRate = 1.0;

        audio.play().catch(() => {
          // Browser may block autoplay until user interaction.
        });

        return;
      }

      if (latency > 0.8) {
        audio.playbackRate = 1.05;
      } else {
        audio.playbackRate = 1.0;
      }
    } catch {
      // Ignore live latency correction errors.
    }
  }

  private trimOldBufferedAudio(): void {
    const audio = this.remoteAudioEl;
    const sourceBuffer = this.sourceBuffer;

    if (!audio || !sourceBuffer || sourceBuffer.updating) {
      return;
    }

    if (sourceBuffer.buffered.length === 0) {
      return;
    }

    try {
      const bufferedStart = sourceBuffer.buffered.start(0);
      const bufferedEnd = sourceBuffer.buffered.end(
        sourceBuffer.buffered.length - 1,
      );

      const bufferedDuration = bufferedEnd - bufferedStart;

      if (bufferedDuration <= MAX_BUFFER_SECONDS) {
        return;
      }

      const removeEnd = Math.max(
        bufferedStart,
        Math.min(audio.currentTime - 0.2, bufferedEnd - MAX_BUFFER_SECONDS),
      );

      if (removeEnd > bufferedStart) {
        sourceBuffer.remove(bufferedStart, removeEnd);
      }
    } catch {
      // Ignore buffer trimming errors.
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

  private cleanupPlaybackOnly(): void {
    if (this.remoteAudioEl) {
      this.remoteAudioEl.pause();

      if (this.remoteAudioEl.src) {
        URL.revokeObjectURL(this.remoteAudioEl.src);
      }

      this.remoteAudioEl.src = "";
    }

    if (this.mediaSource?.readyState === "open") {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // Ignore MediaSource cleanup errors.
      }
    }

    this.remoteAudioEl = null;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this._pendingChunks = [];
    this._isAppending = false;
    this._playbackReadyPromise = null;
    this._playbackReadyResolve = null;
    this._receivedChunksCount = 0;
  }

  close(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore MediaRecorder cleanup errors.
      }
    }

    this.mediaRecorder = null;

    if (this._localStream) {
      for (const track of this._localStream.getTracks()) {
        track.stop();
      }
    }

    this._localStream = null;

    this.cleanupPlaybackOnly();

    this._dropChunksUntilRestart = false;
    this.onAudioData = null;
  }
}