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
| End of list | Next disabled at `tail`, previous disabled at `head`; playback stops after the last song |
| Removing the current song | Move to next; if none, to previous; if none, player becomes empty |
| Playback context | The list where the user pressed play; independent of the list being viewed |
| Persistence | `localStorage` stores structure and metadata only; files are reconnected by fingerprint |
| Patterns | Singleton (`MusicPlayer`), Decorator (`TrackedLinkedList`), Prototype (`Playlist.clone`) |
| Structure panel | Exists, minimized by default, opened from the player bar |
| App name | Musongs |
| UI language | Spanish; code in English |
| Theme | Follows the operating system (light/dark), coral accent tuned per mode, no manual toggle |
| Deployment | Vercel connected to the public GitHub repository |
| Git | The student commits and pushes; the agent never does |

## Scope

Level 1 (mandatory): Library loading (files and folder), metadata, playlists CRUD, add at start/end/position, remove, play/pause, next/previous, seek, time, duration, volume, mute, auto-advance, current song with cover, responsive UI, empty and error states, tests, deployment.

Level 2 (after Level 1 works, in this order): structure panel with Decorator, persistence with reconnection, duplicate playlist with Prototype.

Out of scope: external APIs, shuffle, search, favorites, history, visualizer, manual theme toggle, keyboard shortcuts. "Repeat" only if time remains.

## Phases

| Phase | Content | Status |
|---|---|---|
| 0 | Analysis | Done |
| 1 | Definition | Done |
| 2 | Design | Done |
| 3 | GitHub, VS Code, Git identity, Vite scaffold, Vercel connection | Next |
| 4 | `Node`, `LinkedList`, `DoublyLinkedList` + tests | |
| 5 | `Song`, `Playlist`, `PlaylistManager` + tests | |
| 6 | `SongLoader`, `MusicPlayer` | |
| 7 | Views and `App`: full Level 1 interface | |
| 8 | Visual design and responsive polish | |
| 9 | Level 2: `TrackedLinkedList` + structure panel | |
| 10 | Level 2: persistence and reconnection | |
| 11 | Level 2: duplicate playlist | |
| 12 | Full manual test pass and review | |
| 13 | Production verification on Vercel | |

Each implementation phase follows: prompt → agent implements and tests → report reviewed in chat → fixes → student commits and pushes.

## Planned commits (adjust to what was really built)

- Initial project setup
- Implement doubly linked list
- Add song, playlist and playlist manager models
- Implement local audio loading and music player
- Build player interface
- Improve visual design and responsive layout
- Add data structure panel
- Add playlist persistence and file reconnection
- Add playlist duplication
- Fix issues found in testing
