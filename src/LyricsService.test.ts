import { describe, it, expect } from "vitest";
import { LyricsService } from "./LyricsService";
import { Song } from "./Song";
import type { Lyrics, SongDetails } from "./types";

type Reply = (url: URL) => Response | Promise<Response>;

interface FakeFetch {
  fetchFn: typeof fetch;
  urls: URL[];
}

const SYNCED_TEXT = "[00:01.00]Linea inventada uno\n[00:02.00]Linea inventada dos";
const EMBEDDED: Lyrics = { synced: false, instrumental: false, lines: [{ time: null, text: "Letra incluida" }], source: "embedded" };

function fakeFetch(reply: Reply): FakeFetch {
  const urls: URL[] = [];
  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    return reply(url);
  };
  return { fetchFn, urls };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function notFound(): Response {
  return json({ statusCode: 404, name: "TrackNotFound" }, 404);
}

function songWith(details: Partial<SongDetails>, lyricsFile: File | null = null, embeddedLyrics: Lyrics | null = null): Song {
  const song = new Song({ title: "Tema", artist: "Grupo", album: "", duration: 200, fingerprint: "x|1|1", ...details });
  song.attachFile({ file: new File(["audio"], "tema.mp3"), cover: null, coverType: null, lyricsFile, embeddedLyrics });
  return song;
}

function neverCalled(): FakeFetch {
  return fakeFetch(() => {
    throw new Error("fetch should not be called");
  });
}

describe("LyricsService priority", () => {
  it("uses the paired .lrc file first", async () => {
    const network = neverCalled();
    const song = songWith({}, new File([SYNCED_TEXT], "tema.lrc"), EMBEDDED);
    const result = await new LyricsService(network.fetchFn).getLyrics(song);
    expect(result.status === "found" && result.lyrics.source).toBe("file");
    expect(result.status === "found" && result.lyrics.synced).toBe(true);
    expect(network.urls).toEqual([]);
  });

  it("uses embedded lyrics when there is no file", async () => {
    const network = neverCalled();
    const result = await new LyricsService(network.fetchFn).getLyrics(songWith({}, null, EMBEDDED));
    expect(result).toEqual({ status: "found", lyrics: EMBEDDED });
    expect(network.urls).toEqual([]);
  });

  it("falls back to embedded lyrics when the .lrc file is empty", async () => {
    const song = songWith({}, new File(["  \n"], "tema.lrc"), EMBEDDED);
    const result = await new LyricsService(neverCalled().fetchFn).getLyrics(song);
    expect(result.status === "found" && result.lyrics.source).toBe("embedded");
  });

  it("asks LRCLIB only when there are no local lyrics", async () => {
    const network = fakeFetch(() => json({ duration: 200, instrumental: false, syncedLyrics: SYNCED_TEXT, plainLyrics: "x" }));
    const result = await new LyricsService(network.fetchFn).getLyrics(songWith({}));
    expect(result.status === "found" && result.lyrics).toEqual({
      synced: true,
      instrumental: false,
      source: "lrclib",
      lines: [
        { time: 1, text: "Linea inventada uno" },
        { time: 2, text: "Linea inventada dos" },
      ],
    });
    expect(network.urls).toHaveLength(1);
  });
});

describe("LyricsService LRCLIB query", () => {
  it("sends the cleaned title, artist, album and rounded duration to /api/get", async () => {
    const network = fakeFetch(() => json({ syncedLyrics: SYNCED_TEXT }));
    const song = songWith({ title: "Grupo - Tema (Official Video)", artist: "Grupo", album: " Disco ", duration: 199.6 });
    await new LyricsService(network.fetchFn).getLyrics(song);
    const [url] = network.urls;
    expect(`${url.origin}${url.pathname}`).toBe("https://lrclib.net/api/get");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      artist_name: "Grupo",
      track_name: "Tema",
      album_name: "Disco",
      duration: "200",
    });
  });

  it("omits an empty album and an unknown duration", async () => {
    const network = fakeFetch(() => json({ syncedLyrics: SYNCED_TEXT }));
    await new LyricsService(network.fetchFn).getLyrics(songWith({ duration: 0 }));
    expect([...network.urls[0].searchParams.keys()]).toEqual(["artist_name", "track_name"]);
  });

  it("splits the artist from the title when the song has no artist", async () => {
    const network = fakeFetch(() => json({ syncedLyrics: SYNCED_TEXT }));
    await new LyricsService(network.fetchFn).getLyrics(songWith({ title: "Grupo Ficticio - Tema", artist: "" }));
    expect(network.urls[0].searchParams.get("artist_name")).toBe("Grupo Ficticio");
    expect(network.urls[0].searchParams.get("track_name")).toBe("Tema");
  });

  it("goes straight to search without artist_name when no artist is known", async () => {
    const network = fakeFetch(() => json([{ duration: 200, plainLyrics: "Linea" }]));
    await new LyricsService(network.fetchFn).getLyrics(songWith({ title: "Tema", artist: "" }));
    expect(network.urls.map((url) => url.pathname)).toEqual(["/api/search"]);
    expect(Object.fromEntries(network.urls[0].searchParams)).toEqual({ track_name: "Tema" });
  });

  it("passes an abort signal and no custom headers", async () => {
    const inits: (RequestInit | undefined)[] = [];
    const fetchFn: typeof fetch = async (_input, init) => {
      inits.push(init);
      return json({ syncedLyrics: SYNCED_TEXT });
    };
    await new LyricsService(fetchFn).getLyrics(songWith({}));
    expect(inits[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(inits[0]?.headers).toBeUndefined();
  });
});

