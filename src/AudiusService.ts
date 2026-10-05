import { audiusListUrl } from "./audius";
import { AudiusTrackAdapter } from "./AudiusTrackAdapter";
import { comparableText } from "./format";
import type { Song } from "./Song";
import type { AudiusResult } from "./types";

type FetchFunction = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

interface CacheEntry {
  songs: Song[];
  storedAt: number;
}

const TIMEOUT_MILLISECONDS = 10_000;
const CACHE_MILLISECONDS = 5 * 60 * 1000;

export class AudiusService {
  readonly #fetch: FetchFunction;
  readonly #adapter: AudiusTrackAdapter;
  readonly #now: () => number;
  readonly #cache = new Map<string, CacheEntry>();

  constructor(
    fetchFunction: FetchFunction = (url, init) => fetch(url, init),
    adapter: AudiusTrackAdapter = new AudiusTrackAdapter(),
    now: () => number = () => Date.now(),
  ) {
    this.#fetch = fetchFunction;
    this.#adapter = adapter;
    this.#now = now;
  }

  trending(genre: string | null): Promise<AudiusResult> {
    const params: Record<string, string> = genre === null ? {} : { genre };
    return this.request(`trending:${genre ?? ""}`, "/tracks/trending", params);
  }

  search(query: string): Promise<AudiusResult> {
    return this.request(`search:${comparableText(query)}`, "/tracks/search", { query: query.trim() });
  }

  private async request(key: string, path: string, params: Readonly<Record<string, string>>): Promise<AudiusResult> {
    const cached = this.#cache.get(key);
    if (cached !== undefined && this.#now() - cached.storedAt < CACHE_MILLISECONDS) {
      return { status: "ok", songs: cached.songs };
    }
    const data = await this.download(audiusListUrl(path, params));
    if (data === null) {
      return { status: "error" };
    }
    const songs = this.adapt(data);
    this.#cache.set(key, { songs, storedAt: this.#now() });
    return { status: "ok", songs };
  }

  private async download(url: string): Promise<unknown[] | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MILLISECONDS);
    try {
      const response = await this.#fetch(url, { signal: controller.signal });
      return response.ok ? AudiusService.dataOf(await response.json()) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private adapt(data: readonly unknown[]): Song[] {
    const seen = new Set<string>();
    const songs: Song[] = [];
    for (const item of data) {
      const song = this.#adapter.toSong(item);
      if (song !== null && !seen.has(song.fingerprint)) {
        seen.add(song.fingerprint);
        songs.push(song);
      }
    }
    return songs;
  }

  private static dataOf(body: unknown): unknown[] | null {
    if (typeof body !== "object" || body === null || !("data" in body)) {
      return null;
    }
    return Array.isArray(body.data) ? body.data : null;
  }
}
