import { describe, it, expect } from "vitest";
import { DoublyLinkedList } from "./DoublyLinkedList";
import type { LinkedList } from "./LinkedList";
import type { Node } from "./Node";
import { TrackedLinkedList } from "./TrackedLinkedList";

function expectValidList<T>(list: LinkedList<T>, expected: T[]): void {
  const forwardNodes = [...list.forward()];
  const backwardNodes = [...list.backward()];
  expect(list.length).toBe(forwardNodes.length);
  expect(backwardNodes).toEqual([...forwardNodes].reverse());
  expect(forwardNodes.map((node) => node.value)).toEqual(expected);
  if (list.length === 0) {
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
    return;
  }
  expect(list.head?.prev).toBeNull();
  expect(list.tail?.next).toBeNull();
  for (const node of forwardNodes) {
    if (node.next !== null) {
      expect(node.next.prev).toBe(node);
    }
  }
}

function trackedOf(...values: string[]): { inner: DoublyLinkedList<string>; list: TrackedLinkedList<string> } {
  const inner = new DoublyLinkedList<string>();
  for (const value of values) {
    inner.append(value);
  }
  return { inner, list: new TrackedLinkedList(inner, (value) => value.toUpperCase()) };
}

function nodeAt<T>(list: LinkedList<T>, index: number): Node<T> {
  return list.traverseToIndex(index);
}

describe("TrackedLinkedList delegation", () => {
  it("exposes head, tail and length of the inner list", () => {
    const { inner, list } = trackedOf("a", "b", "c");
    expect(list.head).toBe(inner.head);
    expect(list.tail).toBe(inner.tail);
    expect(list.length).toBe(3);
    expect(list.isEmpty()).toBe(false);
    expectValidList(list, ["a", "b", "c"]);
  });

  it("delegates queries and returns the inner results", () => {
    const { inner, list } = trackedOf("a", "b", "c");
    const middle = inner.traverseToIndex(1);
    expect(list.traverseToIndex(1)).toBe(middle);
    expect(list.indexOf(middle)).toBe(1);
    expect(list.find((value) => value === "c")).toBe(inner.tail);
    expect([...list.backward()].map((node) => node.value)).toEqual(["c", "b", "a"]);
    expect(list.history).toEqual([]);
    expect(list.lastOperation).toBeNull();
  });

  it("mutations change the inner list and return its results", () => {
    const { inner, list } = trackedOf("a", "c");
    const node = list.insert(1, "b");
    expect(inner.traverseToIndex(1)).toBe(node);
    expect(list.remove(0)).toBe("a");
    expectValidList(inner, ["b", "c"]);
    expectValidList(list, ["b", "c"]);
  });
});

