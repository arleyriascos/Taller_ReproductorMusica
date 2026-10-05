# DATA_STRUCTURE — Musongs

## 1. Origin

The implementation follows the doubly linked list taught in class (Python): `Node` with `value`, `next`, `prev`; `DoublyLinkedList` with `head`, `tail`, `length`, `append`, `prepend`, `traverse_to_index`, `insert`, `remove`, `print_list`.
Names are kept (in TypeScript camelCase) so the professor recognizes the structure.

Corrections over the class code, all intentional:

| Class code behavior | Musongs behavior |
|---|---|
| `remove(0)` on a one-element list fails (`head` becomes `None`, then `head.prev` is accessed) and `tail` keeps pointing to the removed node | Removing the only node sets `head` and `tail` to `null` |
| No index validation; `traverse_to_index` walks into `None` | Invalid indexes throw `RangeError`; the list is unchanged |
| `remove` on an empty list not handled | Throws `RangeError` |
| `traverse_to_index` always starts at `head` | Starts at `tail` when the index is in the second half, using `prev` |
| `print_list` joins a string character by character | Replaced by forward and backward generators |
| Removed nodes keep their links | Removed nodes are detached (`next` and `prev` set to `null`) |
| No way to remove a known node | `removeNode(node)` in O(1) |

## 2. Node<T> (`Node.ts`)

| Member | Type |
|---|---|
| `value` | `T` (readonly) |
| `next` | `Node<T> \| null` |
| `prev` | `Node<T> \| null` |
| `constructor(value: T)` | `next` and `prev` start as `null` |

## 3. LinkedList<T> interface (`LinkedList.ts`)

Contract implemented by `DoublyLinkedList<T>` and `TrackedLinkedList<T>`.

| Member | Semantics | Cost |
|---|---|---|
| `head: Node<T> \| null` (readonly) | First node | O(1) |
| `tail: Node<T> \| null` (readonly) | Last node | O(1) |
| `length: number` (readonly) | Number of nodes | O(1) |
| `append(value): Node<T>` | Adds at the end, returns the new node | O(1) |
| `prepend(value): Node<T>` | Adds at the beginning, returns the new node | O(1) |
| `insert(index, value): Node<T>` | Valid `0..length`. `0` → prepend, `length` → append, otherwise links between `index-1` and `index`. Otherwise `RangeError` | O(n) |
| `remove(index): T` | Valid `0..length-1`. Returns the removed value. Otherwise `RangeError` (always on empty list) | O(n) |
| `removeNode(node): T` | Removes a node known to belong to this list. Returns its value | O(1) |
| `moveNode(node, toIndex): void` | Moves a node of this list to `toIndex`, valid `0..length-1`, measured **after** the node is taken out. Unlinks the node and relinks the same object: no node is created or destroyed and `length` does not change. Invalid index → `RangeError` and the list is unchanged | O(n) |
| `traverseToIndex(index): Node<T>` | Valid `0..length-1`, from the nearest end. Otherwise `RangeError` | O(n) |
| `indexOf(node): number` | Position of the node, `-1` if absent | O(n) |
| `find(predicate): Node<T> \| null` | First node whose value satisfies the predicate | O(n) |
| `forward(): Generator<Node<T>>` | `head` → `tail` following `next` | O(n) |
| `backward(): Generator<Node<T>>` | `tail` → `head` following `prev` | O(n) |
| `isEmpty(): boolean` | `length === 0` | O(1) |
| `clear(): void` | Detaches every node, empties the list | O(n) |

`index` is always an integer; non-integers throw `RangeError`. Error messages are in English; the UI translates them.

`removeNode` and `moveNode` precondition: the node belongs to this list. Callers (`Playlist`) only pass their own nodes. The implementation checks the cheap invariants (a node with `prev === null` must be `head`, a node with `next === null` must be `tail`) and throws `Error` if they fail.

## 4. Invariants (checked by tests after every operation)

