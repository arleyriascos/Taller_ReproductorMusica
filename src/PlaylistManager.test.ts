import { describe, it, expect } from "vitest";
import { PlaylistManager } from "./PlaylistManager";
import { Song } from "./Song";
import type { LoadedTrack, Lyrics } from "./types";

function trackFor(name: string, lastModified = 1000): LoadedTrack {
  const file = new File(["audio"], name, { type: "audio/mpeg", lastModified });
  return {
    details: { title: name, artist: "Artista", album: "Album", duration: 60, fingerprint: Song.fingerprintOf(file) },
    file,
    cover: null,
    coverType: null,
    lyricsFile: null,
    embeddedLyrics: null,
  };
}

function trackWithExtras(name: string): LoadedTrack {
  const lyrics: Lyrics = { synced: false, instrumental: false, lines: [{ time: null, text: "Linea" }], source: "embedded" };
  return {
    ...trackFor(name),
    cover: new Blob(["image"], { type: "image/png" }),
    coverType: "image/png",
    lyricsFile: new File(["[00:01]Linea"], name.replace(/\.mp3$/, ".lrc")),
    embeddedLyrics: lyrics,
  };
}

function librarySongs(manager: PlaylistManager): Song[] {
  return [...manager.library.nodes()].map((node) => node.value);
}

describe("PlaylistManager setup", () => {
  it("starts with the library visible and no user playlists", () => {
    const manager = new PlaylistManager();
    expect(manager.library.name).toBe("Biblioteca");
    expect(manager.library.isLibrary).toBe(true);
    expect(manager.visiblePlaylist).toBe(manager.library);
    expect([...manager.userPlaylists()]).toEqual([]);
    expect(manager.getPlaylist(manager.library.id)).toBe(manager.library);
    expect(manager.getPlaylist("missing")).toBeNull();
  });
});

describe("PlaylistManager name validation", () => {
  it.each([
    ["", "empty"],
    ["    ", "empty"],
    ["x".repeat(41), "too-long"],
    ["biblioteca", "duplicate"],
    ["  BIBLIOTÉCA ", "duplicate"],
  ])("checkName(%j) is %s", (name, issue) => {
    expect(new PlaylistManager().checkName(name)).toBe(issue);
  });

  it("accepts 40 characters after trimming", () => {
    expect(new PlaylistManager().checkName(`  ${"x".repeat(40)}  `)).toBeNull();
  });

  it("detects duplicates ignoring case and accents", () => {
    const manager = new PlaylistManager();
    manager.createPlaylist("Canción Favorita");
    expect(manager.checkName("cancion favorita")).toBe("duplicate");
    expect(manager.checkName("CANCIÓN FAVORITA")).toBe("duplicate");
    expect(manager.checkName("Canción Favorita 2")).toBeNull();
  });

  it("treats ñ as a distinct letter", () => {
    const manager = new PlaylistManager();
    manager.createPlaylist("Año");
    expect(manager.checkName("Ano")).toBeNull();
    expect(manager.checkName("AÑO")).toBe("duplicate");
    expect(manager.checkName("año")).toBe("duplicate");
  });

  it("treats n as distinct from ñ in the other direction", () => {
    const manager = new PlaylistManager();
    manager.createPlaylist("Ano");
    expect(manager.checkName("Año")).toBeNull();
    expect(manager.checkName("ANO")).toBe("duplicate");
  });

  it("still ignores accents and case", () => {
    const manager = new PlaylistManager();
    manager.createPlaylist("Música");
    expect(manager.checkName("musica")).toBe("duplicate");
    expect(manager.checkName("MÚSICA")).toBe("duplicate");
    manager.createPlaylist("Pingüino");
    expect(manager.checkName("pinguino")).toBe("duplicate");
  });

  it("createPlaylist trims the name and throws the issue code", () => {
    const manager = new PlaylistManager();
    const playlist = manager.createPlaylist("  Rock  ");
    expect(playlist.name).toBe("Rock");
    expect(playlist.isLibrary).toBe(false);
    expect(manager.getPlaylist(playlist.id)).toBe(playlist);
    expect(() => manager.createPlaylist("")).toThrow("empty");
    expect(() => manager.createPlaylist("x".repeat(41))).toThrow("too-long");
    expect(() => manager.createPlaylist("rock")).toThrow("duplicate");
    expect([...manager.userPlaylists()]).toEqual([playlist]);
  });

  it("keeps user playlists in insertion order", () => {
    const manager = new PlaylistManager();
    const first = manager.createPlaylist("Uno");
    const second = manager.createPlaylist("Dos");
    expect([...manager.userPlaylists()]).toEqual([first, second]);
  });
});

