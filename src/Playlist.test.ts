import { describe, it, expect } from "vitest";
import type { Node } from "./Node";
import { Playlist } from "./Playlist";
import { Song } from "./Song";

function songNamed(title: string, duration = 60): Song {
  return new Song({ title, artist: "Artista", album: "Album", duration, fingerprint: `${title}|1|1` });
}

function playlistOf(...songs: Song[]): Playlist {
  const playlist = new Playlist("Prueba");
  for (const song of songs) {
    playlist.addAtEnd(song);
  }
  return playlist;
}

function titlesOf(playlist: Playlist): string[] {
  return [...playlist.nodes()].map((node) => node.value.title);
}

function expectValidLinks(playlist: Playlist): void {
  const nodes = [...playlist.nodes()];
  expect(nodes).toHaveLength(playlist.length);
  if (nodes.length === 0) {
    return;
  }
  expect(nodes[0].prev).toBeNull();
  expect(nodes[nodes.length - 1].next).toBeNull();
  for (const node of nodes) {
    if (node.next !== null) {
      expect(node.next.prev).toBe(node);
    }
  }
}

function nodeAt(playlist: Playlist, position: number): Node<Song> {
  let current = 0;
  for (const node of playlist.nodes()) {
    current++;
    if (current === position) {
      return node;
    }
  }
  throw new Error(`No node at position ${position}`);
}

const a = songNamed("A");
const b = songNamed("B");
const c = songNamed("C");
const d = songNamed("D");

describe("Playlist creation", () => {
  it("starts empty with no current and the given identity", () => {
    const playlist = new Playlist("Mix", false, "id-1");
    expect(playlist.id).toBe("id-1");
    expect(playlist.name).toBe("Mix");
    expect(playlist.isLibrary).toBe(false);
    expect(playlist.length).toBe(0);
    expect(playlist.current).toBeNull();
    expect(playlist.lastOperation).toBeNull();
  });

  it("renames", () => {
    const playlist = new Playlist("Mix");
    playlist.rename("Otro");
    expect(playlist.name).toBe("Otro");
  });
});

describe("Playlist adding", () => {
  it("adds at start and at end", () => {
    const playlist = playlistOf(b);
    playlist.addAtStart(a);
    playlist.addAtEnd(c);
    expect(titlesOf(playlist)).toEqual(["A", "B", "C"]);
    expectValidLinks(playlist);
  });

  it("adds at position 1 as the new head", () => {
    const playlist = playlistOf(b, c);
    const node = playlist.addAtPosition(a, 1);
    expect(playlist.positionOf(node)).toBe(1);
    expect(titlesOf(playlist)).toEqual(["A", "B", "C"]);
    expect(playlist.lastOperation).toMatchObject({ type: "insert", index: 0 });
    expectValidLinks(playlist);
  });

  it("adds at position length + 1 as the new tail", () => {
    const playlist = playlistOf(a, b);
    const node = playlist.addAtPosition(c, 3);
    expect(playlist.positionOf(node)).toBe(3);
    expect(titlesOf(playlist)).toEqual(["A", "B", "C"]);
    expectValidLinks(playlist);
  });

  it("adds at a middle position converting to a 0-based index", () => {
    const playlist = playlistOf(a, c);
    playlist.addAtPosition(b, 2);
    expect(titlesOf(playlist)).toEqual(["A", "B", "C"]);
    expect(playlist.lastOperation).toMatchObject({ type: "insert", index: 1, previousLabel: "A", nextLabel: "C" });
    expectValidLinks(playlist);
  });

  it("adds at position 1 in an empty playlist", () => {
    const playlist = playlistOf();
    playlist.addAtPosition(a, 1);
    expect(titlesOf(playlist)).toEqual(["A"]);
    expectValidLinks(playlist);
  });

  it.each([0, -1, 4, 1.5, Number.NaN])("rejects position %s and leaves the playlist unchanged", (position) => {
    const playlist = playlistOf(a, b);
    const operations = playlist.history.length;
    expect(() => playlist.addAtPosition(c, position)).toThrow(RangeError);
    expect(titlesOf(playlist)).toEqual(["A", "B"]);
    expect(playlist.history).toHaveLength(operations);
    expectValidLinks(playlist);
  });

  it("allows the same song more than once with different nodes", () => {
    const playlist = playlistOf(a);
    const second = playlist.addAtEnd(a);
    expect(titlesOf(playlist)).toEqual(["A", "A"]);
    expect(nodeAt(playlist, 1)).not.toBe(second);
    expect(nodeAt(playlist, 1).value).toBe(second.value);
  });
});

