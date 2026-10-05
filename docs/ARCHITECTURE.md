# ARCHITECTURE — Musongs

## 1. Layers

| Layer | Files | Knows the DOM? |
|---|---|---|
| Data structure | `Node`, `LinkedList`, `DoublyLinkedList`, `TrackedLinkedList` | No |
| Model | `Song`, `Playlist`, `PlaylistManager` | No (except `Song` creating object URLs) |
| Browser services | `SongLoader`, `MusicPlayer`, `PlaylistStorage`, `LyricsService` | Browser APIs only, no page elements |
| Coordination | `App` | Through views only |
| Views | `SidebarView`, `TrackListView`, `PlayerBarView`, `NowPlayingView`, `StructurePanelView`, `NotificationView`, `DialogView` | Yes |
| Support | `types.ts`, `icons.ts`, `format.ts`, `lyrics.ts`, `main.ts`, `styles.css` | — |

Dependency direction: Views → App → services and model → Playlist → TrackedLinkedList → DoublyLinkedList → Node. `Node.value` → `Song`.

## 2. Classes

### Song
- Fields: `id`, `title`, `artist`, `album`, `duration` (seconds), `fingerprint`, `coverUrl: string | null`, `sourceUrl: string | null`, `coverType: string | null` (MIME type of the cover), `lyricsFile: File | null` (paired `.lrc`), `embeddedLyrics: Lyrics | null`. The last three are read-only getters.
- Built from `SongDetails` (`types.ts`); may start without a file (restored from storage).
- `attachFile(media: SongMedia)` with `SongMedia = { file, cover, coverType, lyricsFile, embeddedLyrics }` (`LoadedTrack` extends it): creates object URLs for audio and cover and keeps the cover type and both lyrics sources.
- `isAvailable()`: `sourceUrl !== null`.
- `release()`: revokes object URLs, clears the cover type and lyrics sources, and marks the song unavailable.
- `id` from `crypto.randomUUID()`. Fingerprint: `${file.name}|${file.size}|${file.lastModified}`.
- `duration` is read through a getter. `updateDuration(seconds)` completes it only when the stored duration is 0 and the new value is finite and positive (used by `MusicPlayer` when metadata had no duration).
- `artist` and `album` may be empty strings; the views choose the fallback text (for example "Artista desconocido").

