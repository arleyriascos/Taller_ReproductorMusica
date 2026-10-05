import type { IAudioMetadata, ILyricsTag } from "music-metadata";
import { parseLrc, sortByTime, toLyrics } from "./lyrics";
import { Song } from "./Song";
import type { LoadedTrack, LoadResult, LyricLine, Lyrics, RejectedFile } from "./types";

type PlayabilityProbe = (mimeType: string) => boolean;
type FileVerdict = "accepted" | "rejected" | "ignored";

interface PartitionedInput {
  audio: File[];
  lyrics: Map<string, File>;
  rejected: RejectedFile[];
  ignored: number;
}

const CONCURRENCY = 4;
const LYRICS_EXTENSION = "lrc";
const MILLISECOND_TIMESTAMPS = 2;

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
    const input = this.partition(files);
    const pairs = input.audio.map((file) => input.lyrics.get(SongLoader.pairKey(file)) ?? null);
    const paired = new Set(pairs);
    const unpaired = [...input.lyrics.values()].filter((file) => !paired.has(file)).length;
    const tracks = await SongLoader.readAll(input.audio, pairs);
    return { tracks, rejected: input.rejected, ignored: input.ignored + unpaired };
  }

  private partition(files: Iterable<File>): PartitionedInput {
    const input: PartitionedInput = { audio: [], lyrics: new Map(), rejected: [], ignored: 0 };
    for (const file of SongLoader.sorted(files)) {
      if (SongLoader.extensionOf(file.name) === LYRICS_EXTENSION) {
        SongLoader.addLyricsFile(input, file);
        continue;
      }
      const verdict = this.classify(file);
      if (verdict === "accepted") {
        input.audio.push(file);
      } else if (verdict === "rejected") {
        input.rejected.push({ name: file.name, reason: "unsupported-format" });
      } else {
        input.ignored++;
      }
    }
    return input;
  }

  private static addLyricsFile(input: PartitionedInput, file: File): void {
    const key = SongLoader.pairKey(file);
    if (input.lyrics.has(key)) {
      input.ignored++;
    } else {
      input.lyrics.set(key, file);
    }
  }

  private static pairKey(file: File): string {
    const path = file.webkitRelativePath || file.name;
    const slash = path.lastIndexOf("/");
    const folder = slash === -1 ? "" : path.slice(0, slash + 1);
    return `${folder}${SongLoader.baseName(file.name)}`.toLowerCase();
  }

  private classify(file: File): FileVerdict {
    const extensionMime = MIME_BY_EXTENSION.get(SongLoader.extensionOf(file.name));
    if (!file.type.startsWith("audio/") && extensionMime === undefined) {
      return "ignored";
    }
    const mimeType = file.type === "" ? extensionMime : file.type;
    return mimeType !== undefined && this.#canPlay(mimeType) ? "accepted" : "rejected";
  }

  private static async readAll(files: File[], lyricsFiles: (File | null)[]): Promise<LoadedTrack[]> {
    const tracks = new Array<LoadedTrack>(files.length);
    const pending = files.entries();
    const worker = async (): Promise<void> => {
      for (const [index, file] of pending) {
        tracks[index] = await SongLoader.read(file, lyricsFiles[index] ?? null);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
    return tracks;
  }

  private static async read(file: File, lyricsFile: File | null): Promise<LoadedTrack> {
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
      ...SongLoader.coverOf(metadata),
      lyricsFile,
      embeddedLyrics: SongLoader.embeddedLyricsOf(metadata),
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

  private static coverOf(metadata: IAudioMetadata | null): Pick<LoadedTrack, "cover" | "coverType"> {
    const picture = metadata?.common.picture?.[0];
    if (picture === undefined) {
      return { cover: null, coverType: null };
    }
    const coverType = SongLoader.imageType(picture.format);
    return { cover: new Blob([new Uint8Array(picture.data)], { type: coverType }), coverType };
  }

  private static imageType(format: string): string {
    const type = format.trim().toLowerCase();
    if (type.includes("/")) {
      return type;
    }
    return `image/${type === "jpg" ? "jpeg" : type}`;
  }

  private static embeddedLyricsOf(metadata: IAudioMetadata | null): Lyrics | null {
    for (const tag of metadata?.common.lyrics ?? []) {
      const lyrics = toLyrics(SongLoader.lyricLinesOf(tag), "embedded");
      if (lyrics !== null) {
        return lyrics;
      }
    }
    return null;
  }

  private static lyricLinesOf(tag: ILyricsTag): LyricLine[] {
    const timed = tag.timeStampFormat === MILLISECOND_TIMESTAMPS ? tag.syncText : [];
    if (timed.length > 0 && timed.every((line) => line.timestamp !== undefined)) {
      return sortByTime(timed.map((line) => ({ time: (line.timestamp ?? 0) / 1000, text: line.text.trim() })));
    }
    return parseLrc(tag.text ?? "");
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
