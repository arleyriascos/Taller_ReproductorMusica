import { describe, it, expect } from "vitest";
import { DoublyLinkedList } from "./DoublyLinkedList";
import { Node } from "./Node";

function expectValidList<T>(list: DoublyLinkedList<T>, expected: T[]): void {
  const forwardNodes = [...list.forward()];
  const backwardNodes = [...list.backward()];
  expect(list.length).toBe(forwardNodes.length);
  expect(list.isEmpty()).toBe(list.length === 0);
  expect(backwardNodes).toEqual([...forwardNodes].reverse());
  expect(forwardNodes.map((node) => node.value)).toEqual(expected);
  if (list.length === 0) {
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
    return;
  }
  expect(list.head?.prev).toBeNull();
  expect(list.tail?.next).toBeNull();
  expect(forwardNodes[0]).toBe(list.head);
  expect(forwardNodes[forwardNodes.length - 1]).toBe(list.tail);
  for (const node of forwardNodes) {
    if (node.next !== null) {
      expect(node.next.prev).toBe(node);
    }
  }
}

function expectDetached<T>(node: Node<T>): void {
  expect(node.next).toBeNull();
  expect(node.prev).toBeNull();
}

function listOf<T>(...values: T[]): DoublyLinkedList<T> {
  const list = new DoublyLinkedList<T>();
  const added: T[] = [];
  for (const value of values) {
    list.append(value);
    added.push(value);
    expectValidList(list, added);
  }
  return list;
}

describe("Node", () => {
  it("starts with its value and no links", () => {
    const node = new Node("a");
    expect(node.value).toBe("a");
    expectDetached(node);
  });
});

describe("DoublyLinkedList creation", () => {
  it("starts empty", () => {
    const list = new DoublyLinkedList<number>();
    expectValidList(list, []);
    expect(list.isEmpty()).toBe(true);
  });
});

describe("append", () => {
  it("adds to an empty list and becomes head and tail", () => {
    const list = new DoublyLinkedList<number>();
    const node = list.append(1);
    expectValidList(list, [1]);
    expect(list.head).toBe(node);
    expect(list.tail).toBe(node);
  });

  it("adds after a single element", () => {
    const list = listOf(1);
    const node = list.append(2);
    expectValidList(list, [1, 2]);
    expect(list.tail).toBe(node);
  });

  it("adds after many elements", () => {
    const list = listOf(1, 2, 3, 4);
    const node = list.append(5);
    expectValidList(list, [1, 2, 3, 4, 5]);
    expect(list.tail).toBe(node);
  });
});

describe("prepend", () => {
  it("adds to an empty list and becomes head and tail", () => {
    const list = new DoublyLinkedList<number>();
    const node = list.prepend(1);
    expectValidList(list, [1]);
    expect(list.head).toBe(node);
    expect(list.tail).toBe(node);
  });

  it("adds before a single element", () => {
    const list = listOf(2);
    const node = list.prepend(1);
    expectValidList(list, [1, 2]);
    expect(list.head).toBe(node);
  });

  it("adds before many elements", () => {
    const list = listOf(2, 3, 4);
    const node = list.prepend(1);
    expectValidList(list, [1, 2, 3, 4]);
    expect(list.head).toBe(node);
  });
});

