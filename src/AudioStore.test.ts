import { describe, expect, it, vi } from "vitest";
import { AudioStore } from "./AudioStore";
import { Song } from "./Song";
import type { StoredMedia } from "./types";

const MEDIA: StoredMedia = {
  file: new File(["audio"], "song.mp3", { type: "audio/mpeg" }),
  cover: null,
  coverType: null,
  lyricsFile: null,
  embeddedLyrics: null,
};

function failingFactory(): IDBFactory {
  return {
    open: () => {
      throw new Error("IndexedDB is not available");
    },
  } as unknown as IDBFactory;
}

describe("AudioStore without IndexedDB", () => {
  it("keeps working and reports the failure once", async () => {
    const store = new AudioStore(null);
    const onFailure = vi.fn();
    store.onFailure(onFailure);
    await store.put("a", MEDIA);
    await store.delete("a");
    await store.clear();
    expect(await store.get("a")).toBeNull();
    expect(await store.usage()).toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it("reports a database that fails to open", async () => {
    const store = new AudioStore(failingFactory());
    const onFailure = vi.fn();
    store.onFailure(onFailure);
    await store.put("a", MEDIA);
    expect(await store.get("a")).toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});

function songNamed(title: string, isRemote: boolean): Song {
  const song = new Song({ title, artist: "", album: "", duration: 10, fingerprint: isRemote ? `audius:${title}` : `${title}|1|1` });
  if (isRemote) {
    song.attachRemote(`https://api.audius.co/v1/tracks/${title}/stream?app_name=Musongs`, null, `https://audius.co/x/${title}`);
  }
  return song;
}

describe("AudioStore and remote songs", () => {
  it("reattach asks the store only for local songs", async () => {
    const store = new AudioStore(null);
    const get = vi.spyOn(store, "get").mockResolvedValue(MEDIA);
    const local = songNamed("local", false);
    const remote = songNamed("remote", true);
    await store.reattach([local, remote]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(local.id);
    expect(local.isAvailable()).toBe(true);
    expect(remote.isRemote).toBe(true);
  });

  it("reattach leaves a local song unavailable when nothing is stored", async () => {
    const store = new AudioStore(null);
    vi.spyOn(store, "get").mockResolvedValue(null);
    const local = songNamed("local", false);
    await store.reattach([local]);
    expect(local.isAvailable()).toBe(false);
  });

  it("forget deletes stored media of local songs only", async () => {
    const store = new AudioStore(null);
    const remove = vi.spyOn(store, "delete").mockResolvedValue();
    const local = songNamed("local", false);
    await store.forget(local);
    await store.forget(songNamed("remote", true));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(local.id);
  });
});
