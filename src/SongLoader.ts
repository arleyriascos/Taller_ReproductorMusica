import type { IAudioMetadata } from "music-metadata";
import { Song } from "./Song";
import type { LoadedTrack, LoadResult } from "./types";

type PlayabilityProbe = (mimeType: string) => boolean;
type FileVerdict = "accepted" | "rejected" | "ignored";

const CONCURRENCY = 4;

const MIME_BY_EXTENSION: ReadonlyMap<string, string> = new Map([
  ["mp3", "audio/mpeg"],
  ["m4a", "audio/mp4"],
  ["aac", "audio/aac"],
  ["wav", "audio/wav"],
  ["ogg", "audio/ogg"],
  ["oga", "audio/ogg"],
  ["opus", "audio/ogg; codecs=opus"],
  ["flac", "audio/flac"],
  ["webm", "audio/webm"],
  ["wma", "audio/x-ms-wma"],
]);

export class SongLoader {
  readonly #canPlay: PlayabilityProbe;

  constructor(canPlay: PlayabilityProbe = SongLoader.browserProbe()) {
    this.#canPlay = canPlay;
  }

  async load(files: Iterable<File>): Promise<LoadResult> {
    const result: LoadResult = { tracks: [], rejected: [], ignored: 0 };
    const accepted: File[] = [];
    for (const file of SongLoader.sorted(files)) {
      const verdict = this.classify(file);
      if (verdict === "accepted") {
        accepted.push(file);
      } else if (verdict === "rejected") {
        result.rejected.push({ name: file.name, reason: "unsupported-format" });
      } else {
        result.ignored++;
      }
    }
    result.tracks = await SongLoader.readAll(accepted);
    return result;
  }

  private classify(file: File): FileVerdict {
    const extensionMime = MIME_BY_EXTENSION.get(SongLoader.extensionOf(file.name));
    if (!file.type.startsWith("audio/") && extensionMime === undefined) {
      return "ignored";
    }
    const mimeType = file.type === "" ? extensionMime : file.type;
    return mimeType !== undefined && this.#canPlay(mimeType) ? "accepted" : "rejected";
  }

  private static async readAll(files: File[]): Promise<LoadedTrack[]> {
    const tracks = new Array<LoadedTrack>(files.length);
    const pending = files.entries();
    const worker = async (): Promise<void> => {
      for (const [index, file] of pending) {
        tracks[index] = await SongLoader.read(file);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
    return tracks;
  }

  private static async read(file: File): Promise<LoadedTrack> {
    const metadata = await SongLoader.parse(file);
    return {
      details: {
        title: metadata?.common.title?.trim() || SongLoader.baseName(file.name),
        artist: metadata?.common.artist ?? "",
        album: metadata?.common.album ?? "",
        duration: SongLoader.validDuration(metadata?.format.duration),
        fingerprint: Song.fingerprintOf(file),
      },
      file,
      cover: SongLoader.coverOf(metadata),
    };
  }

  private static async parse(file: File): Promise<IAudioMetadata | null> {
    try {
      const { parseBlob } = await import("music-metadata");
      return await parseBlob(file, { skipCovers: false });
    } catch {
      return null;
    }
  }

  private static coverOf(metadata: IAudioMetadata | null): Blob | null {
    const picture = metadata?.common.picture?.[0];
    if (picture === undefined) {
      return null;
    }
    return new Blob([new Uint8Array(picture.data)], { type: picture.format });
  }

  private static validDuration(seconds: number | undefined): number {
    return seconds !== undefined && Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  }

  private static sorted(files: Iterable<File>): File[] {
    return [...files].sort((first, second) =>
      SongLoader.sortKey(first).localeCompare(SongLoader.sortKey(second), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }

  private static sortKey(file: File): string {
    return file.webkitRelativePath || file.name;
  }

  private static extensionOf(fileName: string): string {
    const dot = fileName.lastIndexOf(".");
    return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
  }

  private static baseName(fileName: string): string {
    const dot = fileName.lastIndexOf(".");
    return dot > 0 ? fileName.slice(0, dot) : fileName;
  }

  private static browserProbe(): PlayabilityProbe {
    const probe = document.createElement("audio");
    return (mimeType) => probe.canPlayType(mimeType) !== "";
  }
}
