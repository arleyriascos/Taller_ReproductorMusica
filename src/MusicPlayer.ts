import type { Node } from "./Node";
import type { Playlist } from "./Playlist";
import type { Song } from "./Song";
import type { PlayerErrorCode, PlayerState } from "./types";

type StateListener = (state: PlayerState) => void;
type ProgressListener = (currentTime: number, duration: number) => void;
type ErrorListener = (code: PlayerErrorCode, song: Song | null) => void;

const DEFAULT_VOLUME = 0.8;

export class MusicPlayer {
  private static instance: MusicPlayer | null = null;
  readonly #audio: HTMLAudioElement;
  #context: Playlist | null = null;
  #loadedSong: Song | null = null;
  #volume = DEFAULT_VOLUME;
  #muted = false;
  #stateListener: StateListener | null = null;
  #progressListener: ProgressListener | null = null;
  #errorListener: ErrorListener | null = null;

  private constructor() {
    this.#audio = document.createElement("audio");
    this.#audio.preload = "metadata";
    this.applyVolume();
    this.registerEvents();
  }

  static getInstance(): MusicPlayer {
    MusicPlayer.instance ??= new MusicPlayer();
    return MusicPlayer.instance;
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
    const context = this.#context;
    return {
      song: context?.current?.value ?? null,
      isPlaying: !this.#audio.paused,
      currentTime: this.#audio.currentTime,
      duration: this.duration(),
      volume: this.#volume,
      isMuted: this.#muted,
      hasNext: context?.hasNext() ?? false,
      hasPrevious: context?.hasPrevious() ?? false,
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
    this.playNode(this.#context?.next() ?? null);
  }

  previous(): void {
    this.playNode(this.#context?.previous() ?? null);
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
    audio.addEventListener("ended", () => this.handleEnded());
    audio.addEventListener("loadedmetadata", () => this.handleMetadata());
    audio.addEventListener("timeupdate", () => this.notifyProgress());
    audio.addEventListener("error", () => this.handleSourceError());
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
    this.notifyState();
    return true;
  }

  private unload(): void {
    this.stop();
    this.#audio.removeAttribute("src");
    this.#audio.load();
    this.#loadedSong = null;
    this.notifyState();
  }

  private startPlayback(): void {
    this.#audio.play().catch((error: unknown) => this.handlePlayRejection(error));
  }

  private handlePlayRejection(error: unknown): void {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    if (isAbort || this.#audio.error !== null) {
      return;
    }
    this.#errorListener?.("playback-failed", this.#loadedSong);
  }

  private handleEnded(): void {
    if (this.#context?.hasNext() === true) {
      this.next();
      return;
    }
    this.#audio.pause();
    this.#audio.currentTime = 0;
    this.notifyState();
  }

  private handleMetadata(): void {
    this.#loadedSong?.updateDuration(this.#audio.duration);
    this.notifyState();
  }

  private handleSourceError(): void {
    if (this.#audio.hasAttribute("src")) {
      this.#audio.pause();
      this.#errorListener?.("playback-failed", this.#loadedSong);
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

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
