import { DoublyLinkedList } from "./DoublyLinkedList";
import type { LinkedList } from "./LinkedList";
import type { Node } from "./Node";
import type { Song } from "./Song";
import { TrackedLinkedList } from "./TrackedLinkedList";
import type { ListOperation } from "./types";

export class Playlist {
  readonly id: string;
  readonly isLibrary: boolean;
  #name: string;
  #songs: TrackedLinkedList<Song> = Playlist.track(new DoublyLinkedList<Song>());
  #current: Node<Song> | null = null;

  constructor(name: string, isLibrary = false, id: string = crypto.randomUUID()) {
    this.id = id;
    this.isLibrary = isLibrary;
    this.#name = name;
  }

  get name(): string {
    return this.#name;
  }

  get current(): Node<Song> | null {
    return this.#current;
  }

  get length(): number {
    return this.#songs.length;
  }

  get history(): readonly ListOperation[] {
    return this.#songs.history;
  }

  get lastOperation(): ListOperation | null {
    return this.#songs.lastOperation;
  }

  rename(name: string): void {
    this.#name = name;
  }

  addAtStart(song: Song): Node<Song> {
    return this.#songs.prepend(song);
  }

  addAtEnd(song: Song): Node<Song> {
    return this.#songs.append(song);
  }

  addAtPosition(song: Song, position: number): Node<Song> {
    this.assertPosition(position, this.length + 1);
    return this.#songs.insert(position - 1, song);
  }

  removeAtPosition(position: number): Song {
    this.assertPosition(position, this.length);
    const index = position - 1;
    const node = this.#songs.traverseToIndex(index);
    return this.removeKeepingCurrent(node, () => this.#songs.remove(index));
  }

  removeNode(node: Node<Song>): Song {
    return this.removeKeepingCurrent(node, () => this.#songs.removeNode(node));
  }

  removeAllOf(song: Song): number {
    let removed = 0;
    let node = this.#songs.head;
    while (node !== null) {
      const following = node.next;
      if (node.value === song) {
        this.removeNode(node);
        removed++;
      }
      node = following;
    }
    return removed;
  }

  select(node: Node<Song>): void {
    if (this.#songs.indexOf(node) === -1) {
      throw new Error("Node does not belong to this playlist");
    }
    this.#current = node;
  }

  next(): Node<Song> | null {
    return this.moveTo(this.#current?.next ?? null);
  }

  previous(): Node<Song> | null {
    return this.moveTo(this.#current?.prev ?? null);
  }

  selectFirst(): Node<Song> | null {
    return this.moveTo(this.#songs.head);
  }

  selectLast(): Node<Song> | null {
    return this.moveTo(this.#songs.tail);
  }

  hasNext(): boolean {
    return (this.#current?.next ?? null) !== null;
  }

  hasPrevious(): boolean {
    return (this.#current?.prev ?? null) !== null;
  }

  nodes(): Generator<Node<Song>, void, undefined> {
    return this.#songs.forward();
  }

  positionOf(node: Node<Song>): number {
    return this.#songs.indexOf(node) + 1;
  }

  contains(song: Song): boolean {
    return this.#songs.find((value) => value === song) !== null;
  }

  totalDuration(): number {
    let total = 0;
    for (const node of this.nodes()) {
      total += node.value.duration;
    }
    return total;
  }

  clone(name: string): Playlist {
    const copy = new Playlist(name);
    const songs = new DoublyLinkedList<Song>();
    for (const node of this.nodes()) {
      songs.append(node.value);
    }
    copy.#songs = Playlist.track(songs);
    return copy;
  }

  private removeKeepingCurrent(node: Node<Song>, removal: () => Song): Song {
    const wasCurrent = node === this.#current;
    const replacement = node.next ?? node.prev;
    const song = removal();
    if (wasCurrent) {
      this.#current = replacement;
    }
    return song;
  }

  private moveTo(target: Node<Song> | null): Node<Song> | null {
    if (target === null) {
      return null;
    }
    this.#current = target;
    return target;
  }

  private assertPosition(position: number, maxPosition: number): void {
    if (!Number.isInteger(position) || position < 1 || position > maxPosition) {
      throw new RangeError(`Position ${position} is out of range 1..${maxPosition}`);
    }
  }

  private static track(list: LinkedList<Song>): TrackedLinkedList<Song> {
    return new TrackedLinkedList(list, (song) => song.title);
  }
}