describe("Playlist removing", () => {
  it("removes at positions 1, length and middle", () => {
    const playlist = playlistOf(a, b, c, d);
    expect(playlist.removeAtPosition(1)).toBe(a);
    expect(playlist.removeAtPosition(3)).toBe(d);
    expect(playlist.removeAtPosition(1)).toBe(b);
    expect(titlesOf(playlist)).toEqual(["C"]);
    expectValidLinks(playlist);
  });

  it("records removeAtPosition as remove with a 0-based index", () => {
    const playlist = playlistOf(a, b, c);
    playlist.removeAtPosition(2);
    expect(playlist.lastOperation).toMatchObject({ type: "remove", index: 1, previousLabel: "A", nextLabel: "C" });
  });

  it.each([0, 4, 2.5])("rejects removal at position %s and leaves the playlist unchanged", (position) => {
    const playlist = playlistOf(a, b, c);
    playlist.select(nodeAt(playlist, 2));
    expect(() => playlist.removeAtPosition(position)).toThrow(RangeError);
    expect(titlesOf(playlist)).toEqual(["A", "B", "C"]);
    expect(playlist.current?.value).toBe(b);
  });

  it("rejects removal on an empty playlist", () => {
    expect(() => playlistOf().removeAtPosition(1)).toThrow(RangeError);
  });

  it("removes a known node", () => {
    const playlist = playlistOf(a, b, c);
    expect(playlist.removeNode(nodeAt(playlist, 2))).toBe(b);
    expect(titlesOf(playlist)).toEqual(["A", "C"]);
    expectValidLinks(playlist);
  });

  it("removing current with a next moves current to the next", () => {
    const playlist = playlistOf(a, b, c);
    playlist.select(nodeAt(playlist, 2));
    playlist.removeNode(nodeAt(playlist, 2));
    expect(playlist.current?.value).toBe(c);
    expect(playlist.current).toBe(nodeAt(playlist, 2));
  });

  it("removing current at the tail moves current to the previous", () => {
    const playlist = playlistOf(a, b, c);
    playlist.select(nodeAt(playlist, 3));
    playlist.removeAtPosition(3);
    expect(playlist.current?.value).toBe(b);
  });

  it("removing the only node that is current leaves current null", () => {
    const playlist = playlistOf(a);
    playlist.select(nodeAt(playlist, 1));
    playlist.removeAtPosition(1);
    expect(playlist.current).toBeNull();
    expect(playlist.length).toBe(0);
  });

  it("removing a node that is not current keeps current", () => {
    const playlist = playlistOf(a, b, c);
    const current = nodeAt(playlist, 3);
    playlist.select(current);
    playlist.removeAtPosition(1);
    expect(playlist.current).toBe(current);
  });

  it("removeAllOf removes every node holding the song", () => {
    const playlist = playlistOf(a, b, a, c, a);
    expect(playlist.removeAllOf(a)).toBe(3);
    expect(titlesOf(playlist)).toEqual(["B", "C"]);
    expect(playlist.contains(a)).toBe(false);
    expectValidLinks(playlist);
  });

  it("removeAllOf with the same song three times including current moves current past all of them", () => {
    const playlist = playlistOf(a, b, a, a);
    playlist.select(nodeAt(playlist, 3));
    expect(playlist.removeAllOf(a)).toBe(3);
    expect(titlesOf(playlist)).toEqual(["B"]);
    expect(playlist.current?.value).toBe(b);
    expectValidLinks(playlist);
  });

  it("removeAllOf returns 0 when the song is absent", () => {
    const playlist = playlistOf(a, b);
    expect(playlist.removeAllOf(c)).toBe(0);
    expect(titlesOf(playlist)).toEqual(["A", "B"]);
  });
});

