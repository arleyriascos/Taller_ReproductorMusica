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
| Persistence | `localStorage` stores structure and metadata only; files are reconnected by fingerprint |
| Patterns | Singleton (`MusicPlayer`), Decorator (`TrackedLinkedList`), Prototype (`Playlist.clone`) |
| Structure panel | Shows the visible playlist. Changed in stage 8: visible by default on desktop (≥ 1100px) as a right column, because it is the main academic showcase; hidden by default on tablets (overlay) and phones (bottom sheet). Toggle in the player bar. The open/closed preference is not remembered until persistence |
| Operation data for the panel | `ListOperation<T>` (Decorator) records `previousNode`, `node` and `nextNode` besides the labels, so the panel knows which nodes changed without touching `DoublyLinkedList` |
| Now playing view | Large cover and controls; "A continuación" built by following `next` from the current node, "Anteriores" by following `prev` |
| Lyrics | Priority: paired `.lrc` file → lyrics embedded in the audio file → LRCLIB. Requested only when the "Letra" tab is open |
| External APIs | LRCLIB (lyrics) receives only title, artist, album and duration; never audio or file data. Audius planned for "Explorar" |
| App name | Musongs |
| UI language | Spanish; code in English |
| Theme | Follows the operating system (light/dark), coral accent tuned per mode, no manual toggle |
| Deployment | Vercel connected to the public GitHub repository |
| Git | The student commits and pushes; the agent never does |

## Scope

Level 1 (mandatory, done): Library loading (files and folder), metadata, playlists CRUD, add at start/end/position, remove, play/pause, next/previous, seek, time, duration, volume, mute, auto-advance, current song with cover, responsive UI, empty and error states, tests, deployment.

Extras already built (phase 8A): repeat (off / all / one), search in the visible list, playlist play button, animated bars on the current row, Media Session (lock screen and media keys).

Next, in this order: now playing view with queue and lyrics; structure panel with Decorator; "Explorar" with Audius (Adapter); persistence with reconnection; duplicate playlist with Prototype, keyboard shortcuts and drag and drop; final tests and production verification.

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
| 10 | Structure panel with `TrackedLinkedList` (Decorator): live chain of the visible playlist, window of ±15 nodes, last operation with flash, history | In review |
| 11 | "Explorar" with Audius (Adapter) | |
| 12 | Persistence and file reconnection | |
| 13 | Duplicate playlist (Prototype), keyboard shortcuts, drag and drop | |
| 14 | Final tests and production verification on Vercel | |

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
- Add Explorar with Audius
- Add playlist persistence and file reconnection
- Add playlist duplication
- Fix issues found in testing