describe("PlaylistManager rename", () => {
  it("allows renaming to the same name with another case excluding itself", () => {
    const manager = new PlaylistManager();
    const playlist = manager.createPlaylist("Rock");
    expect(manager.checkName("ROCK", playlist.id)).toBeNull();
    manager.renamePlaylist(playlist.id, " ROCK ");
    expect(playlist.name).toBe("ROCK");
  });

  it("rejects the name of another playlist", () => {
    const manager = new PlaylistManager();
    manager.createPlaylist("Rock");
    const pop = manager.createPlaylist("Pop");
    expect(() => manager.renamePlaylist(pop.id, "rock")).toThrow("duplicate");
    expect(pop.name).toBe("Pop");
  });

  it("cannot rename the library", () => {
    const manager = new PlaylistManager();
    expect(() => manager.renamePlaylist(manager.library.id, "Otra")).toThrow(Error);
    expect(manager.library.name).toBe("Biblioteca");
  });
});

describe("PlaylistManager delete and visibility", () => {
  it("setVisible changes the visible playlist and rejects unknown ids", () => {
    const manager = new PlaylistManager();
    const playlist = manager.createPlaylist("Rock");
    manager.setVisible(playlist.id);
    expect(manager.visiblePlaylist).toBe(playlist);
    expect(() => manager.setVisible("missing")).toThrow(Error);
    expect(manager.visiblePlaylist).toBe(playlist);
  });

  it("deleting the visible playlist makes the library visible", () => {
    const manager = new PlaylistManager();
    const playlist = manager.createPlaylist("Rock");
    manager.setVisible(playlist.id);
    manager.deletePlaylist(playlist.id);
    expect(manager.getPlaylist(playlist.id)).toBeNull();
    expect(manager.visiblePlaylist).toBe(manager.library);
  });

  it("deleting another playlist keeps the visible one", () => {
    const manager = new PlaylistManager();
    const rock = manager.createPlaylist("Rock");
    const pop = manager.createPlaylist("Pop");
    manager.setVisible(rock.id);
    manager.deletePlaylist(pop.id);
    expect(manager.visiblePlaylist).toBe(rock);
    expect([...manager.userPlaylists()]).toEqual([rock]);
  });

  it("cannot delete the library", () => {
    const manager = new PlaylistManager();
    expect(() => manager.deletePlaylist(manager.library.id)).toThrow(Error);
    expect(manager.getPlaylist(manager.library.id)).toBe(manager.library);
  });
});

describe("PlaylistManager addTracks", () => {
  it("adds new tracks to the end of the library as available songs", () => {
    const manager = new PlaylistManager();
    const result = manager.addTracks([trackFor("a.mp3"), trackFor("b.mp3")]);
    expect(result).toEqual({ added: 2, reconnected: 0, duplicated: 0 });
    const songs = librarySongs(manager);
    expect(songs.map((song) => song.title)).toEqual(["a.mp3", "b.mp3"]);
    expect(songs.every((song) => song.isAvailable())).toBe(true);
    expect(manager.findByFingerprint(songs[0].fingerprint)).toBe(songs[0]);
  });

  it("counts an available song with the same fingerprint as duplicated", () => {
    const manager = new PlaylistManager();
    manager.addTracks([trackFor("a.mp3")]);
    const result = manager.addTracks([trackFor("a.mp3"), trackFor("a.mp3", 2000)]);
    expect(result).toEqual({ added: 1, reconnected: 0, duplicated: 1 });
    expect(manager.library.length).toBe(2);
  });

  it("reconnects an unavailable song with the same fingerprint", () => {
    const manager = new PlaylistManager();
    manager.addTracks([trackFor("a.mp3")]);
    const [song] = librarySongs(manager);
    song.release();
    expect(song.isAvailable()).toBe(false);
    const result = manager.addTracks([trackFor("a.mp3")]);
    expect(result).toEqual({ added: 0, reconnected: 1, duplicated: 0 });
    expect(song.isAvailable()).toBe(true);
    expect(manager.library.length).toBe(1);
  });

  it("passes the cover type and both lyrics sources to a new song", () => {
    const manager = new PlaylistManager();
    const track = trackWithExtras("a.mp3");
    manager.addTracks([track]);
    const [song] = librarySongs(manager);
    expect(song.coverType).toBe("image/png");
    expect(song.coverUrl).not.toBeNull();
    expect(song.lyricsFile).toBe(track.lyricsFile);
    expect(song.embeddedLyrics).toBe(track.embeddedLyrics);
  });

  it("passes the new fields again when reconnecting, and release clears them", () => {
    const manager = new PlaylistManager();
    manager.addTracks([trackFor("a.mp3")]);
    const [song] = librarySongs(manager);
    expect(song.lyricsFile).toBeNull();
    song.release();
    const track = trackWithExtras("a.mp3");
    expect(manager.addTracks([track])).toEqual({ added: 0, reconnected: 1, duplicated: 0 });
    expect(song.coverType).toBe("image/png");
    expect(song.lyricsFile).toBe(track.lyricsFile);
    expect(song.embeddedLyrics).toBe(track.embeddedLyrics);
    song.release();
    expect([song.coverType, song.lyricsFile, song.embeddedLyrics, song.coverUrl]).toEqual([null, null, null, null]);
  });

  it("findByFingerprint returns null when absent", () => {
    expect(new PlaylistManager().findByFingerprint("x|1|1")).toBeNull();
  });
});

