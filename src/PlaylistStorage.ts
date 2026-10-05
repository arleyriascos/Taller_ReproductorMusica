import type { Preferences, RepeatMode, RightColumnTab, StoredPlaylist, StoredSong, StoredState } from "./types";

type FailureHandler = () => void;

const STATE_KEY = "musongs.state.v1";
const PREFERENCES_KEY = "musongs.preferences.v1";
const STATE_VERSION = 1;
const REPEAT_MODES: readonly RepeatMode[] = ["off", "all", "one"];
const RIGHT_COLUMN_TABS: readonly RightColumnTab[] = ["now", "structure"];

export class PlaylistStorage {
  readonly #storage: Storage | null;
  #hasReported = false;
  #failureHandler: FailureHandler = () => {};

  constructor(storage: Storage | null = PlaylistStorage.defaultStorage()) {
    this.#storage = storage;
  }

  onFailure(handler: FailureHandler): void {
    this.#failureHandler = handler;
  }

  saveState(state: StoredState): void {
    this.write(STATE_KEY, JSON.stringify(state));
  }

  loadState(): StoredState | null {
    const data = this.read(STATE_KEY);
    return PlaylistStorage.isState(data) ? data : null;
  }

  savePreferences(preferences: Preferences): void {
    this.write(PREFERENCES_KEY, JSON.stringify(preferences));
  }

  loadPreferences(): Preferences | null {
    const data = this.read(PREFERENCES_KEY);
    return PlaylistStorage.isPreferences(data) ? data : null;
  }

  clear(): void {
    this.attempt(() => {
      this.#storage?.removeItem(STATE_KEY);
      this.#storage?.removeItem(PREFERENCES_KEY);
    });
  }

  private read(key: string): unknown {
    const text = this.attempt(() => this.#storage?.getItem(key) ?? null) ?? null;
    if (text === null) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private write(key: string, text: string): void {
    this.attempt(() => this.#storage?.setItem(key, text));
  }

  private attempt<T>(action: () => T): T | null {
    if (this.#storage === null) {
      this.report();
      return null;
    }
    try {
      return action();
    } catch {
      this.report();
      return null;
    }
  }

  private report(): void {
    if (!this.#hasReported) {
      this.#hasReported = true;
      this.#failureHandler();
    }
  }

  private static defaultStorage(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static isTextList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }

  private static isSong(value: unknown): value is StoredSong {
    return (
      PlaylistStorage.isRecord(value) &&
      ["id", "title", "artist", "album", "fingerprint"].every((key) => typeof value[key] === "string") &&
      typeof value.duration === "number" &&
      Number.isFinite(value.duration) &&
      value.duration >= 0
    );
  }

  private static isPlaylist(value: unknown): value is StoredPlaylist {
    return PlaylistStorage.isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && PlaylistStorage.isTextList(value.songIds);
  }

  private static isState(value: unknown): value is StoredState {
    if (!PlaylistStorage.isRecord(value) || value.version !== STATE_VERSION) {
      return false;
    }
    const { songs, library, playlists } = value;
    if (!Array.isArray(songs) || !songs.every(PlaylistStorage.isSong) || !PlaylistStorage.isTextList(library)) {
      return false;
    }
    if (!Array.isArray(playlists) || !playlists.every(PlaylistStorage.isPlaylist)) {
      return false;
    }
    const ids = new Set(songs.map((song) => song.id));
    return ids.size === songs.length && [library, ...playlists.map((playlist) => playlist.songIds)].every((list) => list.every((id) => ids.has(id)));
  }

  private static isPreferences(value: unknown): value is Preferences {
    return (
      PlaylistStorage.isRecord(value) &&
      typeof value.volume === "number" &&
      value.volume >= 0 &&
      value.volume <= 1 &&
      typeof value.muted === "boolean" &&
      REPEAT_MODES.some((mode) => mode === value.repeatMode) &&
      typeof value.rightColumnOpen === "boolean" &&
      RIGHT_COLUMN_TABS.some((tab) => tab === value.rightColumnTab)
    );
  }
}