describe("TrackedLinkedList recording", () => {
  it("records append with index length - 1 and its previous neighbor", () => {
    const { list } = trackedOf("a");
    const previous = nodeAt(list, 0);
    const node = list.append("b");
    expect(list.lastOperation).toMatchObject({
      type: "append",
      index: 1,
      valueLabel: "B",
      previousLabel: "A",
      nextLabel: null,
    });
    expect(list.lastOperation?.previousNode).toBe(previous);
    expect(list.lastOperation?.node).toBe(node);
    expect(list.lastOperation?.nextNode).toBeNull();
    expect(previous.next).toBe(node);
    expectValidList(list, ["a", "b"]);
  });

  it("records append on an empty list with no neighbors", () => {
    const { list } = trackedOf();
    const node = list.append("a");
    expect(list.lastOperation).toMatchObject({ type: "append", index: 0, previousLabel: null, nextLabel: null });
    expect(list.lastOperation).toMatchObject({ previousNode: null, nextNode: null });
    expect(list.lastOperation?.node).toBe(node);
    expectValidList(list, ["a"]);
  });

  it("records prepend with index 0 and its next neighbor", () => {
    const { list } = trackedOf("b");
    const following = nodeAt(list, 0);
    const node = list.prepend("a");
    expect(list.lastOperation).toMatchObject({
      type: "prepend",
      index: 0,
      valueLabel: "A",
      previousLabel: null,
      nextLabel: "B",
    });
    expect(list.lastOperation?.previousNode).toBeNull();
    expect(list.lastOperation?.node).toBe(node);
    expect(list.lastOperation?.nextNode).toBe(following);
    expect(following.prev).toBe(node);
    expectValidList(list, ["a", "b"]);
  });

  it("records insert in the middle with both neighbors", () => {
    const { list } = trackedOf("a", "c");
    const previous = nodeAt(list, 0);
    const following = nodeAt(list, 1);
    const node = list.insert(1, "b");
    expect(list.lastOperation).toMatchObject({
      type: "insert",
      index: 1,
      valueLabel: "B",
      previousLabel: "A",
      nextLabel: "C",
    });
    expect(list.lastOperation?.previousNode).toBe(previous);
    expect(list.lastOperation?.node).toBe(node);
    expect(list.lastOperation?.nextNode).toBe(following);
    expect(previous.next).toBe(node);
    expect(following.prev).toBe(node);
    expectValidList(list, ["a", "b", "c"]);
  });

  it("records remove with the neighbors that become linked", () => {
    const { list } = trackedOf("a", "b", "c");
    const previous = nodeAt(list, 0);
    const following = nodeAt(list, 2);
    list.remove(1);
    expect(list.lastOperation).toMatchObject({
      type: "remove",
      index: 1,
      valueLabel: "B",
      previousLabel: "A",
      nextLabel: "C",
    });
    expect(list.lastOperation?.previousNode).toBe(previous);
    expect(list.lastOperation?.node).toBeNull();
    expect(list.lastOperation?.nextNode).toBe(following);
    expect(previous.next).toBe(following);
    expectValidList(list, ["a", "c"]);
  });

  it("records remove of the head with no previous neighbor", () => {
    const { list } = trackedOf("a", "b");
    const following = nodeAt(list, 1);
    list.remove(0);
    expect(list.lastOperation).toMatchObject({ type: "remove", index: 0, previousLabel: null, nextLabel: "B" });
    expect(list.lastOperation).toMatchObject({ previousNode: null, node: null });
    expect(list.lastOperation?.nextNode).toBe(following);
    expect(list.head).toBe(following);
    expectValidList(list, ["b"]);
  });

  it("records removeNode in the middle with index null and both neighbors", () => {
    const { inner, list } = trackedOf("a", "b", "c");
    const previous = nodeAt(list, 0);
    const following = nodeAt(list, 2);
    list.removeNode(inner.traverseToIndex(1));
    expect(list.lastOperation).toMatchObject({
      type: "removeNode",
      index: null,
      valueLabel: "B",
      previousLabel: "A",
      nextLabel: "C",
    });
    expect(list.lastOperation?.previousNode).toBe(previous);
    expect(list.lastOperation?.node).toBeNull();
    expect(list.lastOperation?.nextNode).toBe(following);
    expect(following.prev).toBe(previous);
    expectValidList(list, ["a", "c"]);
  });

  it("records removeNode of the head with no previous neighbor", () => {
    const { list } = trackedOf("a", "b", "c");
    const following = nodeAt(list, 1);
    list.removeNode(nodeAt(list, 0));
    expect(list.lastOperation).toMatchObject({ type: "removeNode", index: null, valueLabel: "A", previousLabel: null, nextLabel: "B" });
    expect(list.lastOperation).toMatchObject({ previousNode: null, node: null });
    expect(list.lastOperation?.nextNode).toBe(following);
    expect(list.head).toBe(following);
    expectValidList(list, ["b", "c"]);
  });

  it("records removeNode of the tail with no next neighbor", () => {
    const { inner, list } = trackedOf("a", "b");
    const tail = inner.tail;
    if (tail === null) {
      throw new Error("Expected a tail");
    }
    const previous = nodeAt(list, 0);
    list.removeNode(tail);
    expect(list.lastOperation).toMatchObject({ type: "removeNode", index: null, previousLabel: "A", nextLabel: null });
    expect(list.lastOperation?.previousNode).toBe(previous);
    expect(list.lastOperation).toMatchObject({ node: null, nextNode: null });
    expect(list.tail).toBe(previous);
    expectValidList(list, ["a"]);
  });

  it("records removeNode of the only node with no neighbors", () => {
    const { list } = trackedOf("a");
    list.removeNode(nodeAt(list, 0));
    expect(list.lastOperation).toMatchObject({
      type: "removeNode",
      index: null,
      valueLabel: "A",
      previousLabel: null,
      nextLabel: null,
      previousNode: null,
      node: null,
      nextNode: null,
    });
    expectValidList(list, []);
  });

  it("records clear with index null and no labels", () => {
    const { list } = trackedOf("a", "b");
    list.clear();
    expect(list.lastOperation).toMatchObject({
      type: "clear",
      index: null,
      valueLabel: null,
      previousLabel: null,
      nextLabel: null,
      previousNode: null,
      node: null,
      nextNode: null,
    });
    expectValidList(list, []);
  });

  it("stores a numeric timestamp", () => {
    const { list } = trackedOf();
    const before = Date.now();
    list.append("a");
    const timestamp = list.lastOperation?.timestamp ?? 0;
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  });

  it("keeps the node references of every operation in the history", () => {
    const { list } = trackedOf();
    const first = list.append("a");
    const last = list.append("c");
    const middle = list.insert(1, "b");
    const [append, , insert] = list.history;
    expect(append.node).toBe(first);
    expect(insert.previousNode).toBe(first);
    expect(insert.node).toBe(middle);
    expect(insert.nextNode).toBe(last);
    expectValidList(list, ["a", "b", "c"]);
  });

  it("keeps operations oldest first", () => {
    const { list } = trackedOf();
    list.append("a");
    list.prepend("b");
    list.remove(0);
    expect(list.history.map((operation) => operation.type)).toEqual(["append", "prepend", "remove"]);
    expectValidList(list, ["a"]);
  });
});