describe("PlaylistManager removeSongEverywhere", () => {
  it("removes the song from every list and makes it unavailable", () => {
    const manager = new PlaylistManager();
    manager.addTracks([trackFor("a.mp3"), trackFor("b.mp3")]);
    const [songA, songB] = librarySongs(manager);
    const rock = manager.createPlaylist("Rock");
    const pop = manager.createPlaylist("Pop");
    rock.addAtEnd(songA);
    rock.addAtEnd(songB);
    rock.addAtEnd(songA);
    pop.addAtEnd(songA);
    manager.removeSongEverywhere(songA);
    expect(manager.library.contains(songA)).toBe(false);
    expect(rock.contains(songA)).toBe(false);
    expect(pop.contains(songA)).toBe(false);
    expect(rock.length).toBe(1);
    expect(pop.length).toBe(0);
    expect(songA.isAvailable()).toBe(false);
    expect(songA.sourceUrl).toBeNull();
    expect(songB.isAvailable()).toBe(true);
  });
});

describe("PlaylistManager duplicatePlaylist", () => {
  it("names copies (copia), (copia 2), (copia 3)", () => {
    const manager = new PlaylistManager();
    const rock = manager.createPlaylist("Rock");
    expect(manager.duplicatePlaylist(rock.id).name).toBe("Rock (copia)");
    expect(manager.duplicatePlaylist(rock.id).name).toBe("Rock (copia 2)");
    expect(manager.duplicatePlaylist(rock.id).name).toBe("Rock (copia 3)");
    expect([...manager.userPlaylists()].map((playlist) => playlist.name)).toEqual([
      "Rock",
      "Rock (copia)",
      "Rock (copia 2)",
      "Rock (copia 3)",
    ]);
  });

  it("respects the 40 character limit", () => {
    const manager = new PlaylistManager();
    const long = manager.createPlaylist("x".repeat(40));
    const first = manager.duplicatePlaylist(long.id);
    const second = manager.duplicatePlaylist(long.id);
    expect(first.name).toBe(`${"x".repeat(32)} (copia)`);
    expect(second.name).toBe(`${"x".repeat(30)} (copia 2)`);
    expect(first.name.length).toBeLessThanOrEqual(40);
    expect(second.name.length).toBeLessThanOrEqual(40);
  });

  it("copies the songs into an independent playlist", () => {
    const manager = new PlaylistManager();
    manager.addTracks([trackFor("a.mp3"), trackFor("b.mp3")]);
    const rock = manager.createPlaylist("Rock");
    for (const song of librarySongs(manager)) {
      rock.addAtEnd(song);
    }
    const copy = manager.duplicatePlaylist(rock.id);
    copy.removeAtPosition(1);
    expect(copy.length).toBe(1);
    expect(rock.length).toBe(2);
    expect(manager.getPlaylist(copy.id)).toBe(copy);
  });

  it("duplicates the library into an independent user playlist", () => {
    const manager = new PlaylistManager();
    manager.addTracks([trackFor("a.mp3"), trackFor("b.mp3")]);
    const copy = manager.duplicatePlaylist(manager.library.id);
    expect(copy.name).toBe("Biblioteca (copia)");
    expect(copy.isLibrary).toBe(false);
    expect([...copy.nodes()].map((node) => node.value)).toEqual(librarySongs(manager));
    copy.removeAtPosition(1);
    expect(manager.library.length).toBe(2);
    expect([...manager.userPlaylists()]).toEqual([copy]);
  });

  it("throws for an unknown id", () => {
    expect(() => new PlaylistManager().duplicatePlaylist("missing")).toThrow(Error);
  });
});

