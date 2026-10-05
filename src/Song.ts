import type { SongDetails } from "./types";

export class Song {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly duration: number;
  readonly fingerprint: string;
  #coverUrl: string | null = null;
  #sourceUrl: string | null = null;

  constructor(details: SongDetails, id: string = crypto.randomUUID()) {
    this.id = id;
    this.title = details.title;
    this.artist = details.artist;
    this.album = details.album;
    this.duration = details.duration;
    this.fingerprint = details.fingerprint;
  }

  static fingerprintOf(file: File): string {
    return `${file.name}|${file.size}|${file.lastModified}`;
  }

  get coverUrl(): string | null {
    return this.#coverUrl;
  }

  get sourceUrl(): string | null {
    return this.#sourceUrl;
  }

  attachFile(file: File, cover: Blob | null): void {
    this.release();
    this.#sourceUrl = URL.createObjectURL(file);
    this.#coverUrl = cover === null ? null : URL.createObjectURL(cover);
  }

  release(): void {
    Song.revoke(this.#sourceUrl);
    Song.revoke(this.#coverUrl);
    this.#sourceUrl = null;
    this.#coverUrl = null;
  }

  isAvailable(): boolean {
    return this.#sourceUrl !== null;
  }

  private static revoke(url: string | null): void {
    if (url !== null) {
      URL.revokeObjectURL(url);
    }
  }
}
