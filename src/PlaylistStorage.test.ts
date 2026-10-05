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
  version: 2,
  songs: [
    { id: "a", title: "Uno", artist: "", album: "", duration: 10, fingerprint: "a|1|1", source: "local" },
    { id: "b", title: "Dos", artist: "Alguien", album: "Disco", duration: 0, fingerprint: "b|2|2", source: "local" },
    {
      id: "r",
      title: "Remota",
      artist: "Alguien",
      album: "",
      duration: 90,
      fingerprint: "audius:xyz",
      source: "audius",
      streamUrl: "https://api.audius.co/v1/tracks/xyz/stream?app_name=Musongs",
      coverUrl: "https://img.example.test/xyz.jpg",
      pageUrl: "https://audius.co/alguien/remota",
    },
  ],
  library: ["a", "b", "r"],
  playlists: [{ id: "p", name: "Mix", songIds: ["b", "a", "r", "b"] }],
};

const LEGACY_STATE = {
  version: 1,
  songs: [
    { id: "a", title: "Uno", artist: "", album: "", duration: 10, fingerprint: "a|1|1" },
    { id: "b", title: "Dos", artist: "Alguien", album: "Disco", duration: 0, fingerprint: "b|2|2" },
  ],
  library: ["a", "b"],
  playlists: [{ id: "p", name: "Mix", songIds: ["b", "a", "b"] }],
};

const PREFERENCES: Preferences = {
  volume: 0.4,
  muted: true,
  repeatMode: "all",
  rightColumnOpen: false,
  rightColumnTab: "structure",
  panelWidths: { sidebar: 280, right: 400 },
  shuffle: true,
};

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

  it("loads old preferences without panel widths or shuffle using defaults", () => {
    const fake = new FakeStorage();
    const { panelWidths: _widths, shuffle: _shuffle, ...old } = PREFERENCES;
    fake.setItem("musongs.preferences.v1", JSON.stringify(old));
    expect(new PlaylistStorage(fake).loadPreferences()).toEqual({ ...old, panelWidths: { sidebar: 240, right: 340 }, shuffle: false });
  });

  it("replaces malformed panel widths and shuffle with defaults", () => {
    const fake = new FakeStorage();
    fake.setItem("musongs.preferences.v1", JSON.stringify({ ...PREFERENCES, panelWidths: { sidebar: "wide", right: 1 }, shuffle: "yes" }));
    const loaded = new PlaylistStorage(fake).loadPreferences();
    expect(loaded?.panelWidths).toEqual({ sidebar: 240, right: 340 });
    expect(loaded?.shuffle).toBe(false);
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

  it("rejects an unknown version", () => {
    const fake = new FakeStorage();
    fake.setItem("musongs.state.v1", JSON.stringify({ ...STATE, version: 3 }));
    expect(new PlaylistStorage(fake).loadState()).toBeNull();
    fake.setItem("musongs.state.v1", JSON.stringify({ ...STATE, version: 0 }));
    expect(new PlaylistStorage(fake).loadState()).toBeNull();
  });

  it("migrates a version 1 state to version 2 marking every song as local", () => {
    const fake = new FakeStorage();
    fake.setItem("musongs.state.v1", JSON.stringify(LEGACY_STATE));
    const loaded = new PlaylistStorage(fake).loadState();
    expect(loaded?.version).toBe(2);
    expect(loaded?.songs.map((song) => song.source)).toEqual(["local", "local"]);
    expect(loaded?.library).toEqual(["a", "b"]);
    expect(loaded?.playlists).toEqual(LEGACY_STATE.playlists);
  });

  it("saves a migrated state back as version 2", () => {
    const fake = new FakeStorage();
    fake.setItem("musongs.state.v1", JSON.stringify(LEGACY_STATE));
    const storage = new PlaylistStorage(fake);
    const loaded = storage.loadState();
    if (loaded !== null) {
      storage.saveState(loaded);
    }
    expect(JSON.parse(fake.getItem("musongs.state.v1") ?? "{}").version).toBe(2);
  });

  it("round-trips a mixed state with local and audius songs", () => {
    const storage = new PlaylistStorage(new FakeStorage());
    storage.saveState(STATE);
    const loaded = storage.loadState();
    expect(loaded).toEqual(STATE);
    expect(loaded?.songs.map((song) => song.source)).toEqual(["local", "local", "audius"]);
  });

  it("rejects audius songs without valid https URLs", () => {
    const fake = new FakeStorage();
    const storage = new PlaylistStorage(fake);
    const remote = STATE.songs[2];
    for (const patch of [{ streamUrl: "http://insecure.test/s" }, { streamUrl: 5 }, { pageUrl: "javascript:alert(1)" }, { coverUrl: "nope" }, { pageUrl: undefined }]) {
      fake.setItem("musongs.state.v1", JSON.stringify({ ...STATE, songs: [STATE.songs[0], STATE.songs[1], { ...remote, ...patch }] }));
      expect(storage.loadState()).toBeNull();
    }
  });

  it("accepts audius songs without cover", () => {
    const fake = new FakeStorage();
    const remote = { ...STATE.songs[2], coverUrl: null };
    fake.setItem("musongs.state.v1", JSON.stringify({ ...STATE, songs: [STATE.songs[0], STATE.songs[1], remote] }));
    expect(new PlaylistStorage(fake).loadState()?.songs[2]).toEqual(remote);
  });

  it("rejects songs with an unknown source", () => {
    const fake = new FakeStorage();
    fake.setItem("musongs.state.v1", JSON.stringify({ ...STATE, songs: [{ ...STATE.songs[0], source: "cloud" }, STATE.songs[1], STATE.songs[2]] }));
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
