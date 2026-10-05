import { describe, expect, it, vi } from "vitest";
import { PlaylistStorage } from "./PlaylistStorage";
import type { Preferences, StoredState } from "./types";

class FakeStorage implements Storage {
  readonly #items = new Map<string, string>();
  isBroken = false;

  get length(): number {
    return this.#items.size;
  }

  clear(): void {
    this.#items.clear();
  }

  getItem(key: string): string | null {
    this.failWhenBroken();
    return this.#items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.failWhenBroken();
    this.#items.set(key, value);
  }

  private failWhenBroken(): void {
    if (this.isBroken) {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    }
  }
}

const STATE: StoredState = {
  version: 1,
  songs: [
    { id: "a", title: "Uno", artist: "", album: "", duration: 10, fingerprint: "a|1|1" },
    { id: "b", title: "Dos", artist: "Alguien", album: "Disco", duration: 0, fingerprint: "b|2|2" },
  ],
  library: ["a", "b"],
  playlists: [{ id: "p", name: "Mix", songIds: ["b", "a", "b"] }],
};

const PREFERENCES: Preferences = { volume: 0.4, muted: true, repeatMode: "all", rightColumnOpen: false, rightColumnTab: "structure" };

describe("PlaylistStorage", () => {
  it("round-trips the state", () => {
    const storage = new PlaylistStorage(new FakeStorage());
    storage.saveState(STATE);
    expect(storage.loadState()).toEqual(STATE);
  });

  it("round-trips the preferences", () => {
    const storage = new PlaylistStorage(new FakeStorage());
    storage.savePreferences(PREFERENCES);
    expect(storage.loadPreferences()).toEqual(PREFERENCES);
  });

  it("returns null when nothing is stored", () => {
    const storage = new PlaylistStorage(new FakeStorage());
    expect(storage.loadState()).toBeNull();
    expect(storage.loadPreferences()).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    const fake = new FakeStorage();
    fake.setItem("musongs.state.v1", "{not json");
    fake.setItem("musongs.preferences.v1", "[");
    const storage = new PlaylistStorage(fake);
    expect(storage.loadState()).toBeNull();
    expect(storage.loadPreferences()).toBeNull();
  });

  it("rejects a wrong version", () => {
    const fake = new FakeStorage();
    fake.setItem("musongs.state.v1", JSON.stringify({ ...STATE, version: 2 }));
    expect(new PlaylistStorage(fake).loadState()).toBeNull();
  });

  it("rejects a state whose lists reference unknown songs", () => {
    const fake = new FakeStorage();
    fake.setItem("musongs.state.v1", JSON.stringify({ ...STATE, library: ["a", "missing"] }));
    expect(new PlaylistStorage(fake).loadState()).toBeNull();
  });

  it("rejects a state with duplicated song ids", () => {
    const fake = new FakeStorage();
    fake.setItem("musongs.state.v1", JSON.stringify({ ...STATE, songs: [STATE.songs[0], STATE.songs[0]] }));
    expect(new PlaylistStorage(fake).loadState()).toBeNull();
  });

  it("rejects malformed songs and playlists", () => {
    const fake = new FakeStorage();
    const storage = new PlaylistStorage(fake);
    fake.setItem("musongs.state.v1", JSON.stringify({ ...STATE, songs: [{ id: "a" }] }));
    expect(storage.loadState()).toBeNull();
    fake.setItem("musongs.state.v1", JSON.stringify({ ...STATE, playlists: [{ id: "p", name: 3, songIds: [] }] }));
    expect(storage.loadState()).toBeNull();
  });

  it("rejects invalid preferences", () => {
    const fake = new FakeStorage();
    const storage = new PlaylistStorage(fake);
    fake.setItem("musongs.preferences.v1", JSON.stringify({ ...PREFERENCES, volume: 3 }));
    expect(storage.loadPreferences()).toBeNull();
    fake.setItem("musongs.preferences.v1", JSON.stringify({ ...PREFERENCES, repeatMode: "loop" }));
    expect(storage.loadPreferences()).toBeNull();
    fake.setItem("musongs.preferences.v1", JSON.stringify({ ...PREFERENCES, rightColumnTab: "other" }));
    expect(storage.loadPreferences()).toBeNull();
  });

  it("clears both keys", () => {
    const storage = new PlaylistStorage(new FakeStorage());
    storage.saveState(STATE);
    storage.savePreferences(PREFERENCES);
    storage.clear();
    expect(storage.loadState()).toBeNull();
    expect(storage.loadPreferences()).toBeNull();
  });

  it("reports a write failure only once and does not throw", () => {
    const fake = new FakeStorage();
    fake.isBroken = true;
    const storage = new PlaylistStorage(fake);
    const onFailure = vi.fn();
    storage.onFailure(onFailure);
    storage.saveState(STATE);
    storage.savePreferences(PREFERENCES);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it("reports once when storage is unavailable", () => {
    const storage = new PlaylistStorage(null);
    const onFailure = vi.fn();
    storage.onFailure(onFailure);
    storage.saveState(STATE);
    expect(storage.loadState()).toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