describe("Playlist moving", () => {
  it("moves a node up and down keeping valid links", () => {
    const playlist = playlistOf(a, b, c);
    playlist.moveUp(nodeAt(playlist, 3));
    expect(titlesOf(playlist)).toEqual(["A", "C", "B"]);
    expectValidLinks(playlist);
    playlist.moveDown(nodeAt(playlist, 1));
    expect(titlesOf(playlist)).toEqual(["C", "A", "B"]);
    expectValidLinks(playlist);
  });

  it("does nothing at the edges", () => {
    const playlist = playlistOf(a, b, c);
    playlist.moveUp(nodeAt(playlist, 1));
    playlist.moveDown(nodeAt(playlist, 3));
    expect(titlesOf(playlist)).toEqual(["A", "B", "C"]);
    expect(playlist.history).toHaveLength(3);
  });

  it("does nothing on a single-node playlist", () => {
    const playlist = playlistOf(a);
    playlist.moveUp(nodeAt(playlist, 1));
    playlist.moveDown(nodeAt(playlist, 1));
    expect(titlesOf(playlist)).toEqual(["A"]);
  });

  it("keeps the current node when the current node moves", () => {
    const playlist = playlistOf(a, b, c);
    const current = nodeAt(playlist, 2);
    playlist.select(current);
    playlist.moveDown(current);
    expect(playlist.current).toBe(current);
    expect(titlesOf(playlist)).toEqual(["A", "C", "B"]);
    expect(playlist.previous()?.value).toBe(c);
  });

  it("keeps the current node when another node moves past it", () => {
    const playlist = playlistOf(a, b, c);
    const current = nodeAt(playlist, 2);
    playlist.select(current);
    playlist.moveUp(nodeAt(playlist, 3));
    playlist.moveUp(nodeAt(playlist, 2));
    expect(playlist.current).toBe(current);
    expect(titlesOf(playlist)).toEqual(["C", "A", "B"]);
    expectValidLinks(playlist);
  });

  it("records the move in the history", () => {
    const playlist = playlistOf(a, b, c);
    playlist.moveUp(nodeAt(playlist, 3));
    expect(playlist.lastOperation).toMatchObject({ type: "move", index: 1, valueLabel: "C", previousLabel: "A", nextLabel: "B" });
  });

  it("rejects a node from another playlist", () => {
    const playlist = playlistOf(a, b);
    const foreign = playlistOf(c, a, b);
    expect(() => playlist.moveUp(nodeAt(foreign, 2))).toThrow(Error);
    expect(titlesOf(playlist)).toEqual(["A", "B"]);
  });
});

describe("Playlist navigation", () => {
  it("select sets current to a node of the playlist", () => {
    const playlist = playlistOf(a, b);
    const node = nodeAt(playlist, 2);
    playlist.select(node);
    expect(playlist.current).toBe(node);
  });

  it("select rejects a node from another playlist", () => {
    const playlist = playlistOf(a, b);
    const foreign = nodeAt(playlistOf(a), 1);
    expect(() => playlist.select(foreign)).toThrow(Error);
    expect(playlist.current).toBeNull();
  });

  it("next and previous follow the links", () => {
    const playlist = playlistOf(a, b, c);
    playlist.select(nodeAt(playlist, 1));
    expect(playlist.next()?.value).toBe(b);
    expect(playlist.next()?.value).toBe(c);
    expect(playlist.previous()?.value).toBe(b);
    expect(playlist.current?.value).toBe(b);
  });

  it("hasNext and hasPrevious are false at the edges", () => {
    const playlist = playlistOf(a, b);
    playlist.select(nodeAt(playlist, 1));
    expect(playlist.hasPrevious()).toBe(false);
    expect(playlist.hasNext()).toBe(true);
    expect(playlist.previous()).toBeNull();
    expect(playlist.current?.value).toBe(a);
    playlist.next();
    expect(playlist.hasNext()).toBe(false);
    expect(playlist.hasPrevious()).toBe(true);
    expect(playlist.next()).toBeNull();
    expect(playlist.current?.value).toBe(b);
  });

  it("next and previous do nothing without current", () => {
    const playlist = playlistOf(a, b);
    expect(playlist.next()).toBeNull();
    expect(playlist.previous()).toBeNull();
    expect(playlist.hasNext()).toBe(false);
    expect(playlist.hasPrevious()).toBe(false);
    expect(playlist.current).toBeNull();
  });

  it("selectFirst and selectLast return null on an empty playlist", () => {
    const playlist = new Playlist("Vacía");
    expect(playlist.selectFirst()).toBeNull();
    expect(playlist.selectLast()).toBeNull();
    expect(playlist.current).toBeNull();
    expectValidLinks(playlist);
  });

  it("selectFirst moves current to the head from the tail", () => {
    const playlist = playlistOf(a, b, c);
    playlist.select(nodeAt(playlist, 3));
    const first = playlist.selectFirst();
    expect(first).toBe(nodeAt(playlist, 1));
    expect(playlist.current).toBe(first);
    expect(first?.prev).toBeNull();
    expect(playlist.hasPrevious()).toBe(false);
    expectValidLinks(playlist);
  });

  it("selectLast moves current to the tail from the head", () => {
    const playlist = playlistOf(a, b, c);
    playlist.select(nodeAt(playlist, 1));
    const last = playlist.selectLast();
    expect(last).toBe(nodeAt(playlist, 3));
    expect(playlist.current).toBe(last);
    expect(last?.next).toBeNull();
    expect(playlist.hasNext()).toBe(false);
    expectValidLinks(playlist);
  });

  it("selectFirst and selectLast work without a previous current", () => {
    const playlist = playlistOf(a, b);
    expect(playlist.selectLast()?.value).toBe(b);
    expect(playlist.current?.value).toBe(b);
    const fresh = playlistOf(c, d);
    expect(fresh.selectFirst()?.value).toBe(c);
    expect(fresh.current?.value).toBe(c);
  });

  it("selectFirst and selectLast on a single song return the same node", () => {
    const playlist = playlistOf(a);
    const first = playlist.selectFirst();
    expect(playlist.selectLast()).toBe(first);
    expect(first?.next).toBeNull();
    expect(first?.prev).toBeNull();
    expectValidLinks(playlist);
  });

  it("selecting the edges never makes the list circular or records operations", () => {
    const playlist = playlistOf(a, b, c);
    const operations = playlist.history.length;
    playlist.selectLast();
    expect(playlist.next()).toBeNull();
    playlist.selectFirst();
    expect(playlist.previous()).toBeNull();
    expect(playlist.history).toHaveLength(operations);
    expect(titlesOf(playlist)).toEqual(["A", "B", "C"]);
    expectValidLinks(playlist);
  });
});

