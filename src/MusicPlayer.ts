import type { Node } from "./Node";
import type { Playlist } from "./Playlist";
import type { Song } from "./Song";
import type { PlayerErrorCode, PlayerState, RepeatMode } from "./types";

type StateListener = (state: PlayerState) => void;
type ProgressListener = (currentTime: number, duration: number) => void;
type ErrorListener = (code: PlayerErrorCode, song: Song | null) => void;

const DEFAULT_VOLUME = 0.8;
const SEEK_STEP_SECONDS = 10;
const NEXT_REPEAT_MODE: Record<RepeatMode, RepeatMode> = { off: "all", all: "one", one: "off" };

export class MusicPlayer {
  private static instance: MusicPlayer | null = null;
  readonly #audio: HTMLAudioElement;
  readonly #mediaSession: MediaSession | null = "mediaSession" in navigator ? navigator.mediaSession : null;
  #context: Playlist | null = null;
  #loadedSong: Song | null = null;
  #volume = DEFAULT_VOLUME;
  #muted = false;
  #repeatMode: RepeatMode = "off";
  #stateListener: StateListener | null = null;
  #progressListener: ProgressListener | null = null;
  #errorListener: ErrorListener | null = null;

  private constructor() {
    this.#audio = document.createElement("audio");
    this.#audio.preload = "metadata";
    this.applyVolume();
    this.registerEvents();
    this.registerMediaActions();
  }

  static getInstance(): MusicPlayer {
    MusicPlayer.instance ??= new MusicPlayer();
    return MusicPlayer.instance;
  }

  get context(): Playlist | null {
    return this.#context;
  }

  onStateChange(callback: StateListener): void {
    this.#stateListener = callback;
  }

  onProgress(callback: ProgressListener): void {
    this.#progressListener = callback;
  }

  onError(callback: ErrorListener): void {
    this.#errorListener = callback;
  }

  getState(): PlayerState {
    return {
      song: this.#context?.current?.value ?? null,
      isPlaying: !this.#audio.paused,
      currentTime: this.#audio.currentTime,
      duration: this.duration(),
      volume: this.#volume,
      isMuted: this.#muted,
      hasNext: this.canMove((context) => context.hasNext()),
      hasPrevious: this.canMove((context) => context.hasPrevious()),
      repeatMode: this.#repeatMode,
    };
  }

  playFrom(playlist: Playlist, node: Node<Song>): void {
    playlist.select(node);
    this.#context = playlist;
    this.playSong(node.value);
  }

  togglePlayPause(): void {
    const current = this.#context?.current?.value ?? null;
    if (this.#loadedSong === null) {
      if (current !== null) {
        this.playSong(current);
      }
    } else if (this.#audio.paused) {
      this.startPlayback();
    } else {
      this.#audio.pause();
    }
  }

  next(): void {
    this.playNode(this.move((context) => context.next(), (context) => context.selectFirst()));
  }

  previous(): void {
    this.playNode(this.move((context) => context.previous(), (context) => context.selectLast()));
  }

  seek(seconds: number): void {
    if (this.#loadedSong === null || !Number.isFinite(seconds)) {
      return;
    }
    this.#audio.currentTime = MusicPlayer.clamp(seconds, 0, this.duration());
    this.notifyProgress();
  }

