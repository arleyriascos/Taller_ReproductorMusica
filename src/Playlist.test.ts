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

describe("Playlist moveToPosition", () => {
  it("moves a node forward and backward to a 1-based position", () => {
    const playlist = playlistOf(a, b, c, d);
    playlist.moveToPosition(nodeAt(playlist, 1), 3);
    expect(titlesOf(playlist)).toEqual(["B", "C", "A", "D"]);
    expectValidLinks(playlist);
    playlist.moveToPosition(nodeAt(playlist, 4), 1);
    expect(titlesOf(playlist)).toEqual(["D", "B", "C", "A"]);
    expectValidLinks(playlist);
  });

  it("moves to the first and to the last position", () => {
    const playlist = playlistOf(a, b, c);
    playlist.moveToPosition(nodeAt(playlist, 2), 3);
    expect(playlist.tail?.value).toBe(b);
    playlist.moveToPosition(nodeAt(playlist, 2), 1);
    expect(playlist.head?.value).toBe(c);
    expect(titlesOf(playlist)).toEqual(["C", "A", "B"]);
    expectValidLinks(playlist);
  });

  it("does nothing and records nothing when the position is the same", () => {
    const playlist = playlistOf(a, b, c);
    playlist.moveToPosition(nodeAt(playlist, 2), 2);
    expect(titlesOf(playlist)).toEqual(["A", "B", "C"]);
    expect(playlist.history).toHaveLength(3);
  });

  it("keeps the current node on the same node", () => {
    const playlist = playlistOf(a, b, c);
    const current = nodeAt(playlist, 1);
    playlist.select(current);
    playlist.moveToPosition(current, 3);
    expect(playlist.current).toBe(current);
    expect(playlist.positionOf(current)).toBe(3);
    expect(playlist.previous()?.value).toBe(c);
  });

  it("records the move in the history", () => {
    const playlist = playlistOf(a, b, c);
    playlist.moveToPosition(nodeAt(playlist, 3), 1);
    expect(playlist.lastOperation).toMatchObject({ type: "move", index: 0, valueLabel: "C", nextLabel: "A" });
  });

  it("rejects positions out of range or not integers", () => {
    const playlist = playlistOf(a, b, c);
    const node = nodeAt(playlist, 2);
    for (const position of [0, 4, -1, 1.5, Number.NaN]) {
      expect(() => playlist.moveToPosition(node, position)).toThrow(RangeError);
    }
    expect(titlesOf(playlist)).toEqual(["A", "B", "C"]);
    expectValidLinks(playlist);
  });

  it("rejects a node from another playlist", () => {
    const playlist = playlistOf(a, b);
    expect(() => playlist.moveToPosition(nodeAt(playlistOf(c, a), 2), 1)).toThrow(Error);
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

function availableSong(title: string): Song {
  const song = songNamed(title);
  song.attachFile({ file: new File(["audio"], `${title}.mp3`), cover: null, coverType: null, lyricsFile: null, embeddedLyrics: null });
  return song;
}

describe("Playlist findAvailable", () => {
  const first = availableSong("P1");
  const missing = songNamed("P2");
  const third = availableSong("P3");
  const alsoMissing = songNamed("P4");

  it("skips unavailable songs in both directions", () => {
    const playlist = playlistOf(first, missing, third);
    playlist.select(nodeAt(playlist, 1));
    expect(playlist.findAvailable("next", false)?.value).toBe(third);
    playlist.select(nodeAt(playlist, 3));
    expect(playlist.findAvailable("previous", false)?.value).toBe(first);
  });

  it("returns null at the ends without wrapping", () => {
    const playlist = playlistOf(first, missing, third, alsoMissing);
    playlist.select(nodeAt(playlist, 3));
    expect(playlist.findAvailable("next", false)).toBeNull();
    playlist.select(nodeAt(playlist, 1));
    expect(playlist.findAvailable("previous", false)).toBeNull();
  });

  it("wraps around skipping unavailable songs", () => {
    const playlist = playlistOf(first, missing, third, alsoMissing);
    playlist.select(nodeAt(playlist, 3));
    expect(playlist.findAvailable("next", true)?.value).toBe(first);
    playlist.select(nodeAt(playlist, 1));
    expect(playlist.findAvailable("previous", true)?.value).toBe(third);
  });

  it("returns null when no other song is available and no wrap", () => {
    const playlist = playlistOf(missing, alsoMissing, first);
    playlist.select(nodeAt(playlist, 3));
    expect(playlist.findAvailable("next", false)).toBeNull();
    expect(playlist.findAvailable("previous", false)).toBeNull();
  });

  it("finishes after one cycle when nothing is available", () => {
    const playlist = playlistOf(missing, alsoMissing);
    playlist.select(nodeAt(playlist, 1));
    expect(playlist.findAvailable("next", true)).toBeNull();
    expect(playlist.findAvailable("previous", true)).toBeNull();
  });

  it("lands on the current song when it is the only available one and wrapping", () => {
    const playlist = playlistOf(missing, first, alsoMissing);
    const current = nodeAt(playlist, 2);
    playlist.select(current);
    expect(playlist.findAvailable("next", true)).toBe(current);
  });

  it("returns null without a current node", () => {
    expect(playlistOf(first, third).findAvailable("next", true)).toBeNull();
  });

  it("does not change the current node or the history", () => {
    const playlist = playlistOf(first, missing, third);
    const current = nodeAt(playlist, 1);
    playlist.select(current);
    const operations = playlist.history.length;
    playlist.findAvailable("next", true);
    expect(playlist.current).toBe(current);
    expect(playlist.history).toHaveLength(operations);
  });
});

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

function expectBackwardIsReverse(playlist: Playlist): void {
  const forward = [...playlist.nodes()];
  const backward: Node<Song>[] = [];
  for (let node = playlist.tail; node !== null; node = node.prev) {
    backward.push(node);
  }
  expect(backward).toEqual([...forward].reverse());
  expect(playlist.head?.prev ?? null).toBeNull();
  expect(playlist.tail?.next ?? null).toBeNull();
}

describe("Playlist shuffle", () => {
  const e = songNamed("E");
  const f = songNamed("F");

  it("keeps the same songs and length with valid links for any random source", () => {
    for (const random of [() => 0, () => 0.999, sequence(0.3, 0.7, 0.1, 0.9), Math.random]) {
      const playlist = playlistOf(a, b, c, d, e, f);
      playlist.shuffle(random);
      expect(playlist.length).toBe(6);
      expect(titlesOf(playlist).sort()).toEqual(["A", "B", "C", "D", "E", "F"]);
      expectValidLinks(playlist);
      expectBackwardIsReverse(playlist);
    }
  });

  it("is deterministic: random always 0 reverses the list", () => {
    const playlist = playlistOf(a, b, c, d);
    playlist.shuffle(() => 0);
    expect(titlesOf(playlist)).toEqual(["D", "C", "B", "A"]);
  });

  it("random picking the last index leaves the order untouched and records no moves", () => {
    const playlist = playlistOf(a, b, c);
    const operations = playlist.history.length;
    playlist.shuffle(() => 0.999);
    expect(titlesOf(playlist)).toEqual(["A", "B", "C"]);
    expect(playlist.history).toHaveLength(operations);
  });

  it("follows the Fisher–Yates steps with the given picks", () => {
    const playlist = playlistOf(a, b, c, d);
    const operations = playlist.history.length;
    playlist.shuffle(sequence(0.5, 0.1, 0.9));
    expect(titlesOf(playlist)).toEqual(["B", "D", "A", "C"]);
    expect(playlist.history).toHaveLength(operations + 2);
    expectValidLinks(playlist);
  });

  it("only uses move operations on the nodes already in the list", () => {
    const playlist = playlistOf(a, b, c, d, e);
    const nodes = new Set(playlist.nodes());
    const operations = playlist.history.length;
    playlist.shuffle(sequence(0.2, 0.6, 0.4, 0.8));
    expect(new Set(playlist.nodes())).toEqual(nodes);
    expect(playlist.history.slice(operations).every((operation) => operation.type === "move")).toBe(true);
  });

  it("handles empty and single-song lists", () => {
    const empty = playlistOf();
    empty.shuffle();
    expect(empty.length).toBe(0);
    const single = playlistOf(a);
    single.shuffle();
    expect(titlesOf(single)).toEqual(["A"]);
  });

  it("keeps the current node", () => {
    const playlist = playlistOf(a, b, c, d);
    const current = nodeAt(playlist, 2);
    playlist.select(current);
    playlist.shuffle(() => 0);
    expect(playlist.current).toBe(current);
  });
});

describe("Playlist shuffledCopy", () => {
  it("leaves the original untouched and creates new nodes", () => {
    const original = playlistOf(a, b, c, d);
    const current = nodeAt(original, 3);
    original.select(current);
    const nodes = [...original.nodes()];
    const operations = original.history.length;
    const copy = original.shuffledCopy(() => 0, current);
    expect(titlesOf(original)).toEqual(["A", "B", "C", "D"]);
    expect(original.current).toBe(current);
    expect(original.history).toHaveLength(operations);
    expect([...original.nodes()]).toEqual(nodes);
    expect([...copy.nodes()].some((node) => nodes.includes(node))).toBe(false);
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe(original.name);
    expect(copy.isLibrary).toBe(false);
  });

  it("puts the anchor song at the head and selects it", () => {
    const original = playlistOf(a, b, c, d);
    const copy = original.shuffledCopy(sequence(0.3, 0.8, 0.1), nodeAt(original, 3));
    expect(copy.head?.value).toBe(c);
    expect(copy.current).toBe(copy.head);
    expect(copy.length).toBe(4);
    expect(titlesOf(copy).sort()).toEqual(["A", "B", "C", "D"]);
    expectValidLinks(copy);
    expectBackwardIsReverse(copy);
  });

  it("has no current when there is no anchor", () => {
    const original = playlistOf(a, b, c);
    expect(original.shuffledCopy(() => 0, null).current).toBeNull();
  });

  it("anchors the exact node when a song appears twice", () => {
    const original = playlistOf(a, b, a, c);
    const second = nodeAt(original, 3);
    const copy = original.shuffledCopy(sequence(0.4, 0.2, 0.9), second);
    const start = copy.head;
    expect(start).not.toBeNull();
    expect(start === null ? null : copy.originOf(start)).toBe(second);
  });

  it("maps every copy node back to its original node", () => {
    const original = playlistOf(a, b, c, d);
    const originals = new Set(original.nodes());
    const copy = original.shuffledCopy(sequence(0.1, 0.9, 0.5), null);
    for (const node of copy.nodes()) {
      const origin = copy.originOf(node);
      expect(origin).not.toBeNull();
      expect(origin === null ? null : originals.has(origin)).toBe(true);
      expect(origin?.value).toBe(node.value);
    }
    expect(original.originOf(nodeAt(original, 1))).toBeNull();
  });

  it("is a playlist whose navigation follows the shuffled links", () => {
    const original = playlistOf(a, b, c);
    const copy = original.shuffledCopy(() => 0, nodeAt(original, 2));
    expect(copy.current?.value).toBe(b);
    const seen = [copy.current?.value.title, copy.next()?.value.title, copy.next()?.value.title];
    expect(seen).toEqual(["B", ...titlesOf(copy).slice(1)]);
    expect(copy.next()).toBeNull();
  });
});
