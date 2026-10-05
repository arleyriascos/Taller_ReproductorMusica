import { cleanSearchTitle, instrumentalLyrics, parseLrc, toLyrics, type SearchTerms } from "./lyrics";
import type { Song } from "./Song";
import type { Lyrics, LyricsResult } from "./types";

type FetchFunction = typeof fetch;

interface LrclibRecord {
  duration: number | null;
  instrumental: boolean;
  syncedLyrics: string;
  plainLyrics: string;
}

const API_URL = "https://lrclib.net/api";
const TIMEOUT_MS = 10_000;
const DURATION_TOLERANCE_SECONDS = 5;
const NOT_FOUND = 404;
const NOT_FOUND_RESULT: LyricsResult = { status: "not-found" };
const ERROR_RESULT: LyricsResult = { status: "error" };

export class LyricsService {
  readonly #fetch: FetchFunction;
  readonly #cache = new Map<string, LyricsResult>();
  readonly #pending = new Map<string, Promise<LyricsResult>>();

  constructor(fetchFn: FetchFunction = (input, init) => fetch(input, init)) {
    this.#fetch = fetchFn;
  }

  getLyrics(song: Song): Promise<LyricsResult> {
    const cached = this.#cache.get(song.id);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }
    let pending = this.#pending.get(song.id);
    if (pending === undefined) {
      pending = this.resolve(song).finally(() => this.#pending.delete(song.id));
      this.#pending.set(song.id, pending);
    }
    return pending;
  }

  private async resolve(song: Song): Promise<LyricsResult> {
    const local = (await LyricsService.fromFile(song.lyricsFile)) ?? song.embeddedLyrics;
    const result = local === null ? await this.fromLrclib(song) : LyricsService.found(local);
    if (result.status !== "error") {
      this.#cache.set(song.id, result);
    }
    return result;
  }

  private static async fromFile(file: File | null): Promise<Lyrics | null> {
    if (file === null) {
      return null;
    }
    try {
      return toLyrics(parseLrc(await file.text()), "file");
    } catch {
      return null;
    }
  }

  private async fromLrclib(song: Song): Promise<LyricsResult> {
    try {
      const terms = cleanSearchTitle(song.title, song.artist);
      const lyrics = (await this.getExact(song, terms)) ?? (await this.search(song, terms));
      return lyrics === null ? NOT_FOUND_RESULT : LyricsService.found(lyrics);
    } catch {
      return ERROR_RESULT;
    }
  }

  private async getExact(song: Song, terms: SearchTerms): Promise<Lyrics | null> {
    if (terms.artist === "") {
      return null;
    }
    const params = new URLSearchParams({ artist_name: terms.artist, track_name: terms.title });
    if (song.album.trim() !== "") {
      params.set("album_name", song.album.trim());
    }
    if (song.duration > 0) {
      params.set("duration", String(Math.round(song.duration)));
    }
    const body = await this.request("get", params);
    return body === null ? null : LyricsService.lyricsOf(LyricsService.recordOf(body));
  }

  private async search(song: Song, terms: SearchTerms): Promise<Lyrics | null> {
    const params = new URLSearchParams({ track_name: terms.title });
    if (terms.artist !== "") {
      params.set("artist_name", terms.artist);
    }
    const body = await this.request("search", params);
    const records = Array.isArray(body) ? body.map(LyricsService.recordOf) : [];
    const record = LyricsService.closest(records, song.duration);
    return record === null ? null : LyricsService.lyricsOf(record);
  }

  private async request(endpoint: string, params: URLSearchParams): Promise<unknown> {
    const response = await this.#fetch(`${API_URL}/${endpoint}?${params.toString()}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === NOT_FOUND) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`LRCLIB responded ${response.status}`);
    }
    return response.json();
  }

  private static closest(records: readonly LrclibRecord[], duration: number): LrclibRecord | null {
    const usable = records.filter((record) => LyricsService.lyricsOf(record) !== null);
    if (duration <= 0) {
      return usable[0] ?? null;
    }
    let best: LrclibRecord | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const record of usable) {
      const gap = record.duration === null ? Number.POSITIVE_INFINITY : Math.abs(record.duration - duration);
      if (gap < bestGap) {
        best = record;
        bestGap = gap;
      }
    }
    return bestGap <= DURATION_TOLERANCE_SECONDS ? best : null;
  }

  private static lyricsOf(record: LrclibRecord): Lyrics | null {
    if (record.instrumental) {
      return instrumentalLyrics("lrclib");
    }
    return toLyrics(parseLrc(record.syncedLyrics), "lrclib") ?? toLyrics(parseLrc(record.plainLyrics), "lrclib");
  }

  private static recordOf(body: unknown): LrclibRecord {
    const value: Record<string, unknown> = typeof body === "object" && body !== null ? { ...body } : {};
    return {
      duration: typeof value.duration === "number" ? value.duration : null,
      instrumental: value.instrumental === true,
      syncedLyrics: typeof value.syncedLyrics === "string" ? value.syncedLyrics : "",
      plainLyrics: typeof value.plainLyrics === "string" ? value.plainLyrics : "",
    };
  }

  private static found(lyrics: Lyrics): LyricsResult {
    return { status: "found", lyrics };
  }
}
