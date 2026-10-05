import type { Node } from "./Node";
import type { Playlist } from "./Playlist";
import type { Song } from "./Song";

export type ListOperationType = "append" | "prepend" | "insert" | "remove" | "removeNode" | "move" | "clear";

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

export interface TrackPlacement {
  libraryPosition?: number;
  destination?: { playlist: Playlist; position: number };
}

export type ExploreStatus = "loading" | "ready" | "error";

export type AudiusResult = { status: "ok"; songs: Song[] } | { status: "error" };

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

export type MoveDirection = "up" | "down";

export type TraversalDirection = "next" | "previous";

export type LoadKind = "files" | "folder";

export type SongPlacement = { kind: "start" } | { kind: "end" } | { kind: "position"; position: number };

export interface AddSongRequest {
  song: Song;
  playlistId: string;
  placement: SongPlacement;
}

export interface AddSongsRequest {
  songs: ReadonlySet<Song>;
  playlistId: string;
  placement: SongPlacement;
}

export type RightColumnTab = "now" | "structure";

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
  isShuffled: boolean;
}

export type StoredMedia = SongMedia;

export interface StoredLocalSong extends SongDetails {
  id: string;
  source: "local";
}

export interface StoredRemoteSong extends SongDetails {
  id: string;
  source: "audius";
  streamUrl: string;
  coverUrl: string | null;
  pageUrl: string;
}

export type StoredSong = StoredLocalSong | StoredRemoteSong;

export interface StoredPlaylist {
  id: string;
  name: string;
  songIds: string[];
}

export interface StoredState {
  version: 2;
  songs: StoredSong[];
  library: string[];
  playlists: StoredPlaylist[];
}

export type PanelName = "sidebar" | "right";

export type PanelWidths = Record<PanelName, number>;

export interface Preferences {
  volume: number;
  muted: boolean;
  repeatMode: RepeatMode;
  rightColumnOpen: boolean;
  rightColumnTab: RightColumnTab;
  panelWidths: PanelWidths;
  shuffle: boolean;
}

export interface StorageUsage {
  songs: number;
  bytes: number;
}
