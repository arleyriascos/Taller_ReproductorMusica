import type { Node } from "./Node";
import type { Song } from "./Song";

export type ListOperationType = "append" | "prepend" | "insert" | "remove" | "removeNode" | "clear";

export interface OperationLinks<T> {
  previousNode: Node<T> | null;
  node: Node<T> | null;
  nextNode: Node<T> | null;
}

export interface ListOperation<T> extends OperationLinks<T> {
  type: ListOperationType;
  index: number | null;
  valueLabel: string | null;
  previousLabel: string | null;
  nextLabel: string | null;
  timestamp: number;
}

export interface SongDetails {
  title: string;
  artist: string;
  album: string;
  duration: number;
  fingerprint: string;
}

export interface LyricLine {
  time: number | null;
  text: string;
}

export type LyricsSource = "file" | "embedded" | "lrclib";

export interface Lyrics {
  synced: boolean;
  instrumental: boolean;
  lines: LyricLine[];
  source: LyricsSource;
}

export type LyricsResult = { status: "found"; lyrics: Lyrics } | { status: "not-found" } | { status: "error" };

export interface SongMedia {
  file: File;
  cover: Blob | null;
  coverType: string | null;
  lyricsFile: File | null;
  embeddedLyrics: Lyrics | null;
}

export interface LoadedTrack extends SongMedia {
  details: SongDetails;
}

export type PlaylistNameIssue = "empty" | "too-long" | "duplicate";

export interface AddTracksResult {
  added: number;
  reconnected: number;
  duplicated: number;
}

export interface RejectedFile {
  name: string;
  reason: "unsupported-format";
}

export interface LoadResult {
  tracks: LoadedTrack[];
  rejected: RejectedFile[];
  ignored: number;
}

export type PlayerErrorCode = "unavailable" | "playback-failed";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
  song: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  repeatMode: RepeatMode;
}
