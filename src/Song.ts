import type { Lyrics, SongDetails, SongMedia } from "./types";

const REMOTE_COVER_TYPE = "image/jpeg";

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
  #pageUrl: string | null = null;
  #isRemote = false;

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

  get pageUrl(): string | null {
    return this.#pageUrl;
  }

  get isRemote(): boolean {
    return this.#isRemote;
  }

  attachFile(media: SongMedia): void {
    this.release();
    this.#isRemote = false;
    this.#pageUrl = null;
    this.#sourceUrl = URL.createObjectURL(media.file);
    this.#coverUrl = media.cover === null ? null : URL.createObjectURL(media.cover);
    this.#coverType = media.cover === null ? null : media.coverType;
    this.#lyricsFile = media.lyricsFile;
    this.#embeddedLyrics = media.embeddedLyrics;
  }

  attachRemote(streamUrl: string, coverUrl: string | null, pageUrl: string): void {
    this.release();
    this.#isRemote = true;
    this.#sourceUrl = streamUrl;
    this.#coverUrl = coverUrl;
    this.#coverType = coverUrl === null ? null : REMOTE_COVER_TYPE;
    this.#pageUrl = pageUrl;
  }

  updateDuration(seconds: number): void {
    if (this.#duration === 0 && Number.isFinite(seconds) && seconds > 0) {
      this.#duration = seconds;
    }
  }

  release(): void {
    if (this.#isRemote) {
      return;
    }
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
