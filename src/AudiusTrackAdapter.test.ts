import { describe, it, expect } from "vitest";
import { AudiusTrackAdapter } from "./AudiusTrackAdapter";

function rawTrack(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "abc123",
    title: "  Tema inventado  ",
    duration: 187,
    is_streamable: true,
    is_delete: false,
    is_unlisted: false,
    access: { stream: true, download: false },
    permalink: "/artista-inventado/tema-inventado",
    user: { name: " Artista Inventado ", handle: "artista" },
    artwork: {
      "150x150": "https://img.example.test/150.jpg",
      "480x480": "https://img.example.test/480.jpg",
      "1000x1000": "https://img.example.test/1000.jpg",
    },
    ...overrides,
  };
}

const adapter = new AudiusTrackAdapter();

describe("AudiusTrackAdapter", () => {
  it("adapts a valid track into a remote song", () => {
    const song = adapter.toSong(rawTrack());
    expect(song).not.toBeNull();
    expect(song?.title).toBe("Tema inventado");
    expect(song?.artist).toBe("Artista Inventado");
    expect(song?.album).toBe("");
    expect(song?.duration).toBe(187);
    expect(song?.fingerprint).toBe("audius:abc123");
    expect(song?.isRemote).toBe(true);
    expect(song?.isAvailable()).toBe(true);
    expect(song?.sourceUrl).toBe("https://api.audius.co/v1/tracks/abc123/stream?app_name=Musongs");
    expect(song?.pageUrl).toBe("https://audius.co/artista-inventado/tema-inventado");
    expect(song?.coverType).toBe("image/jpeg");
  });

  it("prefers the 480x480 artwork and falls back to other sizes", () => {
    expect(adapter.toSong(rawTrack())?.coverUrl).toBe("https://img.example.test/480.jpg");
    const large = { "1000x1000": "https://img.example.test/1000.jpg", "150x150": "https://img.example.test/150.jpg" };
    expect(adapter.toSong(rawTrack({ artwork: large }))?.coverUrl).toBe("https://img.example.test/1000.jpg");
    expect(adapter.toSong(rawTrack({ artwork: { "150x150": "https://img.example.test/150.jpg" } }))?.coverUrl).toBe("https://img.example.test/150.jpg");
  });

  it("accepts tracks without artwork or with unusable artwork", () => {
    const unusable = [undefined, null, "x", {}, { "480x480": 5 }, { "480x480": "javascript:alert(1)" }, { "480x480": "http://insecure.test/a.jpg" }];
    for (const artwork of unusable) {
      const song = adapter.toSong(rawTrack({ artwork }));
      expect(song).not.toBeNull();
      expect(song?.coverUrl).toBeNull();
    }
  });

  it("accepts an empty artist name", () => {
    expect(adapter.toSong(rawTrack({ user: { name: "" } }))?.artist).toBe("");
  });

  it("rejects values that are not objects", () => {
    for (const value of [null, undefined, 5, "track", [], true]) {
      expect(adapter.toSong(value)).toBeNull();
    }
  });

  it("rejects tracks with an invalid id", () => {
    for (const id of [undefined, 42, "", "a/b", "a b", "a?x=1", "../x"]) {
      expect(adapter.toSong(rawTrack({ id }))).toBeNull();
    }
  });

  it("rejects tracks with a missing or blank title", () => {
    for (const title of [undefined, 3, "", "   "]) {
      expect(adapter.toSong(rawTrack({ title }))).toBeNull();
    }
  });

  it("rejects tracks with an invalid duration", () => {
    for (const duration of [undefined, "187", Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(adapter.toSong(rawTrack({ duration }))).toBeNull();
    }
    expect(adapter.toSong(rawTrack({ duration: 0 }))).not.toBeNull();
  });

  it("rejects tracks without a usable user name", () => {
    for (const user of [undefined, null, "x", {}, { name: 5 }]) {
      expect(adapter.toSong(rawTrack({ user }))).toBeNull();
    }
  });

  it("rejects tracks with an invalid permalink", () => {
    for (const permalink of [undefined, 5, "", "sin-barra", "/con espacio"]) {
      expect(adapter.toSong(rawTrack({ permalink }))).toBeNull();
    }
  });

  it("rejects tracks that cannot be streamed", () => {
    expect(adapter.toSong(rawTrack({ is_streamable: false }))).toBeNull();
    expect(adapter.toSong(rawTrack({ is_streamable: undefined }))).toBeNull();
    expect(adapter.toSong(rawTrack({ is_delete: true }))).toBeNull();
    expect(adapter.toSong(rawTrack({ is_unlisted: true }))).toBeNull();
    expect(adapter.toSong(rawTrack({ access: { stream: false } }))).toBeNull();
  });

  it("accepts tracks without an access field", () => {
    const track = rawTrack();
    delete track.access;
    expect(adapter.toSong(track)).not.toBeNull();
  });

  it("creates a different song object on every call", () => {
    expect(adapter.toSong(rawTrack())).not.toBe(adapter.toSong(rawTrack()));
  });
});