describe("LyricsService LRCLIB results", () => {
  it("searches after a 404 and picks the result with the closest duration", async () => {
    const network = fakeFetch((url) =>
      url.pathname.endsWith("/get")
        ? notFound()
        : json([
            { duration: 230, syncedLyrics: "[00:01]Lejos" },
            { duration: 203, syncedLyrics: "[00:01]Cerca" },
            { duration: 199, syncedLyrics: "", plainLyrics: "" },
            { duration: 196, plainLyrics: "Algo cerca" },
          ]),
    );
    const result = await new LyricsService(network.fetchFn).getLyrics(songWith({ duration: 200 }));
    expect(network.urls.map((url) => url.pathname)).toEqual(["/api/get", "/api/search"]);
    expect(Object.fromEntries(network.urls[1].searchParams)).toEqual({ track_name: "Tema", artist_name: "Grupo" });
    expect(result.status === "found" && result.lyrics.lines[0].text).toBe("Cerca");
  });

  it("rejects search results farther than 5 seconds", async () => {
    const network = fakeFetch((url) => (url.pathname.endsWith("/get") ? notFound() : json([{ duration: 206, syncedLyrics: SYNCED_TEXT }])));
    expect(await new LyricsService(network.fetchFn).getLyrics(songWith({ duration: 200 }))).toEqual({ status: "not-found" });
  });

  it("takes the first result with lyrics when the duration is unknown", async () => {
    const network = fakeFetch((url) =>
      url.pathname.endsWith("/get") ? notFound() : json([{ duration: 90 }, { duration: 500, plainLyrics: "Primera" }, { duration: 1, plainLyrics: "Otra" }]),
    );
    const result = await new LyricsService(network.fetchFn).getLyrics(songWith({ duration: 0 }));
    expect(result.status === "found" && result.lyrics.lines[0]).toEqual({ time: null, text: "Primera" });
  });

  it("prefers synced lyrics over plain lyrics", async () => {
    const network = fakeFetch(() => json({ syncedLyrics: SYNCED_TEXT, plainLyrics: "Plana" }));
    const result = await new LyricsService(network.fetchFn).getLyrics(songWith({}));
    expect(result.status === "found" && result.lyrics.synced).toBe(true);
  });

  it("uses plain lyrics when there are no synced lyrics", async () => {
    const network = fakeFetch(() => json({ syncedLyrics: null, plainLyrics: "Linea plana" }));
    const result = await new LyricsService(network.fetchFn).getLyrics(songWith({}));
    expect(result.status === "found" && result.lyrics).toEqual({
      synced: false,
      instrumental: false,
      source: "lrclib",
      lines: [{ time: null, text: "Linea plana" }],
    });
  });

  it("returns instrumental lyrics without lines", async () => {
    const network = fakeFetch(() => json({ instrumental: true, syncedLyrics: null, plainLyrics: null }));
    const result = await new LyricsService(network.fetchFn).getLyrics(songWith({}));
    expect(result).toEqual({ status: "found", lyrics: { synced: false, instrumental: true, lines: [], source: "lrclib" } });
  });

  it("returns not-found when the search is empty", async () => {
    const network = fakeFetch((url) => (url.pathname.endsWith("/get") ? notFound() : json([])));
    expect(await new LyricsService(network.fetchFn).getLyrics(songWith({}))).toEqual({ status: "not-found" });
  });

  it("returns error for a server error", async () => {
    const network = fakeFetch(() => json({ message: "fallo" }, 500));
    expect(await new LyricsService(network.fetchFn).getLyrics(songWith({}))).toEqual({ status: "error" });
  });
});

describe("LyricsService cache", () => {
  it("caches found results per song", async () => {
    const network = fakeFetch(() => json({ syncedLyrics: SYNCED_TEXT }));
    const service = new LyricsService(network.fetchFn);
    const song = songWith({});
    const first = await service.getLyrics(song);
    expect(await service.getLyrics(song)).toBe(first);
    expect(network.urls).toHaveLength(1);
    await service.getLyrics(songWith({}));
    expect(network.urls).toHaveLength(2);
  });

  it("caches not-found results", async () => {
    const network = fakeFetch((url) => (url.pathname.endsWith("/get") ? notFound() : json([])));
    const service = new LyricsService(network.fetchFn);
    const song = songWith({});
    await service.getLyrics(song);
    expect(await service.getLyrics(song)).toEqual({ status: "not-found" });
    expect(network.urls).toHaveLength(2);
  });

  it("does not cache network errors, so a retry asks again", async () => {
    let online = false;
    const network = fakeFetch(() => {
      if (!online) {
        throw new TypeError("Failed to fetch");
      }
      return json({ syncedLyrics: SYNCED_TEXT });
    });
    const service = new LyricsService(network.fetchFn);
    const song = songWith({});
    expect(await service.getLyrics(song)).toEqual({ status: "error" });
    online = true;
    expect((await service.getLyrics(song)).status).toBe("found");
    expect(network.urls).toHaveLength(2);
  });

  it("shares one in-flight request between concurrent calls", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const network = fakeFetch(async () => {
      await gate;
      return json({ syncedLyrics: SYNCED_TEXT });
    });
    const service = new LyricsService(network.fetchFn);
    const song = songWith({});
    const first = service.getLyrics(song);
    const second = service.getLyrics(song);
    expect(second).toBe(first);
    release();
    await Promise.all([first, second]);
    expect(network.urls).toHaveLength(1);
  });
});
