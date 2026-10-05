import type { AudiusService } from "./AudiusService";
import { Playlist } from "./Playlist";
import type { ExploreStatus } from "./types";

type Searcher = Pick<AudiusService, "trending" | "search">;

const EXPLORE_NAME = "Explorar";

export class ExploreSession {
  readonly #service: Searcher;
  readonly #created = new WeakSet<Playlist>();
  #playlist = this.createPlaylist();
  #status: ExploreStatus = "loading";
  #query = "";
  #genre: string | null = null;
  #request = 0;
  #hasStarted = false;
  #changeHandler: () => void = () => {};

  constructor(service: Searcher) {
    this.#service = service;
  }

  get playlist(): Playlist {
    return this.#playlist;
  }

  get status(): ExploreStatus {
    return this.#status;
  }

  get query(): string {
    return this.#query;
  }

  get genre(): string | null {
    return this.#genre;
  }

  owns(playlist: Playlist): boolean {
    return this.#created.has(playlist);
  }

  onChange(handler: () => void): void {
    this.#changeHandler = handler;
  }

  start(): void {
    if (!this.#hasStarted) {
      void this.reload();
    }
  }

  search(query: string): void {
    this.#query = query.trim();
    this.#genre = null;
    void this.reload();
  }

  chooseGenre(genre: string | null): void {
    this.#query = "";
    this.#genre = genre;
    void this.reload();
  }

  retry(): void {
    void this.reload();
  }

  private async reload(): Promise<void> {
    this.#hasStarted = true;
    const request = ++this.#request;
    this.#status = "loading";
    this.#changeHandler();
    const result = this.#query === "" ? await this.#service.trending(this.#genre) : await this.#service.search(this.#query);
    if (request !== this.#request) {
      return;
    }
    if (result.status === "ok") {
      this.#playlist = this.createPlaylist();
      for (const song of result.songs) {
        this.#playlist.addAtEnd(song);
      }
    }
    this.#status = result.status === "ok" ? "ready" : "error";
    this.#changeHandler();
  }

  private createPlaylist(): Playlist {
    const playlist = new Playlist(EXPLORE_NAME);
    this.#created.add(playlist);
    return playlist;
  }
}