describe("TrackedLinkedList failures", () => {
  it("records nothing when insert fails", () => {
    const { list } = trackedOf("a");
    expect(() => list.insert(5, "x")).toThrow(RangeError);
    expect(list.history).toEqual([]);
    expectValidList(list, ["a"]);
  });

  it("records nothing when remove fails", () => {
    const { list } = trackedOf("a");
    expect(() => list.remove(1)).toThrow(RangeError);
    expect(() => trackedOf().list.remove(0)).toThrow(RangeError);
    expect(list.history).toEqual([]);
    expectValidList(list, ["a"]);
  });

  it("records nothing when removeNode receives a foreign node", () => {
    const { list } = trackedOf("a", "b");
    const foreign = trackedOf("x").inner.head;
    if (foreign === null) {
      throw new Error("Expected a head");
    }
    expect(() => list.removeNode(foreign)).toThrow(Error);
    expect(list.history).toEqual([]);
    expectValidList(list, ["a", "b"]);
  });
});

describe("TrackedLinkedList move", () => {
  it("records move with the destination index, the moved node and its new neighbors", () => {
    const { inner, list } = trackedOf("a", "b", "c", "d");
    const moved = nodeAt(list, 0);
    list.moveNode(moved, 2);
    expect(list.lastOperation).toMatchObject({ type: "move", index: 2, valueLabel: "A", previousLabel: "C", nextLabel: "D" });
    expect(list.lastOperation?.previousNode).toBe(nodeAt(list, 1));
    expect(list.lastOperation?.node).toBe(moved);
    expect(list.lastOperation?.nextNode).toBe(nodeAt(list, 3));
    expectValidList(inner, ["b", "c", "a", "d"]);
    expectValidList(list, ["b", "c", "a", "d"]);
  });

  it("records the head and tail cases with a null neighbor", () => {
    const { list } = trackedOf("a", "b", "c");
    list.moveNode(nodeAt(list, 2), 0);
    expect(list.lastOperation).toMatchObject({ type: "move", index: 0, previousLabel: null, nextLabel: "A" });
    list.moveNode(nodeAt(list, 0), 2);
    expect(list.lastOperation).toMatchObject({ type: "move", index: 2, previousLabel: "B", nextLabel: null });
    expect(list.lastOperation?.nextNode).toBeNull();
    expectValidList(list, ["a", "b", "c"]);
  });

  it("records nothing and keeps the list when the index is invalid", () => {
    const { list } = trackedOf("a", "b");
    expect(() => list.moveNode(nodeAt(list, 0), 2)).toThrow(RangeError);
    expect(list.history).toEqual([]);
    expectValidList(list, ["a", "b"]);
  });
});

describe("TrackedLinkedList history limit", () => {
  it("keeps only the last 20 operations", () => {
    const { list } = trackedOf();
    for (let count = 0; count < 25; count++) {
      list.append(`v${count}`);
    }
    expect(list.history).toHaveLength(20);
    expect(list.history[0].valueLabel).toBe("V5");
    expect(list.lastOperation?.valueLabel).toBe("V24");
    expect(list.length).toBe(25);
  });
});
