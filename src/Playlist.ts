import { DoublyLinkedList } from "./DoublyLinkedList";
import type { LinkedList } from "./LinkedList";
import type { Node } from "./Node";
import type { Song } from "./Song";
import { TrackedLinkedList } from "./TrackedLinkedList";
import type { ListOperation, TraversalDirection } from "./types";

export class Playlist {
  readonly id: string;
  readonly isLibrary: boolean;
  #name: string;
  #songs: TrackedLinkedList<Song> = Playlist.track(new DoublyLinkedList<Song>());
  #current: Node<Song> | null = null;
  #origins: WeakMap<Node<Song>, Node<Song>> | null = null;

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

  get head(): Node<Song> | null {
    return this.#songs.head;
  }

  get tail(): Node<Song> | null {
    return this.#songs.tail;
  }

  get history(): readonly ListOperation<Song>[] {
    return this.#songs.history;
  }

  get lastOperation(): ListOperation<Song> | null {
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

  moveToPosition(node: Node<Song>, position: number): void {
    const index = this.requireIndex(node);
    this.assertPosition(position, this.length);
    if (position - 1 !== index) {
      this.#songs.moveNode(node, position - 1);
    }
  }

  moveUp(node: Node<Song>): void {
    if (node.prev !== null) {
      this.moveToPosition(node, this.positionOf(node) - 1);
    }
  }

  moveDown(node: Node<Song>): void {
    if (node.next !== null) {
      this.moveToPosition(node, this.positionOf(node) + 1);
    }
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
    this.requireIndex(node);
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

  findAvailable(direction: TraversalDirection, wrap: boolean): Node<Song> | null {
    let node = this.#current;
    for (let step = 0; node !== null && step < this.length; step++) {
      node = this.neighborOf(node, direction, wrap);
      if (node?.value.isAvailable()) {
        return node;
      }
    }
    return null;
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

  shuffle(random: () => number = Math.random): void {
    for (let last = this.length - 1; last >= 1; last--) {
      const pick = Math.min(Math.floor(random() * (last + 1)), last);
      if (pick !== last) {
        this.#songs.moveNode(this.#songs.traverseToIndex(pick), last);
      }
    }
  }

  shuffledCopy(random: () => number, anchor: Node<Song> | null): Playlist {
    const copy = this.clone(this.#name);
    const start = this.linkOrigins(copy, anchor);
    copy.shuffle(random);
    if (start !== null) {
      copy.moveToPosition(start, 1);
      copy.select(start);
    }
    return copy;
  }

  originOf(node: Node<Song>): Node<Song> | null {
    return this.#origins?.get(node) ?? null;
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

  private linkOrigins(copy: Playlist, anchor: Node<Song> | null): Node<Song> | null {
    const origins = new WeakMap<Node<Song>, Node<Song>>();
    let start: Node<Song> | null = null;
    let original = this.head;
    let twin = copy.head;
    while (original !== null && twin !== null) {
      origins.set(twin, original);
      start = original === anchor ? twin : start;
      original = original.next;
      twin = twin.next;
    }
    copy.#origins = origins;
    return start;
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

  private requireIndex(node: Node<Song>): number {
    const index = this.#songs.indexOf(node);
    if (index === -1) {
      throw new Error("Node does not belong to this playlist");
    }
    return index;
  }

  private neighborOf(node: Node<Song>, direction: TraversalDirection, wrap: boolean): Node<Song> | null {
    if (direction === "next") {
      return node.next ?? (wrap ? this.#songs.head : null);
    }
    return node.prev ?? (wrap ? this.#songs.tail : null);
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
