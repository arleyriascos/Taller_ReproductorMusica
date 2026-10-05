import type { Node } from "./Node";

export interface LinkedList<T> {
  readonly head: Node<T> | null;
  readonly tail: Node<T> | null;
  readonly length: number;
  append(value: T): Node<T>;
  prepend(value: T): Node<T>;
  insert(index: number, value: T): Node<T>;
  remove(index: number): T;
  removeNode(node: Node<T>): T;
  moveNode(node: Node<T>, toIndex: number): void;
  traverseToIndex(index: number): Node<T>;
  indexOf(node: Node<T>): number;
  find(predicate: (value: T) => boolean): Node<T> | null;
  forward(): Generator<Node<T>, void, undefined>;
  backward(): Generator<Node<T>, void, undefined>;
  isEmpty(): boolean;
  clear(): void;
}