  setVolume(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }
    this.#volume = MusicPlayer.clamp(value, 0, 1);
    if (this.#volume > 0) {
      this.#muted = false;
    }
    this.applyVolume();
  }

  toggleMute(): void {
    this.#muted = !this.#muted;
    this.applyVolume();
  }

  setRepeatMode(mode: RepeatMode): void {
    this.#repeatMode = mode;
    this.notifyState();
  }

  cycleRepeatMode(): void {
    this.setRepeatMode(NEXT_REPEAT_MODE[this.#repeatMode]);
  }

  refresh(): void {
    const current = this.#context?.current ?? null;
    if (current === null) {
      this.unload();
      return;
    }
    if (current.value === this.#loadedSong) {
      this.notifyState();
      return;
    }
    const wasPlaying = !this.#audio.paused;
    if (this.loadSong(current.value) && wasPlaying) {
      this.startPlayback();
    }
  }

  stop(): void {
    this.#audio.pause();
    this.#audio.currentTime = 0;
    this.notifyState();
  }

  clearContext(): void {
    this.#context = null;
    this.unload();
  }

  private registerEvents(): void {
    const audio = this.#audio;
    for (const type of ["play", "pause", "volumechange"] as const) {
      audio.addEventListener(type, () => this.notifyState());
    }
    for (const type of ["play", "pause", "seeking"] as const) {
      audio.addEventListener(type, () => this.syncMediaSession());
    }
    audio.addEventListener("ended", () => this.handleEnded());
    audio.addEventListener("loadedmetadata", () => this.handleMetadata());
    audio.addEventListener("timeupdate", () => this.notifyProgress());
    audio.addEventListener("error", () => this.handleSourceError());
  }

  private registerMediaActions(): void {
    this.setMediaAction("play", () => this.setPlaying(true));
    this.setMediaAction("pause", () => this.setPlaying(false));
    this.setMediaAction("previoustrack", () => this.previous());
    this.setMediaAction("nexttrack", () => this.next());
    this.setMediaAction("seekto", (details) => this.seek(details.seekTime ?? Number.NaN));
    this.setMediaAction("seekbackward", (details) => this.seekBy(-(details.seekOffset ?? SEEK_STEP_SECONDS)));
    this.setMediaAction("seekforward", (details) => this.seekBy(details.seekOffset ?? SEEK_STEP_SECONDS));
  }

  private setMediaAction(action: MediaSessionAction, handler: MediaSessionActionHandler): void {
    try {
      this.#mediaSession?.setActionHandler(action, handler);
    } catch {
      return;
    }
  }

  private setPlaying(shouldPlay: boolean): void {
    if (this.#audio.paused === shouldPlay) {
      this.togglePlayPause();
    }
  }

  private seekBy(offset: number): void {
    this.seek(this.#audio.currentTime + offset);
  }

  private canMove(step: (context: Playlist) => boolean): boolean {
    const context = this.#context;
    return context !== null && (step(context) || this.wrapsAround(context));
  }

  private move(step: (context: Playlist) => Node<Song> | null, wrap: (context: Playlist) => Node<Song> | null): Node<Song> | null {
    const context = this.#context;
    if (context === null) {
      return null;
    }
    return step(context) ?? (this.wrapsAround(context) ? wrap(context) : null);
  }

  private wrapsAround(context: Playlist): boolean {
    return this.#repeatMode === "all" && context.length > 0;
  }

  private playNode(node: Node<Song> | null): void {
    if (node !== null) {
      this.playSong(node.value);
    }
  }

  private playSong(song: Song): void {
    if (this.loadSong(song)) {
      this.startPlayback();
    }
  }

  private loadSong(song: Song): boolean {
    const source = song.sourceUrl;
    if (source === null) {
      this.#errorListener?.("unavailable", song);
      return false;
    }
    this.#loadedSong = song;
    this.#audio.src = source;
    this.showMediaMetadata(song);
    this.notifyState();
    return true;
  }

  private unload(): void {
    this.stop();
    this.#audio.removeAttribute("src");
    this.#audio.load();
    this.#loadedSong = null;
    this.clearMediaSession();
    this.notifyState();
  }

  private startPlayback(): void {
    this.#audio.play().catch((error: unknown) => this.handlePlayRejection(error));
  }

  private restart(): void {
    this.#audio.currentTime = 0;
    this.startPlayback();
  }

  private handlePlayRejection(error: unknown): void {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    if (isAbort || this.#audio.error !== null) {
      return;
    }
    this.#errorListener?.("playback-failed", this.#loadedSong);
  }

  private handleEnded(): void {
    if (this.#repeatMode === "one") {
      this.restart();
      return;
    }
    if (this.canMove((context) => context.hasNext())) {
      this.next();
      return;
    }
    this.#audio.pause();
    this.#audio.currentTime = 0;
    this.notifyState();
  }

  private handleMetadata(): void {
    this.#loadedSong?.updateDuration(this.#audio.duration);
    this.syncMediaSession();
    this.notifyState();
  }

  private handleSourceError(): void {
    if (this.#audio.hasAttribute("src")) {
      this.#audio.pause();
      this.#errorListener?.("playback-failed", this.#loadedSong);
    }
  }

  private showMediaMetadata(song: Song): void {
    if (this.#mediaSession === null) {
      return;
    }
    const artwork = song.coverUrl === null ? [] : [MusicPlayer.artworkOf(song.coverUrl, song.coverType)];
    this.#mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: song.album, artwork });
  }

  private syncMediaSession(): void {
    if (this.#mediaSession === null || this.#loadedSong === null) {
      return;
    }
    this.#mediaSession.playbackState = this.#audio.paused ? "paused" : "playing";
    const duration = this.#audio.duration;
    if (Number.isFinite(duration) && duration > 0) {
      const position = MusicPlayer.clamp(this.#audio.currentTime, 0, duration);
      this.setMediaPosition({ duration, position, playbackRate: this.#audio.playbackRate || 1 });
    }
  }

  private clearMediaSession(): void {
    if (this.#mediaSession === null) {
      return;
    }
    this.#mediaSession.metadata = null;
    this.#mediaSession.playbackState = "none";
    this.setMediaPosition();
  }

  private setMediaPosition(state?: MediaPositionState): void {
    const session = this.#mediaSession;
    if (session !== null && "setPositionState" in session) {
      session.setPositionState(state);
    }
  }

  private applyVolume(): void {
    this.#audio.volume = this.#volume;
    this.#audio.muted = this.#muted;
  }

  private duration(): number {
    const duration = this.#audio.duration;
    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }
    return this.#loadedSong?.duration ?? 0;
  }

  private notifyState(): void {
    this.#stateListener?.(this.getState());
  }

  private notifyProgress(): void {
    this.#progressListener?.(this.#audio.currentTime, this.duration());
  }

  private static artworkOf(src: string, type: string | null): MediaImage {
    return type === null ? { src } : { src, type };
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
