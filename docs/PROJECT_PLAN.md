# PROJECT_PLAN — Musongs

## Assignment (from the official screenshot)

Create a TypeScript app applying doubly linked lists to simulate a song playlist, with a frontend where the user interacts. It must:
- Add a song at the beginning, at the end, and at any position.
- Remove a song.
- Go to the next song.
- Go to the previous song.
- Include other relevant features.

Verbal clarifications from the professor (treated as mandatory): real audio playback, dynamic loading of songs from the user's computer, songs never uploaded to the cloud, multiple playlists where each playlist is a doubly linked list, OOP, one class per file, a well-designed interface, deployment.

Individual work. Assigned 2026-09-28, due 2026-10-06.

## Decision log

| Topic | Decision |
|---|---|
| Language | TypeScript (the screenshot rules over the "Python" line in the class slides) |
| Framework | Vite + vanilla TypeScript, no UI framework |
| Tests | Vitest for data structure and model |
| Metadata | `music-metadata`, fallback to file name and generic cover |
| Library | A special, non-deletable `Playlist`; also a doubly linked list |
| Duplicates | Not allowed in the Library (by fingerprint); allowed in playlists (different nodes, same `Song`) |
| Removing from a playlist | Removes only that node |
| Removing from the Library | Removes the song from every playlist and releases its object URL |
| End of list | Next disabled at `tail`, previous disabled at `head`; playback stops after the last song (unless repeat is "toda la lista") |
| Repeat | Three modes (off, all, one) decided by `MusicPlayer`; the list itself is never circular |
| Search | Presentation only: hides rows of the visible list, never copies or reorders it |
| Removing the current song | Move to next; if none, to previous; if none, player becomes empty |
| Playback context | The list where the user pressed play; independent of the list being viewed |
| Persistence | `localStorage` stores structure, metadata and preferences; the audio, covers and lyrics files are kept in the browser's IndexedDB (never uploaded). If the audio is missing, songs are reconnected by fingerprint |
| Move a song | New list operation `moveNode(node, toIndex)` (unlink and relink the same node), `Playlist.moveUp` / `moveDown`, recorded as `move` by the Decorator |
| Right column | Two tabs: "Sonando" (cover, `prev` / `next` neighbors, queue) and "Estructura" (the structure panel) |
| Patterns | Singleton (`MusicPlayer`), Decorator (`TrackedLinkedList`), Prototype (`Playlist.clone`) |
| Structure panel | Shows the visible playlist. Changed in stage 8: visible by default on desktop (≥ 1100px) as a right column, because it is the main academic showcase; hidden by default on tablets (overlay) and phones (bottom sheet). Toggle in the player bar. Since stage 9 the open state and the selected tab are remembered |
| Operation data for the panel | `ListOperation<T>` (Decorator) records `previousNode`, `node` and `nextNode` besides the labels, so the panel knows which nodes changed without touching `DoublyLinkedList` |
| Now playing view | Large cover and controls; "A continuación" built by following `next` from the current node, "Anteriores" by following `prev` |
| Lyrics | Priority: paired `.lrc` file → lyrics embedded in the audio file → LRCLIB. Requested only when the "Letra" tab is open |
| External APIs | LRCLIB (lyrics) receives only title, artist, album and duration; never audio or file data. Audius ("Explorar") is future work |
| App name | Musongs |
| UI language | Spanish; code in English |
| Theme | Follows the operating system (light/dark), coral accent tuned per mode, no manual toggle |
| Deployment | Vercel connected to the public GitHub repository |
| Git | The student commits and pushes; the agent never does |

## Scope

Level 1 (mandatory, done): Library loading (files and folder), metadata, playlists CRUD, add at start/end/position, remove, play/pause, next/previous, seek, time, duration, volume, mute, auto-advance, current song with cover, responsive UI, empty and error states, tests, deployment.

Extras already built (phase 8A): repeat (off / all / one), search in the visible list, playlist play button, animated bars on the current row, Media Session (lock screen and media keys).

Built after that: now playing view with queue and lyrics; structure panel with Decorator; right column with the "Sonando" tab; move a song up and down; duplicate playlist with Prototype; persistence with the audio stored locally in IndexedDB and a reconnection fallback.

Trabajo futuro: "Explorar" with Audius (Adapter), keyboard shortcuts and drag and drop to reorder.

Out of scope: shuffle, favorites, listening history, visualizer, manual theme toggle, uploading or streaming the user's own audio.

## Phases

| Phase | Content | Status |
|---|---|---|
| 0 | Analysis | Done |
| 1 | Definition | Done |
| 2 | Design | Done |
| 3 | GitHub, VS Code, Git identity, Vite scaffold, Vercel connection | Done |
| 4 | `Node`, `LinkedList`, `DoublyLinkedList` + tests | Done |
| 5 | `Song`, `Playlist`, `PlaylistManager` + tests | Done |
| 6 | `SongLoader`, `MusicPlayer` | Done |
| 7 | Views and `App`: full Level 1 interface | Done |
| 8 | Visual design and responsive polish | Done |
| 8A | Repeat, search, playlist play button, now-playing bars, Media Session | Done |
| 9 | "Reproduciendo ahora" view: queue from `next`, "Anteriores" from `prev`, lyrics (`.lrc`, embedded, LRCLIB) | Done |
| 10 | Structure panel with `TrackedLinkedList` (Decorator): live chain of the visible playlist, window of ±15 nodes, last operation with flash, history | Done |
| 11 | Right column with "Sonando" and "Estructura" tabs; `moveNode`, `moveUp` / `moveDown`; duplicate playlist (Prototype) | Done |
| 12 | Persistence: state and preferences in `localStorage`, audio in IndexedDB, reconnection fallback, clear saved data | Done |
| 13 | Documentation update | Done |
| 14 | Final production verification on Vercel | Pending (student) |
| Future | "Explorar" with Audius (Adapter), keyboard shortcuts, drag and drop to reorder | Trabajo futuro |

Each implementation phase follows: prompt → agent implements and tests → report reviewed in chat → fixes → student commits and pushes.

## Planned commits (adjust to what was really built)

- Initial project setup
- Implement doubly linked list
- Add song, playlist and playlist manager models
- Implement local audio loading and music player
- Build player interface
- Improve visual design and responsive layout
- Add repeat, search and media session
- Add now playing view with queue and lyrics
- Add data structure panel
- Add right column with now playing tab, move and playlist duplication
- Add local persistence with IndexedDB and file reconnection
- Fix issues found in testing