- Empty list: `head === null`, `tail === null`, `length === 0`.
- Non-empty: `head.prev === null`, `tail.next === null`.
- For every node `n` with `n.next`: `n.next.prev === n`.
- Counting forward from `head` gives `length`.
- `backward()` yields exactly the reverse of `forward()`.

## 5. Link changes per operation (for the defense and the structure panel)

- `append(v)`: `new.prev = tail`, `tail.next = new`, `tail = new`.
- `prepend(v)`: `new.next = head`, `head.prev = new`, `head = new`.
- `insert(i, v)` in the middle: `leader = traverseToIndex(i-1)`, `follower = leader.next`; `leader.next = new`, `new.prev = leader`, `new.next = follower`, `follower.prev = new`. Four links.
- `removeNode(n)` in the middle: `n.prev.next = n.next`, `n.next.prev = n.prev`. Head or tail cases move `head` or `tail`.
- `moveNode(n, toIndex)`: first the node is taken out exactly like `removeNode` (`unlink` then `detach`, `length--`): its old neighbors `A` and `B` are linked to each other (`A.next = B`, `B.prev = A`; `head` or `tail` move if `n` was at an end) and `n.next = n.prev = null`. Then it is put back with the same helper `insert` uses (`linkAt(toIndex, n)`, `length++`): at index `0` it becomes the new `head` (`n.next = head`, `head.prev = n`), at index `length` the new `tail` (`n.prev = tail`, `tail.next = n`), otherwise it goes between `leader = traverseToIndex(toIndex-1)` and `follower = leader.next` (`leader.next = n`, `n.prev = leader`, `n.next = follower`, `follower.prev = n`). Moving to the current position leaves every link as it was. The node object keeps its identity and its `value`.

## 6. TrackedLinkedList<T> (`TrackedLinkedList.ts`) — Decorator

- `constructor(inner: LinkedList<T>, describe: (value: T) => string)`.
- `head`, `tail`, `length` and all queries delegate to `inner`.
- Each mutating method delegates, then records a `ListOperation` (from `types.ts`):
  - `type`: `'append' | 'prepend' | 'insert' | 'remove' | 'removeNode' | 'move' | 'clear'`
  - `index: number | null`: position affected (`move` records the destination `toIndex`); `removeNode` and `clear` record `null`, so `removeNode` stays O(1) without computing the node's position
  - `valueLabel`: `describe(value)`
  - `previousLabel`, `nextLabel`: labels of the neighbors linked by the operation, or `null`
  - `previousNode`, `node`, `nextNode`: references to the real nodes (`Node<T> | null`). For `append`, `prepend`, `insert` and `move` they are the node that was placed and its new neighbors, read from the links right after the operation. For `remove` and `removeNode`, `node` is `null` (the node left the list) and the neighbors are the two nodes that were linked to each other. `clear` records `null` for all three
  - `timestamp`
- `history: readonly ListOperation[]` keeps the last 20 operations; `lastOperation: ListOperation | null`.
- A failing operation (exception) records nothing.

## 7. How the player uses the list

`Playlist` owns a `TrackedLinkedList<Song>` that wraps a `DoublyLinkedList<Song>`, plus `current: Node<Song> | null`.

- Select a song: `current = <clicked node>` (the view keeps a reference to each row's node; no index lookup).
- Next: if `current.next` exists, `current = current.next`.
- Previous: if `current.prev` exists, `current = current.prev`.
- `hasNext()` is `current?.next != null`; the UI disables the button otherwise.
- Remove current: `replacement = current.next ?? current.prev`, `removeNode(current)`, `current = replacement`.
- Move: `moveUp(node)` / `moveDown(node)` call `moveNode(node, index ∓ 1)`; they do nothing at `head` / `tail`. `current` is a node reference, so it stays on the same song after a move.
- Positions shown to the user start at 1. `Playlist` is the only place that converts position to index.

## 8. Song is not Node

The same `Song` object can be the `value` of many nodes: one in the Library and others in playlists, even twice in the same playlist. Each node has its own `next` and `prev`. Removing a node never destroys its `Song`; only removing from the Library does.