describe("insert", () => {
  it("inserts at 0 on an empty list", () => {
    const list = new DoublyLinkedList<number>();
    list.insert(0, 1);
    expectValidList(list, [1]);
  });

  it("inserts at 0 and at length with one element", () => {
    const list = listOf(2);
    list.insert(0, 1);
    expectValidList(list, [1, 2]);
    list.insert(2, 3);
    expectValidList(list, [1, 2, 3]);
  });

  it("inserts at 0 with many elements", () => {
    const list = listOf(2, 3, 4);
    const node = list.insert(0, 1);
    expectValidList(list, [1, 2, 3, 4]);
    expect(list.head).toBe(node);
  });

  it("inserts at length with many elements", () => {
    const list = listOf(1, 2, 3);
    const node = list.insert(3, 4);
    expectValidList(list, [1, 2, 3, 4]);
    expect(list.tail).toBe(node);
  });

  it("inserts in the middle linking leader and follower", () => {
    const list = listOf(1, 2, 4, 5);
    const leader = list.traverseToIndex(1);
    const follower = list.traverseToIndex(2);
    const node = list.insert(2, 3);
    expectValidList(list, [1, 2, 3, 4, 5]);
    expect(leader.next).toBe(node);
    expect(node.prev).toBe(leader);
    expect(node.next).toBe(follower);
    expect(follower.prev).toBe(node);
  });

  it("inserts in the middle of a two-element list", () => {
    const list = listOf(1, 3);
    list.insert(1, 2);
    expectValidList(list, [1, 2, 3]);
  });

  it.each([-1, 4, 1.5, Number.NaN])("throws RangeError for index %s and leaves the list unchanged", (index) => {
    const list = listOf(1, 2, 3);
    expect(() => list.insert(index, 9)).toThrow(RangeError);
    expectValidList(list, [1, 2, 3]);
  });

  it("throws RangeError for index 1 on an empty list", () => {
    const list = new DoublyLinkedList<number>();
    expect(() => list.insert(1, 9)).toThrow(RangeError);
    expectValidList(list, []);
  });
});

describe("remove", () => {
  it("removes the first element", () => {
    const list = listOf(1, 2, 3);
    const head = list.head;
    expect(list.remove(0)).toBe(1);
    expectValidList(list, [2, 3]);
    expect(head?.next).toBeNull();
  });

  it("removes the last element", () => {
    const list = listOf(1, 2, 3);
    expect(list.remove(2)).toBe(3);
    expectValidList(list, [1, 2]);
  });

  it("removes a middle element", () => {
    const list = listOf(1, 2, 3);
    const middle = list.traverseToIndex(1);
    expect(list.remove(1)).toBe(2);
    expectValidList(list, [1, 3]);
    expectDetached(middle);
  });

  it("removes the only element and empties head and tail", () => {
    const list = listOf(1);
    expect(list.remove(0)).toBe(1);
    expectValidList(list, []);
  });

  it("throws RangeError on an empty list", () => {
    const list = new DoublyLinkedList<number>();
    expect(() => list.remove(0)).toThrow(RangeError);
    expectValidList(list, []);
  });

  it.each([-1, 3, 0.5])("throws RangeError for index %s and leaves the list unchanged", (index) => {
    const list = listOf(1, 2, 3);
    expect(() => list.remove(index)).toThrow(RangeError);
    expectValidList(list, [1, 2, 3]);
  });
});

describe("removeNode", () => {
  it("removes the head", () => {
    const list = listOf(1, 2, 3);
    const node = list.traverseToIndex(0);
    expect(list.removeNode(node)).toBe(1);
    expectValidList(list, [2, 3]);
    expectDetached(node);
  });

  it("removes the tail", () => {
    const list = listOf(1, 2, 3);
    const node = list.traverseToIndex(2);
    expect(list.removeNode(node)).toBe(3);
    expectValidList(list, [1, 2]);
    expectDetached(node);
  });

  it("removes a middle node", () => {
    const list = listOf(1, 2, 3);
    const node = list.traverseToIndex(1);
    expect(list.removeNode(node)).toBe(2);
    expectValidList(list, [1, 3]);
    expectDetached(node);
  });

  it("removes the only node", () => {
    const list = listOf(1);
    const node = list.traverseToIndex(0);
    expect(list.removeNode(node)).toBe(1);
    expectValidList(list, []);
    expectDetached(node);
  });

  it("removes repeated values by node identity", () => {
    const list = listOf("a", "b", "a");
    const lastA = list.traverseToIndex(2);
    list.removeNode(lastA);
    expectValidList(list, ["a", "b"]);
    expect(list.head?.value).toBe("a");
  });

  it("throws Error for a detached node and leaves the list unchanged", () => {
    const list = listOf(1, 2);
    expect(() => list.removeNode(new Node(1))).toThrow(Error);
    expectValidList(list, [1, 2]);
  });

  it("throws Error for a node on an empty list", () => {
    const list = new DoublyLinkedList<number>();
    expect(() => list.removeNode(new Node(1))).toThrow(Error);
    expectValidList(list, []);
  });

  it("throws Error for the tail of another list", () => {
    const list = listOf(1, 2);
    const other = listOf(3, 4);
    const foreignTail = other.traverseToIndex(1);
    expect(() => list.removeNode(foreignTail)).toThrow(Error);
    expectValidList(list, [1, 2]);
    expectValidList(other, [3, 4]);
  });
});

