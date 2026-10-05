import { describe, it, expect, vi } from "vitest";
import { ExploreSession } from "./ExploreSession";
import { Playlist } from "./Playlist";
import { Song } from "./Song";
import type { AudiusResult } from "./types";

function remote(id: string): Song {
  const song = new Song({ title: `Tema ${id}`, artist: "Artista", album: "", duration: 50, fingerprint: `audius:${id}` });
  song.attachRemote(`https://api.audius.co/v1/tracks/${id}/stream?app_name=Musongs`, null, `https://audius.co/a/${id}`);
  return song;
}

function ok(...ids: string[]): AudiusResult {
  return { status: "ok", songs: ids.map(remote) };
}

interface Deferred {
  promise: Promise<AudiusResult>;
  resolve: (result: AudiusResult) => void;
}

function deferred(): Deferred {
  let resolve: (result: AudiusResult) => void = () => {};
  const promise = new Promise<AudiusResult>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function titlesOf(session: ExploreSession): string[] {
  return [...session.playlist.nodes()].map((node) => node.value.title);
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("ExploreSession", () => {
  it("starts with an empty Explorar playlist and loads trending once", async () => {
    const trending = vi.fn().mockResolvedValue(ok("a", "b"));
    const session = new ExploreSession({ trending, search: vi.fn() });
    expect(session.playlist.name).toBe("Explorar");
    expect(session.playlist.length).toBe(0);
    session.start();
    session.start();
    await settle();
    expect(trending).toHaveBeenCalledTimes(1);
    expect(trending).toHaveBeenCalledWith(null);
    expect(session.status).toBe("ready");
    expect(titlesOf(session)).toEqual(["Tema a", "Tema b"]);
  });

  it("owns every playlist it creates and no other", async () => {
    const session = new ExploreSession({ trending: vi.fn().mockResolvedValue(ok("a")), search: vi.fn() });
    const initial = session.playlist;
    session.start();
    await settle();
    expect(session.owns(initial)).toBe(true);
    expect(session.owns(session.playlist)).toBe(true);
    expect(session.owns(new Playlist("Explorar"))).toBe(false);
  });

  it("builds the playlist with append so the links follow the result order", async () => {
    const session = new ExploreSession({ trending: vi.fn().mockResolvedValue(ok("a", "b", "c")), search: vi.fn() });
    session.start();
    await settle();
    expect(session.playlist.head?.value.title).toBe("Tema a");
    expect(session.playlist.tail?.value.title).toBe("Tema c");
    expect(session.playlist.head?.next?.value.title).toBe("Tema b");
    expect(session.playlist.tail?.prev?.value.title).toBe("Tema b");
    expect(session.playlist.history.every((operation) => operation.type === "append")).toBe(true);
  });

  it("searches and clears the genre, and chooses a genre clearing the query", async () => {
    const trending = vi.fn().mockResolvedValue(ok("a"));
    const search = vi.fn().mockResolvedValue(ok("z"));
    const session = new ExploreSession({ trending, search });
    session.chooseGenre("Rock");
    await settle();
    expect(trending).toHaveBeenLastCalledWith("Rock");
    expect([session.genre, session.query]).toEqual(["Rock", ""]);
    session.search("  lofi ");
    await settle();
    expect(search).toHaveBeenCalledWith("lofi");
    expect([session.genre, session.query]).toEqual([null, "lofi"]);
    expect(titlesOf(session)).toEqual(["Tema z"]);
    session.chooseGenre(null);
    await settle();
    expect(trending).toHaveBeenLastCalledWith(null);
    expect(session.query).toBe("");
  });

  it("an empty search shows trending", async () => {
    const trending = vi.fn().mockResolvedValue(ok("a"));
    const search = vi.fn();
    const session = new ExploreSession({ trending, search });
    session.search("   ");
    await settle();
    expect(search).not.toHaveBeenCalled();
    expect(trending).toHaveBeenCalledWith(null);
  });

  it("reports loading while waiting and notifies every change", async () => {
    const pending = deferred();
    const session = new ExploreSession({ trending: vi.fn().mockReturnValue(pending.promise), search: vi.fn() });
    const statuses: string[] = [];
    session.onChange(() => statuses.push(session.status));
    session.start();
    expect(session.status).toBe("loading");
    pending.resolve(ok("a"));
    await settle();
    expect(statuses).toEqual(["loading", "ready"]);
  });

  it("reports an error and retries", async () => {
    const trending = vi.fn().mockResolvedValueOnce({ status: "error" }).mockResolvedValueOnce(ok("a"));
    const session = new ExploreSession({ trending, search: vi.fn() });
    session.start();
    await settle();
    expect(session.status).toBe("error");
    expect(session.playlist.length).toBe(0);
    session.retry();
    await settle();
    expect(session.status).toBe("ready");
    expect(titlesOf(session)).toEqual(["Tema a"]);
  });

  it("keeps the previous results when a new request fails", async () => {
    const trending = vi.fn().mockResolvedValueOnce(ok("a")).mockResolvedValueOnce({ status: "error" });
    const session = new ExploreSession({ trending, search: vi.fn() });
    session.start();
    await settle();
    session.retry();
    await settle();
    expect(session.status).toBe("error");
    expect(titlesOf(session)).toEqual(["Tema a"]);
  });

  it("rebuilds into a new playlist object so the old one can keep playing", async () => {
    const trending = vi.fn().mockResolvedValueOnce(ok("a", "b")).mockResolvedValueOnce(ok("c"));
    const session = new ExploreSession({ trending, search: vi.fn() });
    session.start();
    await settle();
    const first = session.playlist;
    const current = first.head;
    if (current !== null) {
      first.select(current);
    }
    session.retry();
    await settle();
    expect(session.playlist).not.toBe(first);
    expect(titlesOf(session)).toEqual(["Tema c"]);
    expect([...first.nodes()].map((node) => node.value.title)).toEqual(["Tema a", "Tema b"]);
    expect(first.current).toBe(current);
  });

  it("ignores a slow response that was replaced by a newer request", async () => {
    const slow = deferred();
    const fast = deferred();
    const trending = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const session = new ExploreSession({ trending, search: vi.fn() });
    session.start();
    session.chooseGenre("Pop");
    fast.resolve(ok("fast"));
    await settle();
    slow.resolve(ok("slow"));
    await settle();
    expect(titlesOf(session)).toEqual(["Tema fast"]);
    expect(session.status).toBe("ready");
  });
});
