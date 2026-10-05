import type { Lyrics, SongDetails, SongMedia } from "./types";

export class Song {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly album: string;
  readonly fingerprint: string;
  #duration: number;
  #coverUrl: string | null = null;
  #sourceUrl: string | null = null;
  #coverType: string | null = null;
  #lyricsFile: File | null = null;
  #embeddedLyrics: Lyrics | null = null;

  constructor(details: SongDetails, id: string = crypto.randomUUID()) {
    this.id = id;
    this.title = details.title;
    this.artist = details.artist;
    this.album = details.album;
    this.#duration = details.duration;
    this.fingerprint = details.fingerprint;
  }

  static fingerprintOf(file: File): string {
    return `${file.name}|${file.size}|${file.lastModified}`;
  }

  get duration(): number {
    return this.#duration;
  }

  get coverUrl(): string | null {
    return this.#coverUrl;
  }

  get sourceUrl(): string | null {
    return this.#sourceUrl;
  }

  get coverType(): string | null {
    return this.#coverType;
  }

  get lyricsFile(): File | null {
    return this.#lyricsFile;
  }

  get embeddedLyrics(): Lyrics | null {
    return this.#embeddedLyrics;
  }

  attachFile(media: SongMedia): void {
    this.release();
    this.#sourceUrl = URL.createObjectURL(media.file);
    this.#coverUrl = media.cover === null ? null : URL.createObjectURL(media.cover);
    this.#coverType = media.cover === null ? null : media.coverType;
    this.#lyricsFile = media.lyricsFile;
    this.#embeddedLyrics = media.embeddedLyrics;
  }

  updateDuration(seconds: number): void {
    if (this.#duration === 0 && Number.isFinite(seconds) && seconds > 0) {
      this.#duration = seconds;
    }
  }

  release(): void {
    Song.revoke(this.#sourceUrl);
    Song.revoke(this.#coverUrl);
    this.#sourceUrl = null;
    this.#coverUrl = null;
    this.#coverType = null;
    this.#lyricsFile = null;
    this.#embeddedLyrics = null;
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
