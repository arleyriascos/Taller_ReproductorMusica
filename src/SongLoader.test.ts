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

function waveBytes(seconds: number, title: string, artist: string): Uint8Array<ArrayBuffer> {
  const info = concat([new TextEncoder().encode("INFO"), infoText("INAM", title), infoText("IART", artist)]);
  const samples = new Uint8Array(SAMPLE_RATE * seconds).fill(128);
  const body = concat([new TextEncoder().encode("WAVE"), formatChunk(), chunk("LIST", info), chunk("data", samples)]);
  return chunk("RIFF", body);
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
