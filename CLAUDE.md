# CLAUDE.md — Musongs

Permanent rules for the implementation agent. Read this file completely before every task.
Detailed design lives in `docs/`. When this file and `docs/` disagree, stop and ask.

## 1. Project

Musongs is the "Taller Reproductor de Música" of the course Estructuras de Datos (professor Jhonatan Mideros Narvaez).
It is a TypeScript web music player whose core is a hand-written doubly linked list.
Every song collection in the app (the Library and every playlist) is a doubly linked list.
Next / previous navigation follows the `next` / `prev` links of the current node.

Repository: `Taller_ReproductorMusica`. Deployment: Vercel (static build).

## 2. Your role

You are the implementation agent. Architecture decisions are made outside this session by the student.
You implement exactly the stage you are given, test it, and report.

You must NOT, on your own initiative:
- Change the architecture, the class list, the data structure, the patterns, the framework, the persistence format, or the deployment approach.
- Add dependencies other than the ones listed in section 4.
- Create folders other than the ones listed in section 5.
- Work on stages other than the one requested.
- Run `git commit`, `git push`, `git reset`, `git rebase`, or any command that changes Git history or configuration.
- Change `git config` (user.name, user.email, or anything else).

If something in the request is impossible, contradictory, or seems wrong, stop and explain instead of improvising.

## 3. Non-negotiable code rules

1. All code in English: classes, interfaces, types, variables, methods, functions, properties, constants, file names, HTML ids, CSS classes, CSS variables, events.
2. Text visible to the user is in Spanish (buttons, labels, messages, aria-labels, page title).
3. No comments of any kind inside code: no `//`, no `/* */`, no `<!-- -->`. Code must be clear through naming and small functions.
4. One class per file. The file name equals the class name.
5. Object-oriented design with real responsibilities. No classes created only to look object-oriented.
6. The doubly linked list must be real: `Node` objects linked by `next` and `prev`, with `head`, `tail` and `length`.
7. Never replace the doubly linked list with an array, and never navigate songs by array index. Converting a list to an array is only allowed inside persistence serialization (see `docs/ARCHITECTURE.md`).
8. Rendering lists in the UI must traverse nodes with the list's forward traversal, not an intermediate array.
9. No hardcoded songs, no hardcoded audio URLs, no hardcoded local file paths. Songs come only from files the user selects or from Audius search results (the stream URL is built from the track id returned by the API).
10. User audio never leaves the browser: no uploads, no backend, no fetch of audio files. Audius songs are only streamed through the audio element and are never stored in `AudioStore`.
11. Never put user-provided strings (file names, metadata, playlist names) into `innerHTML`. Use `textContent` and DOM creation. Metadata can contain HTML.
12. Colors only through CSS custom properties defined in `styles.css`. No literal colors anywhere else. Only exception: the favicon data URI in `index.html`, which cannot read CSS variables and must use the light-mode `--color-accent` value.
13. No duplicated logic, no large functions. Prefer functions under ~25 lines.
14. TypeScript `strict` mode. No `any`. No non-null assertions (`!`) unless a comment would be needed to justify it, which means: do not use them.
15. No `console.log` left in delivered code.

## 4. Stack

- Vite (template `vanilla-ts`), TypeScript strict, no UI framework.
- Vitest (dev dependency) for tests.
- `music-metadata` (only production dependency) for title, artist, album, cover and duration.
- Fonts from Google Fonts with system fallbacks. Icons are inline SVG written for this project, no icon library.

npm scripts: `dev`, `build` (`tsc && vite build`), `preview`, `test` (`vitest run`).

## 5. File structure

```
Taller_ReproductorMusica/
├── CLAUDE.md
├── README.md
├── index.html
├── package.json
├── tsconfig.json
├── .gitignore
├── .gitattributes
├── docs/
└── src/
    ├── main.ts
    ├── styles.css
    ├── icons.ts
    ├── format.ts
    ├── lyrics.ts
    ├── queueItem.ts
    ├── trackRow.ts
    ├── fileInput.ts
    ├── droppedFiles.ts
    ├── audius.ts
    ├── types.ts
    ├── Node.ts
    ├── LinkedList.ts
    ├── DoublyLinkedList.ts
    ├── TrackedLinkedList.ts
    ├── Song.ts
    ├── Playlist.ts
    ├── PlaylistManager.ts
    ├── SongLoader.ts
    ├── MusicPlayer.ts
    ├── PlaylistStorage.ts
    ├── AudioStore.ts
    ├── LyricsService.ts
    ├── AudiusTrackAdapter.ts
    ├── AudiusService.ts
    ├── ExploreSession.ts
    ├── KeyboardShortcuts.ts
    ├── App.ts
    ├── SidebarView.ts
    ├── TrackListView.ts
    ├── PlaylistHeaderView.ts
    ├── ExploreView.ts
    ├── PlayerBarView.ts
    ├── NowPlayingView.ts
    ├── NowPlayingPanelView.ts
    ├── StructurePanelView.ts
    ├── PanelLayoutView.ts
    ├── PanelSplitterView.ts
    ├── NotificationView.ts
    ├── DialogView.ts
    ├── AddToPlaylistDialogView.ts
    ├── AddSongsDialogView.ts
    ├── PlacementFieldsView.ts
    ├── ShortcutsDialogView.ts
    ├── DropIndicator.ts
    ├── RowDragController.ts
    ├── FileDropZone.ts
    ├── DoublyLinkedList.test.ts
    ├── TrackedLinkedList.test.ts
    ├── Song.test.ts
    ├── Playlist.test.ts
    ├── PlaylistManager.test.ts
    ├── SongLoader.test.ts
    ├── PlaylistStorage.test.ts
    ├── AudioStore.test.ts
    ├── LyricsService.test.ts
    ├── lyrics.test.ts
    ├── format.test.ts
    ├── droppedFiles.test.ts
    ├── AudiusTrackAdapter.test.ts
    ├── AudiusService.test.ts
    ├── ExploreSession.test.ts
    └── KeyboardShortcuts.test.ts
```

