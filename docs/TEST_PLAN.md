# TEST_PLAN — Musongs

## 1. Automated (Vitest)

Every data-structure test ends by asserting the invariants of `DATA_STRUCTURE.md` section 4.

### DoublyLinkedList.test.ts
- New list is empty.
- `append` on empty, on 1, on many.
- `prepend` on empty, on 1, on many.
- `insert` at 0, at `length`, in the middle; with 1 and with many elements.
- `insert` with -1, `length + 1`, 1.5 → `RangeError`, list unchanged.
- `remove` first, last, middle, the only element.
- `remove` on empty and out of range → `RangeError`.
- `removeNode` head, tail, middle, only; removed node is detached.
- `traverseToIndex` first half and second half return the right node; invalid → `RangeError`.
- `indexOf` present and absent; `find` match and no match.
- `forward` and `backward` on empty, 1 and many.
- `clear` empties and detaches.

### TrackedLinkedList.test.ts
- Delegates results and `head`/`tail`/`length` to the inner list.
- Records type, index, value label and neighbor labels for each mutation.
- Failing operation records nothing.
- History limited to 20 entries.

### Playlist.test.ts
- `addAtPosition` converts 1-based positions; invalid positions rejected.
- `next`/`previous` move `current`; `hasNext`/`hasPrevious` false at the edges.
- Removing current with next → next; at tail → previous; only node → `null`.
- `removeAllOf` removes every node holding the song.
- `clone`: same order, different nodes, same `Song` objects, empty history, `current` null, original unchanged after modifying the clone.

## 2. Manual

| ID | Case | Expected |
|---|---|---|
| M01 | Open with no data | Empty Library state |
| M02 | Load 1 file | Song appears with metadata |
| M03 | Load many files | All valid ones appear, toast with count |
| M04 | Load a folder | Valid audio inside is loaded |
| M05 | Load invalid formats (pdf, jpg) | Rejected with toast |
| M06 | Load the same file twice | Duplicate toast, no repeated row |
| M07 | File without tags | File name as title, generic cover |
| M08 | Play, pause | Audio starts and stops |
| M09 | Next / previous in the middle | Changes song |
| M10 | At first / last song | Corresponding button disabled |
| M11 | Song ends in the middle | Next starts automatically |
| M12 | Last song ends | Playback stops |
| M13 | Seek on progress bar | Jumps to time |
| M14 | Volume and mute | Change and restore |
| M15 | Create playlist (valid, empty, duplicate name) | Created / inline error / inline error |
| M16 | Add at start, end, position 2 | Correct order in list and panel |
| M17 | Add at position out of range | Dialog error |
| M18 | Same song twice in a playlist | Allowed, two rows, two nodes |
| M19 | Remove first, last, middle | Correct order |
| M20 | Remove current song while playing | Plays the next (or previous) |
| M21 | Remove the only song while playing | Player becomes empty |
| M22 | Remove song from Library | Disappears from every playlist |
| M23 | Switch visible playlist while playing | Playback continues in its own list |
| M24 | Delete the playing playlist | Playback stops |
| M25 | Structure panel open/close | Minimized by default; state remembered |
| M26 | Panel after insert/remove | Nodes, labels and last operation correct |
| M27 | Reload page | Playlists kept, songs unavailable, banner shown |
| M28 | Reconnect folder | Matching songs available again |
| M29 | Duplicate playlist, then edit copy | Original unchanged |
| M30 | Light and dark system theme | Both readable |
| M31 | Mobile width | Drawer, bottom sheet, compact player |
| M32 | Keyboard only | All main actions reachable |
| M33 | Deployed version on another computer | Works with that computer's files |

## 3. Before every push

- [ ] `npm run build` without errors.
- [ ] `npm test` all green.
- [ ] App starts with `npm run dev`.
- [ ] The stage's features work.
- [ ] Doubly linked list invariants pass.
- [ ] No hardcoded songs, audio URLs or local paths.
- [ ] No credentials or `.env` files.
- [ ] No audio files in the repository (`git status` checked).
- [ ] No comments in code.
- [ ] No unnecessary files.
- [ ] Commit message describes what was really built.
