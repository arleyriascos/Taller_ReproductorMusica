import { describe, it, expect, vi, afterEach } from "vitest";
import { Song } from "./Song";

function songNamed(title: string, fingerprint = `${title}|1|1`): Song {
  return new Song({ title, artist: "Artista", album: "", duration: 30, fingerprint });
}

function attachLocal(song: Song): void {
  song.attachFile({ file: new File(["audio"], "a.mp3"), cover: new Blob(["img"]), coverType: "image/png", lyricsFile: null, embeddedLyrics: null });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Song remote", () => {
  it("starts as a local, unavailable song", () => {
    const song = songNamed("Uno");
    expect([song.isRemote, song.isAvailable(), song.pageUrl, song.sourceUrl]).toEqual([false, false, null, null]);
  });

  it("attachRemote makes it an available remote song with cover and page", () => {
    const song = songNamed("Uno", "audius:abc");
    song.attachRemote("https://example.test/stream", "https://example.test/cover.jpg", "https://example.test/page");
    expect(song.isRemote).toBe(true);
    expect(song.isAvailable()).toBe(true);
    expect(song.sourceUrl).toBe("https://example.test/stream");
    expect(song.coverUrl).toBe("https://example.test/cover.jpg");
    expect(song.coverType).toBe("image/jpeg");
    expect(song.pageUrl).toBe("https://example.test/page");
    expect(song.fingerprint).toBe("audius:abc");
  });

  it("accepts a remote song without cover", () => {
    const song = songNamed("Uno");
    song.attachRemote("https://example.test/stream", null, "https://example.test/page");
    expect(song.coverUrl).toBeNull();
    expect(song.coverType).toBeNull();
  });

  it("release never revokes remote URLs and keeps the remote song available", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const song = songNamed("Uno");
    song.attachRemote("https://example.test/stream", "https://example.test/cover.jpg", "https://example.test/page");
    song.release();
    expect(revoke).not.toHaveBeenCalled();
    expect([song.isRemote, song.isAvailable(), song.coverUrl, song.pageUrl]).toEqual([true, true, "https://example.test/cover.jpg", "https://example.test/page"]);
  });

  it("attachFile on a remote song turns it into a local one without revoking remote URLs", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const song = songNamed("Uno");
    song.attachRemote("https://example.test/stream", null, "https://example.test/page");
    attachLocal(song);
    expect(revoke).not.toHaveBeenCalled();
    expect([song.isRemote, song.pageUrl]).toEqual([false, null]);
  });

  it("release still revokes the object URLs of a local song", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const song = songNamed("Uno");
    attachLocal(song);
    song.release();
    expect(revoke).toHaveBeenCalledTimes(2);
    expect(song.isAvailable()).toBe(false);
  });

  it("a local song is not remote and has no page", () => {
    const song = songNamed("Uno");
    attachLocal(song);
    expect([song.isRemote, song.pageUrl, song.isAvailable()]).toEqual([false, null, true]);
  });
});
