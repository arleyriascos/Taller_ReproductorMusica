import { describe, it, expect } from "vitest";
import { PlaylistManager } from "./PlaylistManager";
import { Song } from "./Song";
import type { LoadedTrack } from "./types";

function trackFor(name: string, lastModified = 1000): LoadedTrack {
  const file = new File(["audio"], name, { type: "audio/mpeg", lastModified });
  return {
    details: { title: name, artist: "Artista", album: "Album", duration: 60, fingerprint: Song.fingerprintOf(file) },
    file,
    cover: null,
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

  it("throws for an unknown id", () => {
    expect(() => new PlaylistManager().duplicatePlaylist("missing")).toThrow(Error);
  });
});
