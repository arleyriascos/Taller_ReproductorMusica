import { describe, it, expect } from "vitest";
import { Song } from "./Song";
import { SongLoader } from "./SongLoader";

const SAMPLE_RATE = 8000;

function audioFile(name: string, type = "audio/mpeg", content: BlobPart = "not really audio"): File {
  return new File([content], name, { type, lastModified: 1000 });
}

function acceptingLoader(): SongLoader {
  return new SongLoader(() => true);
}

function chunk(id: string, body: Uint8Array): Uint8Array<ArrayBuffer> {
  const padded = body.length + (body.length % 2);
  const bytes = new Uint8Array(8 + padded);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(id), 0);
  view.setUint32(4, body.length, true);
  bytes.set(body, 8);
  return bytes;
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function infoText(id: string, text: string): Uint8Array<ArrayBuffer> {
  return chunk(id, new TextEncoder().encode(`${text}\0`));
}

function formatChunk(): Uint8Array<ArrayBuffer> {
  const body = new Uint8Array(16);
  const view = new DataView(body.buffer);
  view.setUint16(0, 1, true);
  view.setUint16(2, 1, true);
  view.setUint32(4, SAMPLE_RATE, true);
  view.setUint32(8, SAMPLE_RATE, true);
  view.setUint16(12, 1, true);
  view.setUint16(14, 8, true);
  return chunk("fmt ", body);
}