### Playlist
- Fields: `id`, `name`, `isLibrary` (readonly), the decorated list, `current: Node<Song> | null`.
- Mutations: `addAtStart(song)`, `addAtEnd(song)`, `addAtPosition(song, position)`, `removeAtPosition(position)`, `removeNode(node)`, `removeAllOf(song)`, `rename(name)`.
- Navigation: `select(node)`, `next()`, `previous()`, `hasNext()`, `hasPrevious()`, `selectFirst()` / `selectLast()` (set `current` to `head` / `tail` and return it; `null` and no change when empty). The list is never circular: `head.prev` and `tail.next` stay `null`; wrapping for "repeat all" is decided by `MusicPlayer`, not by the list.
- Reading: `nodes()` (forward generator), `length`, `contains(song)`, `history`, `lastOperation` (both typed `ListOperation<Song>`, read-only views of the Decorator's log), `totalDuration()`.
- Prototype: `clone(name)`.
- Every removal keeps `current` valid using the rule in `DATA_STRUCTURE.md` section 7.

### PlaylistManager
- `library: Playlist` (name "Biblioteca", `isLibrary = true`).
- `playlists: Map<string, Playlist>` (insertion order = display order). The set of playlists is not required to be a linked list; each playlist is.
- `visiblePlaylistId`.
- `createPlaylist(name)`: trimmed, 1–40 characters, unique ignoring case and accents; otherwise throws with a reason the UI can show. Names are compared with `comparableText` from `format.ts` (the same normalization the list search uses; "ñ" stays distinct from "n").
- `renamePlaylist`, `deletePlaylist` (never the Library), `getPlaylist(id)`, `allPlaylists()`.
- `addTracks(tracks: LoadedTrack[])`: for each track, find a Library song with the same fingerprint: available → count as duplicate; unavailable → `attachFile(track)` (reconnection, with the new cover type and lyrics); none → new `Song`, `attachFile(track)`, `library.addAtEnd`. Returns counts `{ added, reconnected, duplicated }`.
- `removeSongEverywhere(song)`: `removeAllOf` in every playlist and the Library, then `song.release()`.
- `duplicatePlaylist(id)`: `clone` with the name "<name> (copia)", made unique.
- `toStoredState()` and `restore(state)` for persistence.

### SongLoader
- `constructor(canPlay)`: an injected playability probe `(mimeType) => boolean`. The default uses a detached audio element's `canPlayType` (true when the result is not empty). Tests inject their own probe and run in Node.
- `load(files: Iterable<File>): Promise<LoadResult>` with `LoadResult = { tracks: LoadedTrack[]; rejected: RejectedFile[]; ignored: number }` and `RejectedFile = { name; reason: 'unsupported-format' }` (`types.ts`).
- Classification per file:
  - Audio candidate: MIME starts with `audio/` or the extension is one of mp3, m4a, aac, wav, ogg, oga, opus, flac, webm, wma.
  - `.lrc` file: paired with the audio file that has the same base name (case-insensitive) in the same folder (directory of `webkitRelativePath`, or no folder for loose files). Paired `.lrc` files become `LoadedTrack.lyricsFile` and are not counted; unpaired ones (or a second `.lrc` with the same key) count as `ignored`. Several audio files with the same base name share the `.lrc`. The "Cargar canciones" picker accepts `audio/*,.lrc`.
  - Not a candidate (covers, text files inside a folder): counted in `ignored`, no message per file.
  - Candidate whose MIME (or the MIME inferred from the extension when `file.type` is empty) fails the probe: `rejected` with `unsupported-format`.
  - Otherwise: a `LoadedTrack`.
- Order: input files are sorted in natural order by `webkitRelativePath` when present, else by name (`localeCompare` with `numeric: true`, `sensitivity: 'base'`), so "2 - b" comes before "10 - a". Sorting the incoming `File` objects is allowed: it is input, not a song collection.
- Metadata with `music-metadata`, loaded with a dynamic `import()` so it is a separate chunk, parsing the `File` as a `Blob` (browser entry, no Node polyfills), covers included.
  - Title: tag title, else the file name without extension.
  - Artist and album: tag values or `""`. No Spanish text in the loader.
  - Duration: `format.duration` when finite and positive, else 0; `MusicPlayer` completes it from the audio element.
  - Cover: first picture as a `Blob` with its MIME type, else `null`. `coverType` is that MIME type (bare formats such as `jpg` or `png` become `image/jpeg` / `image/png`).
  - Embedded lyrics (`common.lyrics`): the first tag that yields text. Millisecond `syncText` → synced lines; otherwise its `text` goes through `parseLrc` (LRC timestamps → synced, plain text → unsynced). Nothing usable → `null`. Source `'embedded'`.
  - A parse failure never rejects the file: file-name title, empty strings, duration 0, no cover.
- Fingerprint with `Song.fingerprintOf(file)`.
- Concurrency limit of 4 while preserving the sorted order in the result.
- Never reads files from paths, only from user-provided `File` objects.

### MusicPlayer (Singleton)
- `private static instance`, `private constructor`, `static getInstance()`. The constructor creates the only playback `HTMLAudioElement` (`preload = "metadata"`) and registers its events.
- Private state: `context: Playlist | null`, `loadedSong: Song | null`, `volume` (0–1, default 0.8), `muted`, `repeatMode: RepeatMode` (`'off' | 'all' | 'one'`, default `'off'`).
- `context` is exposed read-only through a getter. It is the single source of truth for the playback context: `App` and the views ask the player instead of tracking it.
- Listener setters, one listener each (a new call replaces the previous one): `onStateChange(callback(state: PlayerState))`, `onProgress(callback(currentTime, duration))`, `onError(callback(code: PlayerErrorCode, song))`.
- `getState(): PlayerState` built from `context.current`, the audio element and the private state, including `repeatMode`. `hasNext` / `hasPrevious` come from the context playlist, and are also `true` at the edges when `repeatMode` is `'all'` and the context has at least one song.
- `playFrom(playlist, node)`: `playlist.select(node)`, the playlist becomes the context, plays the current song.
- `togglePlayPause()`: if nothing is loaded and the context has a current song, loads and plays it; otherwise toggles.
- `next()` / `previous()`: only through `context.next()` / `context.previous()`; a returned node is loaded and played. When they return `null` (at `tail` / `head`) and `repeatMode` is `'all'`, the player calls `context.selectFirst()` / `context.selectLast()` and plays that node; otherwise nothing happens.
- `ended`: `'one'` → `currentTime = 0` and play the same song; else if a next song exists (including the wrap of `'all'`) → `next()`; else pause, keep the last song as current, `currentTime = 0`, notify state.
- `setRepeatMode(mode)` and `cycleRepeatMode()` (`off → all → one → off`) notify state. All wrapping logic lives only in `MusicPlayer`.
- `seek(seconds)` clamped to [0, duration]. `setVolume(value)` clamped to [0, 1]; a value above 0 while muted unmutes. `toggleMute()`.
- `refresh()` after the context playlist changed: `context.current` null → stop and unload; a different song than the loaded one → load it and keep playing only if it was playing; otherwise only notify state.
- `stop()`: pause and `currentTime = 0`. `clearContext()`: stop, unload the source (`removeAttribute("src")` then `load()`), context and loaded song become `null`.
- Errors (`PlayerErrorCode`): loading an unavailable song → `onError('unavailable', song)` without changing the source. Audio `error` event → pause and `onError('playback-failed', loadedSong)`; never auto-skip.
- The promise from `audio.play()` is handled: `AbortError` (fast switching) is ignored; a rejection caused by a media error is left to the `error` event so it is reported once; other rejections → `playback-failed`.
- `loadedmetadata` → `loadedSong.updateDuration(audio.duration)` and notify state.
- State notified on play, pause, ended, volume change, source change and repeat change; progress notified on `timeupdate`.
- Media Session (only when `"mediaSession" in navigator`): `loadSong` sets `MediaMetadata` (title, artist, album, and the cover object URL as artwork when the song has one, with `type` set to `song.coverType` when known). Action handlers `play`, `pause`, `previoustrack`, `nexttrack`, `seekto`, `seekbackward`, `seekforward` (10 s by default) call the same methods as the UI (`togglePlayPause`, `previous`, `next`, `seek`); each registration is wrapped so a browser that does not support one action skips it. `playbackState` follows play/pause, and `setPositionState` is updated on `loadedmetadata`, `seeking`, `play` and `pause` only when the duration is finite and positive (position clamped to it). Unloading (`clearContext`, or `refresh` with no current song) clears metadata, sets `playbackState = "none"` and clears the position state.

### lyrics.ts (pure functions, tested in `lyrics.test.ts`)
- `parseLrc(text): LyricLine[]`: `[mm:ss]`, `[mm:ss.xx]`, `[mm:ss.xxx]`, several timestamps on one line (the line is repeated), enhanced-LRC word stamps removed, metadata tags (`[ar:]`, `[ti:]`…) ignored and `[offset:±ms]` applied (positive = earlier, never below 0), sorted by time, text trimmed, empty timed lines kept as spacers. If no line has a timestamp, every line becomes unsynced (`time: null`), keeping inner blank lines as spacers.
- `toLyrics(lines, source)`: `Lyrics` (`synced` when any line has a time) or `null` when every line is empty. `instrumentalLyrics(source)`. `sortByTime(lines)`.
- `cleanSearchTitle(title, artist)`: removes noise such as "(Official Video)", "[Official Music Video]", "Lyric Video", "Lyrics", "Audio", "HD", "4K", "Remastered 2011", bracketed or trailing; removes a leading "<artist> - " that matches the artist with `comparableText`; with an empty artist, splits "Artist - Title". Never returns an empty title.
- `activeLineIndex(lines, seconds)`: index of the last synced line whose time ≤ seconds, -1 before the first.

### LyricsService
- `constructor(fetchFn = global fetch)`; tests inject a fake.
- `getLyrics(song): Promise<LyricsResult>` with `LyricsResult = { status: 'found'; lyrics } | { status: 'not-found' } | { status: 'error' }`. Never rejects.
- Priority: `song.lyricsFile` (read as text, `parseLrc`, source `'file'`; empty or unreadable → next) → `song.embeddedLyrics` → LRCLIB.
- LRCLIB (`https://lrclib.net/api`), plain `GET` without custom headers (no CORS preflight), aborted after 10 s:
  1. `get?artist_name&track_name[&album_name][&duration]` with the cleaned title and artist; album only when not empty, duration rounded and only when > 0. Skipped when no artist is known.
  2. On 404 (or a record without lyrics): `search?track_name[&artist_name]`; the result with lyrics whose duration is closest wins, only within 5 s when the song duration is known (first result with lyrics otherwise).
  - `syncedLyrics` preferred over `plainLyrics`; `instrumental: true` → `Lyrics` with `instrumental: true` and no lines; nothing usable → `not-found`. Any other status (LRCLIB answers 503 when overloaded), network failure, timeout or invalid JSON → `error`.
- Cache per `song.id` in memory for `found` and `not-found`; `error` is not cached so "Reintentar" asks again. Concurrent calls for the same song share one promise.
- Sends only title, artist, album and duration. Never audio, file names or file contents.

### PlaylistStorage
- Keys: `musongs.state.v1` (structure) and `musongs.preferences.v1` (volume, structure panel open).
- `saveState(state)`, `loadState(): StoredState | null`, `savePreferences`, `loadPreferences`.
- Corrupt or invalid JSON → returns `null` and the app starts empty. Quota errors are caught and reported once.

### App
- Creates the manager, loader, player (via `getInstance`), storage and views.
- Receives every user action from the views, calls the model or player, saves state when the structure changed, then calls `render()`.
- `render()` redraws the views from the current model. Progress updates only call `PlayerBarView.updateProgress` (no full redraw every tick).
- Player state changes call `PlayerBarView.render` (both instances), `NowPlayingView.render`, `TrackListView.setPlayback`, `SidebarView.setPlayback` (highlight only, no list rebuild) and `StructurePanelView.render(visiblePlaylist, context)`, and update `document.title`. `render()` ends by calling the same method, so the panel also follows every model change. Progress calls `updateProgress` on both player bars and on `NowPlayingView`, never the structure panel.
- Structure panel: `PlayerBarView.onToggleStructure` → `App.toggleStructure()`: if "Reproduciendo ahora" is open it is closed and the panel is opened; otherwise the panel toggles. `StructurePanelView.onVisibilityChange` → `setStructureOpen` on both player bars. A click on a node card → `playFrom(playlist, node)`.
- Lyrics: `NowPlayingView.onLyricsRequested(song)` → `LyricsService.getLyrics(song)` → `NowPlayingView.showLyrics(song, result)` (ignored if the song changed meanwhile).
- Reads the playback context from `MusicPlayer.context` (it does not keep its own copy). The context only changes through `App` calls (`playFrom` sets it, `clearContext` clears it). The highlighted node is `context.current`, so only the context playlist shows a current row.
- Playlist play button: if the playlist is the context → `togglePlayPause()`; otherwise `playFrom(playlist, node)` with the first available node found by forward traversal (the head when none is available, so the usual "unavailable" message appears).
- After a mutation of the context playlist (add or remove) calls `player.refresh()` so `hasNext` / `hasPrevious` and the loaded song stay correct. `removeSongEverywhere` refreshes whenever there is a context. Deleting the context playlist calls `clearContext()` first.
- Name validation: the create and rename handlers return `PlaylistNameIssue | null` synchronously (from `checkName`); the view shows the Spanish message.
- Translates thrown errors into Spanish messages through `NotificationView`.

### Views
Each view receives its root element from `index.html` by id, builds content with DOM APIs, and exposes handler setters (for example `onPlaylistSelected(callback)`). Event delegation inside each view. Views read the `Playlist` objects they render (name, `length`, `nodes()`) but never mutate the model or call the player.

- `SidebarView`: brand, Library entry, playlists (with the playing context marked), "Nueva playlist" dialog, "Cargar canciones", "Cargar carpeta" (hidden file inputs, reset after each selection), mobile top bar menu button and drawer (Escape and backdrop close it).
- `TrackListView`: header (name, count, total duration, playlist actions "Agregar canción", "Renombrar", "Eliminar playlist", the round play button and the search box), rows rendered by traversing `playlist.nodes()`, empty states. The header elements are built once and updated in place, so a re-render never steals focus from the search box. Search is presentation only: it traverses `playlist.nodes()` and toggles `hidden` on each row (title, artist or album contain the query after `comparableText`); it never modifies or copies the list, rows keep their real positions, and next/previous keep following the real links. It shows "N de M canciones", an empty result with "Limpiar búsqueda", Escape clears it, and switching playlists resets it. Each row keeps its `Node<Song>` in a `WeakMap`, so play and remove use the node directly (`playFrom(playlist, node)`, `removeNode(node)`). Owns the add-song dialog (two modes), rename, confirm delete playlist and confirm remove from Library.
- `PlayerBarView`: cover, title, artist, the "Abrir reproduciendo ahora" button (chevron; `aria-expanded`, label and icon change while the view is open; a click on the cover or title does the same; on phones it lies transparently over the cover), previous, play/pause, next, repeat (cycles the three modes; Spanish aria-label per mode), progress with seek, current time and duration, the structure panel toggle (linked-nodes icon, `aria-pressed`, "Mostrar estructura" / "Ocultar estructura", accent while pressed; visible on every size), volume, mute. `App` creates a second instance inside `NowPlayingView.controlsSlot` for the large mobile controls, so the control logic is not duplicated; CSS hides its cover and volume.
- `NowPlayingView`: region `#now-playing`. Receives its root, the app shell and the regions it covers (top bar, sidebar, drawer backdrop, main), which become `inert` while it is open. Opened and closed through `App` (player bar button, cover or title); also closes with its close button and Escape; focus goes to the close button on open and back to the previous element on close. Closes itself when nothing is loaded. Shows the large cover, title, artist (or "Artista desconocido"), album and "Reproduciendo desde «lista»". Tabs "A continuación" / "Letra" (`tablist` / `tab` / `tabpanel`, arrows, Home and End).
  - Queue: traverses from `context.current.next` following `next`, rendering up to 25 items and counting the rest ("y N más"); "Anteriores" is a `<details>` that traverses from `current.prev` following `prev` (up to 10, nearest first). Each item's node is kept in a `WeakMap`; a click reports the node and `App` calls `playFrom(context, node)`. Notes: repeat `'all'` → "Luego vuelve al inicio"; otherwise, nothing next → "Es la última canción". The queue is rebuilt only while open and only when the current node, the context, the repeat mode or the context contents change (`App.render` invalidates it).
  - Lyrics: requested through `App` only while the view is open on the "Letra" tab, once per song. States: loading, synced (one button per line; the active line is highlighted and scrolled to the middle of the lyrics box, instantly under reduced motion; a click seeks to the line; wheel, touch, scrollbar or scroll keys pause auto-scroll for 4 s), unsynced (static lines), instrumental, not found, error with "Reintentar". Source note under the lyrics. All text through `textContent`.
  - `updateProgress(currentTime)` only moves the active lyric line; nothing else is rebuilt on progress.
- Covers in `PlayerBarView` and `TrackListView` are drawn by the shared `setCover` helper in `icons.ts`.
- `DialogView`: builds one native `<dialog>` form (title, fields, inline error, "Cancelar" and confirm). The confirm handler returns an error message or `null` to close. Used by `SidebarView` and `TrackListView` so the dialog logic is not duplicated.
- `StructurePanelView`: region `#structure-panel` plus `#structure-backdrop`. Shows the doubly linked list of the **visible** playlist. Visible by default from 1100px (right column); hidden by default below (overlay from the right on tablets, bottom sheet on phones). Crossing the 1100px breakpoint resets it to that default (the preference is not persisted yet).
  - `render(playlist, context)` returns immediately when the playlist, its name, its `lastOperation` and the current node (only when the playlist is the context) are all unchanged, so play/pause, volume and progress never rebuild it.
  - Summary `length = N · head = … · tail = …`; node cards with `[i]`, title, `prev:` / `next:` (title or `null`) and the tags `head`, `tail`, `current`; connectors "next ↓ / ↑ prev" between cards; the `prev` and `next` neighbors of `current` drawn dashed. A card click reports `(playlist, node)` to `App`.
  - Window: focus = `current` when the playlist is the context, else `head`. From the focus it walks `prev` up to 15 steps (the start node and the number of steps), gets the focus index with one forward traversal (`positionOf`), then walks `next` from the start for at most steps + 1 + 15 nodes. "… N nodos antes" = start index; "… N nodos después" = `length` − start index − shown. No array of nodes is ever built. The focus card is scrolled into view (smooth, instant under reduced motion).
  - "Última operación": code form (`append()`, `prepend()`, `insert(i)`, `remove(i)`, `removeNode()`, `clear()`, with the 0-based index the decorator recorded) and a Spanish sentence built from the labels. A **new** operation of the same playlist (not a playlist switch, not a re-render) marks `previousNode`, `node` and `nextNode` and every connector whose two ends are marked with `is-changed` (800ms flash; static highlight under reduced motion) and writes the sentence into an `aria-live="polite"` region. Nothing flashes while the panel is closed.
  - "Historial (últimas 6)": a `<details>` with the last six operations of the Decorator's `history`, newest first.
  - Empty list: "Lista vacía · head = null · tail = null" and a short explanation.
  - Escape and the backdrop close it only in overlay mode (Escape is ignored inside dialogs or when another view already handled it). Opening as overlay moves focus to its close button; closing returns focus to the control that opened it.
  - While "Reproduciendo ahora" is open the panel and its backdrop are covered, `inert` and (in overlay mode) hidden.
- `NotificationView`: toasts (about 4 s, close button, `role="status"`, errors `role="alert"`), the persistent "Cargando canciones…" notice, and later the "Reconecta tus archivos" banner.

## 3. Main flows

1. Load: input files/folder → `SongLoader.load` → `PlaylistManager.addTracks` → save → render → toast with counts.
2. Add at position: row button "Agregar a…" (destination chosen) or header button "Agregar canción" (song chosen) → dialog (Inicio/Final/Posición) → `Playlist.addAt…` → refresh player if it is the context → save → render.
3. Play: click row → `MusicPlayer.playFrom(playlist, node)`.
4. Next/previous: player → `context.next()` / `previous()` → load source → play.
5. Remove current: `Playlist.removeNode` handles `current` → if the playlist is the player context → `MusicPlayer.refresh()`.
6. Remove from Library: `PlaylistManager.removeSongEverywhere` → refresh player if affected.
7. Delete playlist: if it is the player context → `clearContext()` first.
8. Startup: `loadState` → `restore` (songs unavailable, lists rebuilt with `append`) → banner if any song is unavailable → user reconnects through the normal load flow.
9. Duplicate: `duplicatePlaylist` → save → render.
10. Play a playlist: header button → `App.playPlaylist` → context? `togglePlayPause()` : `playFrom(playlist, firstAvailableNode)`.
11. Repeat: player bar button → `cycleRepeatMode()` → state notified → button and next/previous availability redrawn. At an edge with `'all'`: `selectFirst()` / `selectLast()` → load → play.
12. Search: input → `TrackListView` traverses `playlist.nodes()` and hides non-matching rows; no call to `App` or the model.
13. Lock screen / media keys: Media Session action → the same `MusicPlayer` method the UI uses.
14. Now playing: player bar → `App` → `NowPlayingView.open()` → queue built from `current.next` / `current.prev`. Queue item → `App` → `playFrom(context, node)`.
15. Lyrics: "Letra" tab (or a song change while it is open) → `App` → `LyricsService` (`.lrc` → embedded → LRCLIB) → `NowPlayingView.showLyrics`. Progress → `activeLineIndex` → highlight.
16. Structure panel: any mutation → `TrackedLinkedList` records a `ListOperation<Song>` with the node references → `App.render()` → `StructurePanelView.render(visible, context)` → new `lastOperation` → rebuild the window, flash the referenced nodes, announce the sentence. Next / previous → player state → `render` → only the `current` tag and neighbors move.

## 4. Persistence format (`StoredState`)

```json
{
  "version": 1,
  "songs": [{ "id": "", "title": "", "artist": "", "album": "", "duration": 0, "fingerprint": "" }],
  "library": ["songId"],
  "playlists": [{ "id": "", "name": "", "songIds": ["songId"] }]
}
```

Lists are serialized by forward traversal into id arrays and rebuilt with `append`. This is the only place where list contents become arrays. Covers and audio are never stored.

## 5. Patterns (defense summary)

| Pattern | Where | Problem solved | Benefit |
|---|---|---|---|
| Singleton | `MusicPlayer` | Two audio elements could play at the same time and disagree on state | One global playback state, one access point |
| Decorator | `TrackedLinkedList` | The structure panel needs an operation log (and which nodes each operation linked), but the list should stay pure | Logging added without touching `DoublyLinkedList`; same interface, interchangeable; each `ListOperation<T>` carries `previousNode`, `node` and `nextNode` read from the real links |
| Prototype | `Playlist.clone` | Duplicating a playlist must not share nodes | Deep copy of structure, shared songs, independent links |

## 6. Security and privacy

- Audio stays local: `File` → `URL.createObjectURL` → `<audio>`. No network requests for audio. No CORS involved (blob URLs are same-origin).
- The only network request with song data is the LRCLIB lyrics lookup: cleaned title and artist, album and rounded duration in the query string, sent only when the "Letra" tab is opened and the song has no local lyrics. LRCLIB allows cross-origin simple `GET` requests; no custom headers are sent.
- User strings rendered with `textContent` only.
- Object URLs revoked when a song leaves the Library.