`types.ts` holds only data shapes without behavior (`ListOperation`, `SongDetails`, `SongMedia`, `LoadedTrack`, `LyricLine`, `Lyrics`, `LyricsResult`, `StoredState`, `Preferences`, `AudiusResult`, …).
`lyrics.ts` holds only pure lyrics functions (`parseLrc`, `toLyrics`, `instrumentalLyrics`, `sortByTime`, `cleanSearchTitle`, `activeLineIndex`); `lyrics.test.ts` tests them with invented text only.
`LyricsService.ts` calls LRCLIB with title, artist, album and duration only; `AudiusService.ts` calls the Audius API only (trending and search); no other code calls the network.
`icons.ts` holds the SVG string constants and the only helpers allowed to turn them into elements (`createIcon`, `createIconButton`, `createLabeledButton`, `setButtonIcon`), plus `setCover`, the shared cover renderer (cover image or generic music icon) used by `PlayerBarView` and `TrackListView`; this is the only place where `innerHTML` is used, and only with those constants.
`format.ts` holds only pure functions (`formatTime`, `formatElapsed`, `formatTotal`, `countLabel`, `comparableText`, `clampPanelWidths`, `coverToneIndex`, `coverInitial`, …); `format.test.ts` tests every one of them.
`queueItem.ts` holds the one queue-item renderer shared by `NowPlayingView` and `NowPlayingPanelView`; `trackRow.ts` holds the one track-row and column-header renderer shared by `TrackListView` and `ExploreView`.
`fileInput.ts` creates the hidden file inputs; `droppedFiles.ts` reads files and folders dropped from the operating system (`webkitGetAsEntry`, recursive); `audius.ts` holds the Audius constants and URL builders.
`PlaylistStorage.ts` wraps `localStorage` (state and preferences); `AudioStore.ts` wraps IndexedDB (the stored media of each song, never sent anywhere).
`NowPlayingPanelView.ts` is the "Sonando" tab of the right column; `StructurePanelView.ts` owns the right column and its "Estructura" tab.
`DialogView.ts` builds the native `<dialog>` forms; `AddToPlaylistDialogView` (one song, choose destination), `AddSongsDialogView` (several Library songs, fixed destination) and `PlacementFieldsView` (Inicio / Final / Posición) are the shared add dialogs; `ShortcutsDialogView` lists the shortcuts.
`PlaylistHeaderView.ts` is the header of a playlist (generated cover, counts, actions); `ExploreView.ts` is the "Explorar" screen and `ExploreSession.ts` its state (query, genre, results playlist, request ordering).
`RowDragController.ts`, `DropIndicator.ts` and `FileDropZone.ts` implement drag and drop (row reorder, drop on a playlist, files from the operating system); `PanelLayoutView.ts` and `PanelSplitterView.ts` implement the resizable panels.
`KeyboardShortcuts.ts` owns the key map: one list of shortcuts drives both the handling and the help dialog, and calls the same `App` handlers as the buttons.
No other folders. `public/` only if a static asset becomes necessary, and only after asking.

## 6. Dependency direction

Views → App → (PlaylistManager, SongLoader, MusicPlayer, PlaylistStorage) → Playlist → TrackedLinkedList → DoublyLinkedList → Node.
`Node.value` references a `Song`.
Model and data-structure classes never touch the DOM. Views never talk to each other and never call the model directly; they report user actions to `App`.

## 7. Design patterns (only these four)

- Singleton: `MusicPlayer` (private constructor, `static getInstance()`), one audio element for the whole app.
- Decorator: `TrackedLinkedList` implements `LinkedList<T>`, wraps another `LinkedList<T>`, delegates every operation and records a `ListOperation`.
- Prototype: `Playlist.clone(name)` deep-copies the structure: new nodes, same `Song` references, empty history, no current node. `Playlist.shuffledCopy` builds on it for shuffle.
- Adapter: `AudiusTrackAdapter` converts an unknown Audius track object (Adaptee) into a `Song` (Target); `AudiusService` is the Client.

Do not add other patterns.

## 8. Testing

- Run `npm run build` and `npm test` after every change. Both must pass with zero errors.
- Data-structure tests must check link integrity after every operation: `head.prev === null`, `tail.next === null`, `length` equals the forward count, and the backward traversal is exactly the reverse of the forward traversal.
- For UI work, run the dev server and verify behavior manually; describe what you checked.

## 9. Final report (required at the end of every stage)

1. What was developed.
2. Files created.
3. Files modified.
4. Features implemented.
5. Tests executed (commands and results).
6. Tests that passed.
7. Errors found.
8. Errors fixed.
9. Pending issues or doubts.
10. Recommended next step.

Never answer only "Done". Do not commit. The student reviews, commits and pushes.