describe("Playlist reading", () => {
  it("positionOf is 1-based and 0 when absent", () => {
    const playlist = playlistOf(a, b);
    expect(playlist.positionOf(nodeAt(playlist, 2))).toBe(2);
    expect(playlist.positionOf(nodeAt(playlistOf(a), 1))).toBe(0);
  });

  it("contains and totalDuration", () => {
    const playlist = playlistOf(songNamed("X", 30), songNamed("Y", 45), a);
    expect(playlist.contains(a)).toBe(true);
    expect(playlist.contains(b)).toBe(false);
    expect(playlist.totalDuration()).toBe(135);
    expect(playlistOf().totalDuration()).toBe(0);
  });
});

describe("Playlist clone", () => {
  it("copies the order with new nodes and the same songs", () => {
    const original = playlistOf(a, b, a);
    original.select(nodeAt(original, 2));
    const copy = original.clone("Copia");
    expect(copy.name).toBe("Copia");
    expect(copy.isLibrary).toBe(false);
    expect(copy.id).not.toBe(original.id);
    expect(titlesOf(copy)).toEqual(["A", "B", "A"]);
    const originalNodes = [...original.nodes()];
    const copyNodes = [...copy.nodes()];
    for (let position = 0; position < copyNodes.length; position++) {
      expect(copyNodes[position]).not.toBe(originalNodes[position]);
      expect(copyNodes[position].value).toBe(originalNodes[position].value);
    }
    expectValidLinks(copy);
  });

  it("starts with empty history and no current", () => {
    const original = playlistOf(a, b);
    original.select(nodeAt(original, 1));
    const copy = original.clone("Copia");
    expect(copy.history).toEqual([]);
    expect(copy.lastOperation).toBeNull();
    expect(copy.current).toBeNull();
  });

  it("keeps the original unchanged after modifying the clone", () => {
    const original = playlistOf(a, b, c);
    const current = nodeAt(original, 2);
    original.select(current);
    const operations = original.history.length;
    const copy = original.clone("Copia");
    copy.removeAtPosition(2);
    copy.addAtStart(d);
    expect(titlesOf(copy)).toEqual(["D", "A", "C"]);
    expect(titlesOf(original)).toEqual(["A", "B", "C"]);
    expect(original.current).toBe(current);
    expect(original.history).toHaveLength(operations);
    expectValidLinks(original);
  });

  it("clones a library as a regular playlist", () => {
    const library = new Playlist("Biblioteca", true);
    library.addAtEnd(a);
    expect(library.clone("Copia").isLibrary).toBe(false);
  });
});
