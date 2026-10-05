import { describe, it, expect } from "vitest";
import { DoublyLinkedList } from "./DoublyLinkedList";
import type { LinkedList } from "./LinkedList";
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
    list.append("b");
    expect(list.lastOperation).toMatchObject({
      type: "append",
      index: 1,
      valueLabel: "B",
      previousLabel: "A",
      nextLabel: null,
    });
    expectValidList(list, ["a", "b"]);
  });

  it("records append on an empty list with no neighbors", () => {
    const { list } = trackedOf();
    list.append("a");
    expect(list.lastOperation).toMatchObject({ type: "append", index: 0, previousLabel: null, nextLabel: null });
    expectValidList(list, ["a"]);
  });

  it("records prepend with index 0 and its next neighbor", () => {
    const { list } = trackedOf("b");
    list.prepend("a");
    expect(list.lastOperation).toMatchObject({
      type: "prepend",
      index: 0,
      valueLabel: "A",
      previousLabel: null,
      nextLabel: "B",
    });
    expectValidList(list, ["a", "b"]);
  });

  it("records insert in the middle with both neighbors", () => {
    const { list } = trackedOf("a", "c");
    list.insert(1, "b");
    expect(list.lastOperation).toMatchObject({
      type: "insert",
      index: 1,
      valueLabel: "B",
      previousLabel: "A",
      nextLabel: "C",
    });
    expectValidList(list, ["a", "b", "c"]);
  });

  it("records remove with the neighbors that become linked", () => {
    const { list } = trackedOf("a", "b", "c");
    list.remove(1);
    expect(list.lastOperation).toMatchObject({
      type: "remove",
      index: 1,
      valueLabel: "B",
      previousLabel: "A",
      nextLabel: "C",
    });
    expectValidList(list, ["a", "c"]);
  });

  it("records remove of the head with no previous neighbor", () => {
    const { list } = trackedOf("a", "b");
    list.remove(0);
    expect(list.lastOperation).toMatchObject({ type: "remove", index: 0, previousLabel: null, nextLabel: "B" });
    expectValidList(list, ["b"]);
  });

  it("records removeNode in the middle with index null and both neighbors", () => {
    const { inner, list } = trackedOf("a", "b", "c");
    list.removeNode(inner.traverseToIndex(1));
    expect(list.lastOperation).toMatchObject({
      type: "removeNode",
      index: null,
      valueLabel: "B",
      previousLabel: "A",
      nextLabel: "C",
    });
    expectValidList(list, ["a", "c"]);
  });

  it("records removeNode of the tail with no next neighbor", () => {
    const { inner, list } = trackedOf("a", "b");
    const tail = inner.tail;
    if (tail === null) {
      throw new Error("Expected a tail");
    }
    list.removeNode(tail);
    expect(list.lastOperation).toMatchObject({ type: "removeNode", index: null, previousLabel: "A", nextLabel: null });
    expectValidList(list, ["a"]);
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
