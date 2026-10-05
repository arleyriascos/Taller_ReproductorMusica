import { describe, it, expect, vi, afterEach } from "vitest";
import { AudiusService } from "./AudiusService";
import type { Song } from "./Song";
import type { AudiusResult } from "./types";

type FetchFunction = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

interface Call {
  url: string;
  signal: AbortSignal;
}

function track(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    title: `Tema ${id}`,
    duration: 100,
    is_streamable: true,
    permalink: `/artista/${id}`,
    user: { name: "Artista" },
    artwork: { "480x480": `https://img.example.test/${id}.jpg` },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function fakeFetch(respond: () => Promise<Response>): { fetch: FetchFunction; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: (url, init) => {
      calls.push({ url, signal: init.signal });
      return respond();
    },
  };
}

function songsOf(result: AudiusResult): Song[] {
  return result.status === "ok" ? result.songs : [];
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AudiusService requests", () => {
  it("asks for trending tracks with the app name and a limit", async () => {
    const fake = fakeFetch(() => Promise.resolve(jsonResponse({ data: [track("a1")] })));
    const result = await new AudiusService(fake.fetch).trending(null);
    expect(result.status).toBe("ok");
    const url = new URL(fake.calls[0].url);
    expect(url.origin + url.pathname).toBe("https://api.audius.co/v1/tracks/trending");
    expect(url.searchParams.get("app_name")).toBe("Musongs");
    expect(url.searchParams.get("limit")).toBe("30");
    expect(url.searchParams.has("genre")).toBe(false);
  });

  it("adds the genre to trending requests", async () => {
    const fake = fakeFetch(() => Promise.resolve(jsonResponse({ data: [] })));
    await new AudiusService(fake.fetch).trending("Hip-Hop/Rap");
    expect(new URL(fake.calls[0].url).searchParams.get("genre")).toBe("Hip-Hop/Rap");
  });

  it("searches with the trimmed query", async () => {
    const fake = fakeFetch(() => Promise.resolve(jsonResponse({ data: [] })));
    await new AudiusService(fake.fetch).search("  lofi & chill ");
    const url = new URL(fake.calls[0].url);
    expect(url.pathname).toBe("/v1/tracks/search");
    expect(url.searchParams.get("query")).toBe("lofi & chill");
  });
});

describe("AudiusService mapping", () => {
  it("maps tracks to remote songs in order", async () => {
    const fake = fakeFetch(() => Promise.resolve(jsonResponse({ data: [track("a1"), track("b2")] })));
    const songs = songsOf(await new AudiusService(fake.fetch).search("x"));
    expect(songs.map((song) => song.title)).toEqual(["Tema a1", "Tema b2"]);
    expect(songs.every((song) => song.isRemote)).toBe(true);
  });

  it("drops invalid items and duplicated fingerprints", async () => {
    const data = [track("a1"), { id: "broken" }, null, "text", track("a1", { title: "Repetida" }), track("b2", { is_streamable: false }), track("c3")];
    const fake = fakeFetch(() => Promise.resolve(jsonResponse({ data })));
    const songs = songsOf(await new AudiusService(fake.fetch).trending(null));
    expect(songs.map((song) => song.fingerprint)).toEqual(["audius:a1", "audius:c3"]);
    expect(songs[0].title).toBe("Tema a1");
  });

  it("returns ok with no songs when the list is empty", async () => {
    const fake = fakeFetch(() => Promise.resolve(jsonResponse({ data: [] })));
    expect(await new AudiusService(fake.fetch).search("nada")).toEqual({ status: "ok", songs: [] });
  });
});

describe("AudiusService errors", () => {
  it("returns an error for network failures", async () => {
    const fake = fakeFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await new AudiusService(fake.fetch).trending(null)).toEqual({ status: "error" });
  });

  it("returns an error for non-200 responses", async () => {
    const fake = fakeFetch(() => Promise.resolve(jsonResponse({ data: [] }, 503)));
    expect(await new AudiusService(fake.fetch).trending(null)).toEqual({ status: "error" });
  });

  it("returns an error for malformed bodies", async () => {
    for (const body of ["not json", JSON.stringify({ nope: 1 }), JSON.stringify({ data: "x" }), JSON.stringify(null)]) {
      const fake = fakeFetch(() => Promise.resolve(new Response(body, { status: 200 })));
      expect(await new AudiusService(fake.fetch).trending(null)).toEqual({ status: "error" });
    }
  });

  it("aborts and returns an error after 10 seconds", async () => {
    vi.useFakeTimers();
    const calls: Call[] = [];
    const hangingFetch: FetchFunction = (url, init) =>
      new Promise((_resolve, reject) => {
        calls.push({ url, signal: init.signal });
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    const pending = new AudiusService(hangingFetch).trending(null);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(calls[0].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await pending).toEqual({ status: "error" });
    expect(calls[0].signal.aborted).toBe(true);
  });

  it("does not cache errors", async () => {
    let attempts = 0;
    const fake = fakeFetch(() => {
      attempts++;
      return Promise.resolve(attempts === 1 ? jsonResponse({}, 500) : jsonResponse({ data: [track("a1")] }));
    });
    const service = new AudiusService(fake.fetch);
    expect(await service.trending(null)).toEqual({ status: "error" });
    expect((await service.trending(null)).status).toBe("ok");
    expect(fake.calls).toHaveLength(2);
  });
});

describe("AudiusService cache", () => {
  it("serves repeated requests from memory for five minutes", async () => {
    let time = 0;
    const fake = fakeFetch(() => Promise.resolve(jsonResponse({ data: [track("a1")] })));
    const service = new AudiusService(fake.fetch, undefined, () => time);
    const first = songsOf(await service.trending("Pop"));
    time = 299_999;
    const second = songsOf(await service.trending("Pop"));
    expect(fake.calls).toHaveLength(1);
    expect(second[0]).toBe(first[0]);
    time = 300_000;
    await service.trending("Pop");
    expect(fake.calls).toHaveLength(2);
  });

  it("keeps separate entries per genre and per query ignoring case and accents", async () => {
    const fake = fakeFetch(() => Promise.resolve(jsonResponse({ data: [] })));
    const service = new AudiusService(fake.fetch);
    await service.trending(null);
    await service.trending("Rock");
    await service.search("Canción");
    await service.search("  cancion ");
    expect(fake.calls).toHaveLength(3);
  });
});
