import { describe, expect, it, vi } from "vitest";
import { AudioStore } from "./AudioStore";
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