describe("PlaylistManager persistence", () => {
  function titles(playlist: { nodes(): Generator<{ value: Song }, void, undefined> }): string[] {
    return [...playlist.nodes()].map((node) => node.value.title);
  }

  function populated(): PlaylistManager {
    const manager = new PlaylistManager();
    manager.addTracks([trackFor("a.mp3"), trackFor("b.mp3"), trackFor("c.mp3")]);
    const [a, b, c] = librarySongs(manager);
    const rock = manager.createPlaylist("Rock");
    for (const song of [c, a, c, b]) {
      rock.addAtEnd(song);
    }
    manager.createPlaylist("Vacía");
    return manager;
  }

  it("serializes the library, the playlists and the songs in forward order", () => {
    const state = populated().toStoredState();
    const [a, b, c] = state.songs;
    expect(state.version).toBe(1);
    expect(state.songs.map((song) => song.title)).toEqual(["a.mp3", "b.mp3", "c.mp3"]);
    expect(state.library).toEqual([a.id, b.id, c.id]);
    expect(state.playlists.map((playlist) => playlist.name)).toEqual(["Rock", "Vacía"]);
    expect(state.playlists[0].songIds).toEqual([c.id, a.id, c.id, b.id]);
    expect(state.playlists[1].songIds).toEqual([]);
  });

  it("stores only plain data that survives JSON", () => {
    const state = populated().toStoredState();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(Object.keys(state.songs[0]).sort()).toEqual(["album", "artist", "duration", "fingerprint", "id", "title"]);
  });

  it("round trips keeping order, duplicates inside a playlist and ids", () => {
    const original = populated();
    const restored = new PlaylistManager();
    restored.restore(JSON.parse(JSON.stringify(original.toStoredState())));
    expect(restored.toStoredState()).toEqual(original.toStoredState());
    const [originalRock, restoredRock] = [[...original.userPlaylists()][0], [...restored.userPlaylists()][0]];
    expect(titles(restoredRock)).toEqual(["c.mp3", "a.mp3", "c.mp3", "b.mp3"]);
    expect(restoredRock.id).toBe(originalRock.id);
    expect(restoredRock.isLibrary).toBe(false);
    expect([...restored.userPlaylists()].map((playlist) => playlist.name)).toEqual(["Rock", "Vacía"]);
  });

  it("rebuilds every list with valid links and shares song objects between lists", () => {
    const restored = new PlaylistManager();
    restored.restore(populated().toStoredState());
    const rock = [...restored.userPlaylists()][0];
    const [first, second, third, fourth] = [...rock.nodes()];
    expect(first.prev).toBeNull();
    expect(fourth.next).toBeNull();
    expect(second.prev).toBe(first);
    expect(third.next).toBe(fourth);
    expect(first.value).toBe(third.value);
    expect(librarySongs(restored)).toContain(second.value);
    expect(restored.library.head?.prev).toBeNull();
    expect(restored.library.tail?.next).toBeNull();
  });

  it("restores songs as unavailable with their saved details", () => {
    const restored = new PlaylistManager();
    restored.restore(populated().toStoredState());
    expect(restored.hasUnavailableSongs()).toBe(true);
    for (const song of librarySongs(restored)) {
      expect(song.isAvailable()).toBe(false);
      expect(song.sourceUrl).toBeNull();
      expect(song.duration).toBe(60);
      expect(song.artist).toBe("Artista");
    }
  });

  it("reports no unavailable songs for an empty or fully available library", () => {
    expect(new PlaylistManager().hasUnavailableSongs()).toBe(false);
    expect(populated().hasUnavailableSongs()).toBe(false);
  });

  it("reconnects restored songs through addTracks keeping their ids", () => {
    const restored = new PlaylistManager();
    restored.restore(populated().toStoredState());
    const idsBefore = librarySongs(restored).map((song) => song.id);
    const placed: string[] = [];
    const result = restored.addTracks([trackFor("b.mp3"), trackFor("z.mp3")], (song) => placed.push(song.title));
    expect(result).toEqual({ added: 1, reconnected: 1, duplicated: 0 });
    expect(placed).toEqual(["b.mp3", "z.mp3"]);
    expect(librarySongs(restored).slice(0, 3).map((song) => song.id)).toEqual(idsBefore);
    expect(librarySongs(restored)[1].isAvailable()).toBe(true);
    expect(librarySongs(restored)[0].isAvailable()).toBe(false);
    expect(restored.hasUnavailableSongs()).toBe(true);
    restored.addTracks([trackFor("a.mp3"), trackFor("c.mp3")]);
    expect(restored.hasUnavailableSongs()).toBe(false);
  });

  it("does not call the placed handler for duplicates", () => {
    const manager = populated();
    const placed: string[] = [];
    const result = manager.addTracks([trackFor("a.mp3")], (song) => placed.push(song.title));
    expect(result.duplicated).toBe(1);
    expect(placed).toEqual([]);
  });

  it("restores an empty state", () => {
    const restored = new PlaylistManager();
    restored.restore(new PlaylistManager().toStoredState());
    expect(restored.library.length).toBe(0);
    expect([...restored.userPlaylists()]).toEqual([]);
  });

  it("refuses to restore into a manager that already has data", () => {
    const state = populated().toStoredState();
    expect(() => populated().restore(state)).toThrow(Error);
  });

  it("throws when a list references an unknown song", () => {
    const state = populated().toStoredState();
    state.library.push("missing");
    expect(() => new PlaylistManager().restore(state)).toThrow(Error);
  });
});
