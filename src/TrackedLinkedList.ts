import type { Node } from "./Node";
import type { LinkedList } from "./LinkedList";
import type { ListOperation, ListOperationType } from "./types";

const HISTORY_LIMIT = 20;

export class TrackedLinkedList<T> implements LinkedList<T> {
  readonly #inner: LinkedList<T>;
  readonly #describe: (value: T) => string;
  readonly #history: ListOperation[] = [];

  constructor(inner: LinkedList<T>, describe: (value: T) => string) {
    this.#inner = inner;
    this.#describe = describe;
  }

  get head(): Node<T> | null {
    return this.#inner.head;
  }

  get tail(): Node<T> | null {
    return this.#inner.tail;
  }

  get length(): number {
    return this.#inner.length;
  }

  get history(): readonly ListOperation[] {
    return this.#history;
  }

  get lastOperation(): ListOperation | null {
    return this.#history.at(-1) ?? null;
  }

  append(value: T): Node<T> {
    const node = this.#inner.append(value);
    return this.recordInsertion("append", this.#inner.length - 1, node);
  }

  prepend(value: T): Node<T> {
    const node = this.#inner.prepend(value);
    return this.recordInsertion("prepend", 0, node);
  }

  insert(index: number, value: T): Node<T> {
    const node = this.#inner.insert(index, value);
    return this.recordInsertion("insert", index, node);
  }

  remove(index: number): T {
    const node = this.#inner.traverseToIndex(index);
    return this.removeAndRecord("remove", index, node, () => this.#inner.remove(index));
  }

  removeNode(node: Node<T>): T {
    return this.removeAndRecord("removeNode", null, node, () => this.#inner.removeNode(node));
  }

  traverseToIndex(index: number): Node<T> {
    return this.#inner.traverseToIndex(index);
  }

  indexOf(node: Node<T>): number {
    return this.#inner.indexOf(node);
  }

  find(predicate: (value: T) => boolean): Node<T> | null {
    return this.#inner.find(predicate);
  }

  forward(): Generator<Node<T>, void, undefined> {
    return this.#inner.forward();
  }

  backward(): Generator<Node<T>, void, undefined> {
    return this.#inner.backward();
  }

  isEmpty(): boolean {
    return this.#inner.isEmpty();
  }

  clear(): void {
    this.#inner.clear();
    this.record("clear", null, null, null, null);
  }

  private recordInsertion(type: ListOperationType, index: number, node: Node<T>): Node<T> {
    this.record(type, index, this.#describe(node.value), this.labelOf(node.prev), this.labelOf(node.next));
    return node;
  }

  private removeAndRecord(type: ListOperationType, index: number | null, node: Node<T>, removal: () => T): T {
    const previous = node.prev;
    const following = node.next;
    const value = removal();
    this.record(type, index, this.#describe(value), this.labelOf(previous), this.labelOf(following));
    return value;
  }

  private labelOf(node: Node<T> | null): string | null {
    return node === null ? null : this.#describe(node.value);
  }

  private record(
    type: ListOperationType,
    index: number | null,
    valueLabel: string | null,
    previousLabel: string | null,
    nextLabel: string | null,
  ): void {
    this.#history.push({ type, index, valueLabel, previousLabel, nextLabel, timestamp: Date.now() });
    if (this.#history.length > HISTORY_LIMIT) {
      this.#history.shift();
    }
  }
}