describe("traverseToIndex", () => {
  it("returns the right node for every index in both halves", () => {
    const list = listOf(0, 1, 2, 3, 4, 5, 6);
    const expectedNodes = [...list.forward()];
    for (let index = 0; index < list.length; index++) {
      expect(list.traverseToIndex(index)).toBe(expectedNodes[index]);
    }
  });

  it("returns head and tail at the ends", () => {
    const list = listOf(0, 1, 2, 3, 4, 5);
    expect(list.traverseToIndex(0)).toBe(list.head);
    expect(list.traverseToIndex(5)).toBe(list.tail);
  });

  it("returns the right node in the first half", () => {
    const list = listOf(0, 1, 2, 3, 4, 5);
    expect(list.traverseToIndex(1).value).toBe(1);
    expect(list.traverseToIndex(2).value).toBe(2);
  });

  it("returns the right node in the second half", () => {
    const list = listOf(0, 1, 2, 3, 4, 5);
    expect(list.traverseToIndex(3).value).toBe(3);
    expect(list.traverseToIndex(4).value).toBe(4);
  });

  it.each([-1, 6, 2.5])("throws RangeError for index %s", (index) => {
    const list = listOf(0, 1, 2, 3, 4, 5);
    expect(() => list.traverseToIndex(index)).toThrow(RangeError);
    expectValidList(list, [0, 1, 2, 3, 4, 5]);
  });

  it("throws RangeError on an empty list", () => {
    const list = new DoublyLinkedList<number>();
    expect(() => list.traverseToIndex(0)).toThrow(RangeError);
  });
});

describe("indexOf and find", () => {
  it("indexOf returns the position of a present node", () => {
    const list = listOf("a", "b", "c");
    const node = list.traverseToIndex(2);
    expect(list.indexOf(node)).toBe(2);
  });

  it("indexOf returns -1 for an absent node", () => {
    const list = listOf("a", "b", "c");
    expect(list.indexOf(new Node("b"))).toBe(-1);
  });

  it("find returns the first matching node", () => {
    const list = listOf(1, 2, 3, 4);
    expect(list.find((value) => value % 2 === 0)).toBe(list.traverseToIndex(1));
  });

  it("find returns null when nothing matches", () => {
    const list = listOf(1, 3, 5);
    expect(list.find((value) => value % 2 === 0)).toBeNull();
  });
});

describe("forward and backward", () => {
  it("yield nothing on an empty list", () => {
    const list = new DoublyLinkedList<number>();
    expect([...list.forward()]).toEqual([]);
    expect([...list.backward()]).toEqual([]);
  });

  it("yield the same single node on a one-element list", () => {
    const list = listOf(1);
    expect([...list.forward()]).toEqual([list.head]);
    expect([...list.backward()]).toEqual([list.head]);
  });

  it("yield opposite orders on many elements", () => {
    const list = listOf(1, 2, 3, 4);
    expect([...list.forward()].map((node) => node.value)).toEqual([1, 2, 3, 4]);
    expect([...list.backward()].map((node) => node.value)).toEqual([4, 3, 2, 1]);
  });
});

