import { Playlist } from "./Playlist";
import { Song } from "./Song";
import type { AddTracksResult, LoadedTrack, PlaylistNameIssue } from "./types";

const LIBRARY_NAME = "Biblioteca";
const MAX_NAME_LENGTH = 40;

export class PlaylistManager {
  readonly library = new Playlist(LIBRARY_NAME, true);
  readonly #playlists = new Map<string, Playlist>();
  #visiblePlaylistId = this.library.id;

  get visiblePlaylist(): Playlist {
    return this.getPlaylist(this.#visiblePlaylistId) ?? this.library;
  }

  checkName(name: string, exceptId?: string): PlaylistNameIssue | null {
    const trimmed = name.trim();
    if (trimmed === "") {
      return "empty";
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return "too-long";
    }
    return this.isNameTaken(trimmed, exceptId) ? "duplicate" : null;
  }

  createPlaylist(name: string): Playlist {
    const playlist = new Playlist(this.validName(name));
    this.#playlists.set(playlist.id, playlist);
    return playlist;
  }

  renamePlaylist(id: string, name: string): void {
    const playlist = this.requireUserPlaylist(id);
    playlist.rename(this.validName(name, id));
  }

  deletePlaylist(id: string): void {
    this.requireUserPlaylist(id);
    this.#playlists.delete(id);
    if (this.#visiblePlaylistId === id) {
      this.#visiblePlaylistId = this.library.id;
    }
  }

  getPlaylist(id: string): Playlist | null {
    if (id === this.library.id) {
      return this.library;
    }
    return this.#playlists.get(id) ?? null;
  }

  *userPlaylists(): Generator<Playlist, void, undefined> {
    yield* this.#playlists.values();
  }

  setVisible(id: string): void {
    this.requirePlaylist(id);
    this.#visiblePlaylistId = id;
  }

  findByFingerprint(fingerprint: string): Song | null {
    for (const node of this.library.nodes()) {
      if (node.value.fingerprint === fingerprint) {
        return node.value;
      }
    }
    return null;
  }

  addTracks(tracks: LoadedTrack[]): AddTracksResult {
    const result: AddTracksResult = { added: 0, reconnected: 0, duplicated: 0 };
    for (const track of tracks) {
      result[this.addTrack(track)]++;
    }
    return result;
  }

  removeSongEverywhere(song: Song): void {
    for (const playlist of this.#playlists.values()) {
      playlist.removeAllOf(song);
    }
    this.library.removeAllOf(song);
    song.release();
  }

  duplicatePlaylist(id: string): Playlist {
    const source = this.requirePlaylist(id);
    const copy = source.clone(this.uniqueCopyName(source.name));
    this.#playlists.set(copy.id, copy);
    return copy;
  }

  private addTrack(track: LoadedTrack): keyof AddTracksResult {
    const existing = this.findByFingerprint(track.details.fingerprint);
    if (existing === null) {
      const song = new Song(track.details);
      song.attachFile(track.file, track.cover);
      this.library.addAtEnd(song);
      return "added";
    }
    if (existing.isAvailable()) {
      return "duplicated";
    }
    existing.attachFile(track.file, track.cover);
    return "reconnected";
  }

  private validName(name: string, exceptId?: string): string {
    const issue = this.checkName(name, exceptId);
    if (issue !== null) {
      throw new Error(issue);
    }
    return name.trim();
  }

  private isNameTaken(name: string, exceptId?: string): boolean {
    const key = PlaylistManager.comparable(name);
    if (key === PlaylistManager.comparable(LIBRARY_NAME)) {
      return true;
    }
    for (const playlist of this.#playlists.values()) {
      if (playlist.id !== exceptId && PlaylistManager.comparable(playlist.name) === key) {
        return true;
      }
    }
    return false;
  }

  private uniqueCopyName(name: string): string {
    let attempt = 1;
    while (this.checkName(PlaylistManager.copyName(name, attempt)) !== null) {
      attempt++;
    }
    return PlaylistManager.copyName(name, attempt);
  }

  private requirePlaylist(id: string): Playlist {
    const playlist = this.getPlaylist(id);
    if (playlist === null) {
      throw new Error(`No playlist with id ${id}`);
    }
    return playlist;
  }

  private requireUserPlaylist(id: string): Playlist {
    const playlist = this.#playlists.get(id);
    if (playlist === undefined) {
      throw new Error(`No user playlist with id ${id}`);
    }
    return playlist;
  }

  private static copyName(name: string, attempt: number): string {
    const suffix = attempt === 1 ? " (copia)" : ` (copia ${attempt})`;
    return name.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd() + suffix;
  }

  private static comparable(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/(?<!n)̃|[̀-̂̄-ͯ]/g, "")
      .normalize("NFC");
  }
}
