import { Node } from "./Node";
import type { LinkedList } from "./LinkedList";

export class DoublyLinkedList<T> implements LinkedList<T> {
  #head: Node<T> | null = null;
  #tail: Node<T> | null = null;
  #length = 0;

  get head(): Node<T> | null {
    return this.#head;
  }

  get tail(): Node<T> | null {
    return this.#tail;
  }

  get length(): number {
    return this.#length;
  }

  append(value: T): Node<T> {
    const node = new Node(value);
    this.linkAtTail(node);
    this.#length++;
    return node;
  }

  prepend(value: T): Node<T> {
    const node = new Node(value);
    this.linkAtHead(node);
    this.#length++;
    return node;
  }

  insert(index: number, value: T): Node<T> {
    this.assertIndex(index, this.#length);
    const node = new Node(value);
    this.linkAt(index, node);
    this.#length++;
    return node;
  }

  remove(index: number): T {
    return this.removeNode(this.traverseToIndex(index));
  }

  removeNode(node: Node<T>): T {
    this.assertBelongsAtEnds(node);
    this.unlink(node);
    this.detach(node);
    this.#length--;
    return node.value;
  }

  moveNode(node: Node<T>, toIndex: number): void {
    this.assertBelongsAtEnds(node);
    this.assertIndex(toIndex, this.#length - 1);
    this.unlink(node);
    this.detach(node);
    this.#length--;
    this.linkAt(toIndex, node);
    this.#length++;
  }

  traverseToIndex(index: number): Node<T> {
    this.assertIndex(index, this.#length - 1);
    return index < this.#length / 2 ? this.walkFromHead(index) : this.walkFromTail(index);
  }

  indexOf(node: Node<T>): number {
    let index = 0;
    for (const current of this.forward()) {
      if (current === node) {
        return index;
      }
      index++;
    }
    return -1;
  }

  find(predicate: (value: T) => boolean): Node<T> | null {
    for (const node of this.forward()) {
      if (predicate(node.value)) {
        return node;
      }
    }
    return null;
  }

  *forward(): Generator<Node<T>, void, undefined> {
    let node = this.#head;
    while (node !== null) {
      const following = node.next;
      yield node;
      node = following;
    }
  }

  *backward(): Generator<Node<T>, void, undefined> {
    let node = this.#tail;
    while (node !== null) {
      const preceding = node.prev;
      yield node;
      node = preceding;
    }
  }

  isEmpty(): boolean {
    return this.#length === 0;
  }

  clear(): void {
    for (const node of this.forward()) {
      this.detach(node);
    }
    this.#head = null;
    this.#tail = null;
    this.#length = 0;
  }

  private linkAt(index: number, node: Node<T>): void {
    if (index === 0) {
      this.linkAtHead(node);
    } else if (index === this.#length) {
      this.linkAtTail(node);
    } else {
      this.linkAfter(this.traverseToIndex(index - 1), node);
    }
  }

  private linkAtHead(node: Node<T>): void {
    if (this.#head === null) {
      this.#tail = node;
    } else {
      node.next = this.#head;
      this.#head.prev = node;
    }
    this.#head = node;
  }

  private linkAtTail(node: Node<T>): void {
    if (this.#tail === null) {
      this.#head = node;
    } else {
      node.prev = this.#tail;
      this.#tail.next = node;
    }
    this.#tail = node;
  }

  private linkAfter(leader: Node<T>, node: Node<T>): void {
    const follower = leader.next;
    leader.next = node;
    node.prev = leader;
    node.next = follower;
    if (follower !== null) {
      follower.prev = node;
    }
  }

  private unlink(node: Node<T>): void {
    if (node.prev === null) {
      this.#head = node.next;
    } else {
      node.prev.next = node.next;
    }
    if (node.next === null) {
      this.#tail = node.prev;
    } else {
      node.next.prev = node.prev;
    }
  }

  private detach(node: Node<T>): void {
    node.next = null;
    node.prev = null;
  }

  private walkFromHead(index: number): Node<T> {
    let node = this.requireNode(this.#head);
    for (let position = 0; position < index; position++) {
      node = this.requireNode(node.next);
    }
    return node;
  }

  private walkFromTail(index: number): Node<T> {
    let node = this.requireNode(this.#tail);
    for (let position = this.#length - 1; position > index; position--) {
      node = this.requireNode(node.prev);
    }
    return node;
  }

  private requireNode(node: Node<T> | null): Node<T> {
    if (node === null) {
      throw new Error("Broken list: a link ended before the expected position");
    }
    return node;
  }

  private assertIndex(index: number, maxIndex: number): void {
    if (!Number.isInteger(index) || index < 0 || index > maxIndex) {
      throw new RangeError(`Index ${index} is out of range for a list of length ${this.#length}`);
    }
  }

  private assertBelongsAtEnds(node: Node<T>): void {
    if (node.prev === null && node !== this.#head) {
      throw new Error("Node does not belong to this list: it has no previous node but is not the head");
    }
    if (node.next === null && node !== this.#tail) {
      throw new Error("Node does not belong to this list: it has no next node but is not the tail");
    }
  }
}