describe("moveNode", () => {
  function moveAndCheck(values: string[], from: number, to: number): { list: DoublyLinkedList<string>; moved: Node<string>; before: Node<string>[] } {
    const list = listOf(...values);
    const before = [...list.forward()];
    const moved = before[from];
    list.moveNode(moved, to);
    const expected = values.filter((_, index) => index !== from);
    expected.splice(to, 0, values[from]);
    expectValidList(list, expected);
    return { list, moved, before };
  }

  it("moves the head to the tail", () => {
    const { list, moved } = moveAndCheck(["a", "b", "c", "d"], 0, 3);
    expect(list.tail).toBe(moved);
    expect(list.head?.value).toBe("b");
  });

  it("moves the tail to the head", () => {
    const { list, moved } = moveAndCheck(["a", "b", "c", "d"], 3, 0);
    expect(list.head).toBe(moved);
    expect(list.tail?.value).toBe("c");
  });

  it("moves a middle node forward", () => {
    moveAndCheck(["a", "b", "c", "d", "e"], 1, 3);
  });

  it("moves a middle node backward", () => {
    moveAndCheck(["a", "b", "c", "d", "e"], 3, 1);
  });

  it("moves a node one step in each direction", () => {
    moveAndCheck(["a", "b", "c"], 1, 2);
    moveAndCheck(["a", "b", "c"], 1, 0);
  });

  it("leaves the list unchanged when moving to the same index", () => {
    for (const index of [0, 1, 2]) {
      const { list, before } = moveAndCheck(["a", "b", "c"], index, index);
      expect([...list.forward()]).toEqual(before);
    }
  });

  it("works on a single-node list", () => {
    const { list, moved } = moveAndCheck(["a"], 0, 0);
    expect(list.head).toBe(moved);
    expect(list.tail).toBe(moved);
  });

  it("works on a two-node list", () => {
    moveAndCheck(["a", "b"], 0, 1);
    moveAndCheck(["a", "b"], 1, 0);
  });

  it("keeps the identity of the moved node and of every other node", () => {
    const { list, moved, before } = moveAndCheck(["a", "b", "c", "d"], 1, 3);
    expect(list.length).toBe(4);
    expect(new Set(list.forward())).toEqual(new Set(before));
    expect(list.traverseToIndex(3)).toBe(moved);
  });

  it("moves every node to every index with valid links", () => {
    const values = ["a", "b", "c", "d", "e"];
    for (let from = 0; from < values.length; from++) {
      for (let to = 0; to < values.length; to++) {
        moveAndCheck(values, from, to);
      }
    }
  });

  it("rejects invalid indexes without changing the list", () => {
    const list = listOf("a", "b", "c");
    const before = [...list.forward()];
    const node = before[1];
    for (const index of [-1, 3, 4, 1.5, Number.NaN]) {
      expect(() => list.moveNode(node, index)).toThrow(RangeError);
      expectValidList(list, ["a", "b", "c"]);
      expect([...list.forward()]).toEqual(before);
    }
  });

  it("rejects any index on a single-node list except zero", () => {
    const list = listOf("a");
    expect(() => list.moveNode(list.traverseToIndex(0), 1)).toThrow(RangeError);
    expectValidList(list, ["a"]);
  });

  it("keeps working after moves", () => {
    const list = listOf("a", "b", "c");
    list.moveNode(list.traverseToIndex(0), 2);
    list.append("d");
    list.prepend("z");
    expectValidList(list, ["z", "b", "c", "a", "d"]);
  });
});

describe("clear", () => {
  it("empties the list and detaches every node", () => {
    const list = listOf(1, 2, 3);
    const nodes = [...list.forward()];
    list.clear();
    expectValidList(list, []);
    for (const node of nodes) {
      expectDetached(node);
    }
  });

  it("keeps working after clearing", () => {
    const list = listOf(1, 2);
    list.clear();
    expectValidList(list, []);
    list.append(3);
    expectValidList(list, [3]);
  });

  it("does nothing harmful on an empty list", () => {
    const list = new DoublyLinkedList<number>();
    list.clear();
    expectValidList(list, []);
  });
});
