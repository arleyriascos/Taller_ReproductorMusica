import type { Song } from "./Song";
import type { StorageUsage, StoredMedia } from "./types";

type FailureHandler = () => void;

const DATABASE_NAME = "musongs";
const STORE_NAME = "media";
const DATABASE_VERSION = 1;

export class AudioStore {
  readonly #factory: IDBFactory | null;
  #database: Promise<IDBDatabase | null> | null = null;
  #hasReported = false;
  #failureHandler: FailureHandler = () => {};

  constructor(factory: IDBFactory | null = AudioStore.defaultFactory()) {
    this.#factory = factory;
  }

  onFailure(handler: FailureHandler): void {
    this.#failureHandler = handler;
  }

  async put(songId: string, media: StoredMedia): Promise<void> {
    const { file, cover, coverType, lyricsFile, embeddedLyrics } = media;
    await this.run("readwrite", (store) => store.put({ file, cover, coverType, lyricsFile, embeddedLyrics }, songId));
  }

  async get(songId: string): Promise<StoredMedia | null> {
    const value = await this.run("readonly", (store) => store.get(songId));
    return AudioStore.isMedia(value) ? value : null;
  }

  async delete(songId: string): Promise<void> {
    await this.run("readwrite", (store) => store.delete(songId));
  }

  async reattach(songs: Iterable<Song>): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const song of songs) {
      if (!song.isRemote) {
        pending.push(this.reattachOne(song));
      }
    }
    await Promise.all(pending);
  }

  async forget(song: Song): Promise<void> {
    if (!song.isRemote) {
      await this.delete(song.id);
    }
  }

  async clear(): Promise<void> {
    await this.run("readwrite", (store) => store.clear());
  }

  async usage(): Promise<StorageUsage | null> {
    const songs = await this.run("readonly", (store) => store.count());
    const values = await this.run("readonly", (store) => store.getAll());
    if (songs === null || values === null) {
      return null;
    }
    return { songs, bytes: values.filter(AudioStore.isMedia).reduce((total, media) => total + AudioStore.sizeOf(media), 0) };
  }

  private async reattachOne(song: Song): Promise<void> {
    const media = await this.get(song.id);
    if (media !== null) {
      song.attachFile(media);
    }
  }

  private async run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
    const database = await this.open();
    if (database === null) {
      return null;
    }
    try {
      return await AudioStore.transact(database, mode, operation);
    } catch {
      this.report();
      return null;
    }
  }

  private open(): Promise<IDBDatabase | null> {
    this.#database ??= this.connect();
    return this.#database;
  }

  private async connect(): Promise<IDBDatabase | null> {
    if (this.#factory === null) {
      this.report();
      return null;
    }
    try {
      const database = await AudioStore.openDatabase(this.#factory);
      this.requestPersistence();
      return database;
    } catch {
      this.report();
      return null;
    }
  }

  private requestPersistence(): void {
    try {
      void navigator.storage?.persist?.().catch(() => undefined);
    } catch {
      return;
    }
  }

  private report(): void {
    if (!this.#hasReported) {
      this.#hasReported = true;
      this.#failureHandler();
    }
  }

  private static openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener("upgradeneeded", () => request.result.createObjectStore(STORE_NAME));
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("blocked", () => reject(new Error("Database open is blocked")));
    });
  }

  private static transact<T>(database: IDBDatabase, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      transaction.addEventListener("complete", () => resolve(request.result));
      transaction.addEventListener("abort", () => reject(transaction.error));
      transaction.addEventListener("error", () => reject(transaction.error));
    });
  }

  private static defaultFactory(): IDBFactory | null {
    try {
      return typeof indexedDB === "undefined" ? null : indexedDB;
    } catch {
      return null;
    }
  }

  private static isMedia(value: unknown): value is StoredMedia {
    return typeof value === "object" && value !== null && "file" in value && value.file instanceof Blob;
  }

  private static sizeOf(media: StoredMedia): number {
    return media.file.size + (media.cover?.size ?? 0) + (media.lyricsFile?.size ?? 0);
  }
}
