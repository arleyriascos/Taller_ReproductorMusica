import type { Song } from "./Song";

export type ListOperationType = "append" | "prepend" | "insert" | "remove" | "removeNode" | "clear";

export interface ListOperation {
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

export interface LoadedTrack {
  details: SongDetails;
  file: File;
  cover: Blob | null;
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

export interface PlayerState {
  song: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}