function syncSafe(size: number): Uint8Array {
  return new Uint8Array([(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f]);
}

function lyricsTag(text: string): Uint8Array<ArrayBuffer> {
  const body = concat([new Uint8Array([0]), new TextEncoder().encode("spa"), new Uint8Array([0]), new TextEncoder().encode(text)]);
  const frameHeader = new Uint8Array(10);
  frameHeader.set(new TextEncoder().encode("USLT"), 0);
  new DataView(frameHeader.buffer).setUint32(4, body.length);
  const frame = concat([frameHeader, body]);
  const header = concat([new TextEncoder().encode("ID3"), new Uint8Array([3, 0, 0]), syncSafe(frame.length)]);
  return chunk("id3 ", concat([header, frame]));
}

function waveBytes(seconds: number, title: string, artist: string, extra: Uint8Array[] = []): Uint8Array<ArrayBuffer> {
  const info = concat([new TextEncoder().encode("INFO"), infoText("INAM", title), infoText("IART", artist)]);
  const samples = new Uint8Array(SAMPLE_RATE * seconds).fill(128);
  const body = concat([new TextEncoder().encode("WAVE"), formatChunk(), chunk("LIST", info), chunk("data", samples), ...extra]);
  return chunk("RIFF", body);
}

function inFolder(file: File, path: string): File {
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

function lyricsFile(name: string): File {
  return new File(["[00:01.00]Linea inventada"], name, { type: "", lastModified: 1000 });
}

describe("SongLoader classification", () => {
  it("ignores non-audio files and counts them", async () => {
    const files = [audioFile("cover.jpg", "image/jpeg"), audioFile("notes.txt", "text/plain"), audioFile("song.mp3")];
    const result = await acceptingLoader().load(files);
    expect(result.ignored).toBe(2);
    expect(result.rejected).toEqual([]);
    expect(result.tracks.map((track) => track.file.name)).toEqual(["song.mp3"]);
  });

  it("rejects audio the probe cannot play", async () => {
    const loader = new SongLoader((mimeType) => mimeType !== "audio/flac");
    const result = await loader.load([audioFile("lossless.flac", "audio/flac"), audioFile("song.mp3")]);
    expect(result.rejected).toEqual([{ name: "lossless.flac", reason: "unsupported-format" }]);
    expect(result.tracks.map((track) => track.file.name)).toEqual(["song.mp3"]);
    expect(result.ignored).toBe(0);
  });

  it("accepts by extension when the file type is empty and probes the inferred type", async () => {
    const probed: string[] = [];
    const loader = new SongLoader((mimeType) => {
      probed.push(mimeType);
      return true;
    });
    const result = await loader.load([audioFile("Track.M4A", ""), audioFile("README", "")]);
    expect(result.tracks.map((track) => track.file.name)).toEqual(["Track.M4A"]);
    expect(result.ignored).toBe(1);
    expect(probed).toEqual(["audio/mp4"]);
  });

  it("rejects a file with an audio extension and an empty type when the probe refuses it", async () => {
    const result = await new SongLoader(() => false).load([audioFile("old.wma", "")]);
    expect(result.rejected).toEqual([{ name: "old.wma", reason: "unsupported-format" }]);
    expect(result.tracks).toEqual([]);
  });
});

describe("SongLoader ordering", () => {
  it("sorts files in natural order", async () => {
    const files = [audioFile("10 - a.mp3"), audioFile("2 - b.mp3"), audioFile("1 - c.mp3")];
    const result = await acceptingLoader().load(files);
    expect(result.tracks.map((track) => track.file.name)).toEqual(["1 - c.mp3", "2 - b.mp3", "10 - a.mp3"]);
  });

  it("preserves the sorted order with more files than the concurrency limit", async () => {
    const names = Array.from({ length: 11 }, (_, index) => `Track ${11 - index}.mp3`);
    const result = await acceptingLoader().load(names.map((name) => audioFile(name)));
    const expected = Array.from({ length: 11 }, (_, index) => `Track ${index + 1}`);
    expect(result.tracks.map((track) => track.details.title)).toEqual(expected);
  });

  it("returns empty results for no files", async () => {
    expect(await acceptingLoader().load([])).toEqual({ tracks: [], rejected: [], ignored: 0 });
  });
});

describe("SongLoader metadata", () => {
  it("falls back to the file name when parsing fails", async () => {
    const file = audioFile("Mi canción.mp3", "audio/mpeg", new Uint8Array([1, 2, 3, 4, 5]));
    const [track] = (await acceptingLoader().load([file])).tracks;
    expect(track.details).toEqual({
      title: "Mi canción",
      artist: "",
      album: "",
      duration: 0,
      fingerprint: Song.fingerprintOf(file),
    });
    expect(track.cover).toBeNull();
    expect(track.coverType).toBeNull();
    expect(track.lyricsFile).toBeNull();
    expect(track.embeddedLyrics).toBeNull();
    expect(track.file).toBe(file);
  });

  it("uses Song.fingerprintOf for the fingerprint", async () => {
    const file = audioFile("song.mp3");
    const [track] = (await acceptingLoader().load([file])).tracks;
    expect(track.details.fingerprint).toBe(Song.fingerprintOf(file));
  });

  it("reads title, artist and duration from real metadata", async () => {
    const file = audioFile("tagged.wav", "audio/wav", waveBytes(2, "Titulo real", "Artista real"));
    const [track] = (await acceptingLoader().load([file])).tracks;
    expect(track.details.title).toBe("Titulo real");
    expect(track.details.artist).toBe("Artista real");
    expect(track.details.album).toBe("");
    expect(track.details.duration).toBeCloseTo(2, 3);
    expect(track.cover).toBeNull();
  });
});

describe("SongLoader lyrics files", () => {
  it("pairs loose .lrc files with the audio that has the same base name", async () => {
    const lrc = lyricsFile("Tema.LRC");
    const result = await acceptingLoader().load([audioFile("tema.mp3"), lrc, audioFile("otro.mp3")]);
    const byName = new Map(result.tracks.map((track) => [track.file.name, track.lyricsFile]));
    expect(byName.get("tema.mp3")).toBe(lrc);
    expect(byName.get("otro.mp3")).toBeNull();
    expect(result.ignored).toBe(0);
    expect(result.tracks).toHaveLength(2);
  });

  it("pairs only inside the same folder", async () => {
    const lrc = inFolder(lyricsFile("tema.lrc"), "Musica/Disco A/tema.lrc");
    const sameFolder = inFolder(audioFile("tema.mp3"), "Musica/Disco A/tema.mp3");
    const otherFolder = inFolder(audioFile("tema.mp3", "audio/mpeg", "otro"), "Musica/Disco B/tema.mp3");
    const result = await acceptingLoader().load([otherFolder, lrc, sameFolder]);
    const byPath = new Map(result.tracks.map((track) => [track.file.webkitRelativePath, track.lyricsFile]));
    expect(byPath.get("Musica/Disco A/tema.mp3")).toBe(lrc);
    expect(byPath.get("Musica/Disco B/tema.mp3")).toBeNull();
    expect(result.ignored).toBe(0);
  });

  it("counts unpaired .lrc files as ignored", async () => {
    const result = await acceptingLoader().load([lyricsFile("suelta.lrc"), audioFile("tema.mp3"), lyricsFile("tema.lrc")]);
    expect(result.ignored).toBe(1);
    expect(result.tracks.map((track) => track.lyricsFile?.name)).toEqual(["tema.lrc"]);
  });

  it("counts the .lrc of a rejected audio file as ignored", async () => {
    const result = await new SongLoader(() => false).load([audioFile("tema.mp3"), lyricsFile("tema.lrc")]);
    expect(result.rejected).toHaveLength(1);
    expect(result.ignored).toBe(1);
  });
});

describe("SongLoader embedded lyrics", () => {
  it("reads synced embedded lyrics with timestamps", async () => {
    const text = "[00:00.50]Primera linea inventada\n[00:01.25]Segunda linea inventada";
    const file = audioFile("letra.wav", "audio/wav", waveBytes(2, "Tema", "Grupo", [lyricsTag(text)]));
    const [track] = (await acceptingLoader().load([file])).tracks;
    expect(track.embeddedLyrics).toEqual({
      synced: true,
      instrumental: false,
      source: "embedded",
      lines: [
        { time: 0.5, text: "Primera linea inventada" },
        { time: 1.25, text: "Segunda linea inventada" },
      ],
    });
  });

  it("reads plain embedded lyrics as unsynced lines", async () => {
    const file = audioFile("plano.wav", "audio/wav", waveBytes(1, "Tema", "Grupo", [lyricsTag("Linea uno\nLinea dos")]));
    const [track] = (await acceptingLoader().load([file])).tracks;
    expect(track.embeddedLyrics?.synced).toBe(false);
    expect(track.embeddedLyrics?.lines).toEqual([
      { time: null, text: "Linea uno" },
      { time: null, text: "Linea dos" },
    ]);
  });

  it("has no embedded lyrics when the tag is missing", async () => {
    const file = audioFile("sin.wav", "audio/wav", waveBytes(1, "Tema", "Grupo"));
    const [track] = (await acceptingLoader().load([file])).tracks;
    expect(track.embeddedLyrics).toBeNull();
  });
});
