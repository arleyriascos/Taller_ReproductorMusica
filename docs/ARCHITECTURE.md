# ARCHITECTURE — Musongs

## 1. Layers

| Layer | Files | Knows the DOM? |
|---|---|---|
| Data structure | `Node`, `LinkedList`, `DoublyLinkedList`, `TrackedLinkedList` | No |
| Model | `Song`, `Playlist`, `PlaylistManager`, `ExploreSession` | No (except `Song` creating object URLs) |
| Browser services | `SongLoader`, `MusicPlayer`, `PlaylistStorage` (localStorage), `AudioStore` (IndexedDB), `LyricsService` (LRCLIB), `AudiusService` + `AudiusTrackAdapter` (Audius), `KeyboardShortcuts` | Browser APIs only, no page elements (`KeyboardShortcuts` listens to `document`) |
| Coordination | `App` | Through views only |
| Views | `SidebarView`, `TrackListView`, `PlaylistHeaderView`, `ExploreView`, `PlayerBarView`, `NowPlayingView`, `NowPlayingPanelView`, `StructurePanelView`, `PanelLayoutView`, `PanelSplitterView`, `NotificationView`, `DialogView`, `AddToPlaylistDialogView`, `AddSongsDialogView`, `PlacementFieldsView`, `ShortcutsDialogView`, `RowDragController`, `DropIndicator`, `FileDropZone` | Yes |
| Support | `types.ts`, `icons.ts`, `format.ts`, `lyrics.ts`, `queueItem.ts`, `trackRow.ts`, `fileInput.ts`, `droppedFiles.ts`, `audius.ts`, `main.ts`, `styles.css` | `icons.ts`, `queueItem.ts`, `trackRow.ts`, `fileInput.ts` and `droppedFiles.ts` touch the DOM or DOM events |

Dependency direction: Views → App → services and model → Playlist → TrackedLinkedList → DoublyLinkedList → Node. `Node.value` → `Song`.

## 2. Classes

### Song
- Fields: `id`, `title`, `artist`, `album`, `duration` (seconds), `fingerprint`, `coverUrl: string | null`, `sourceUrl: string | null`, `coverType: string | null` (MIME type of the cover), `lyricsFile: File | null` (paired `.lrc`), `embeddedLyrics: Lyrics | null`. The last three are read-only getters.
- Built from `SongDetails` (`types.ts`); may start without a file (restored from storage).
- `attachFile(media: SongMedia)` with `SongMedia = { file, cover, coverType, lyricsFile, embeddedLyrics }` (`LoadedTrack` extends it): creates object URLs for audio and cover and keeps the cover type and both lyrics sources.
- `isAvailable()`: `sourceUrl !== null`.
- `release()`: revokes object URLs, clears the cover type and lyrics sources, and marks the song unavailable.
- `id` from `crypto.randomUUID()`. Fingerprint: `${file.name}|${file.size}|${file.lastModified}` for local files and `audius:<trackId>` for Audius songs.
- Remote songs: `attachRemote(streamUrl, coverUrl, pageUrl)` sets `sourceUrl` to the stream, `coverUrl` (or `null`), `coverType = "image/jpeg"` and `pageUrl`; `isRemote` and `pageUrl` are read-only getters. A remote song is always available. `release()` does nothing on a remote song (it never revokes remote URLs and keeps it playable, because the same object can still be listed in "Explorar"); `attachFile` on a remote song turns it into a local one.
- `duration` is read through a getter. `updateDuration(seconds)` completes it only when the stored duration is 0 and the new value is finite and positive (used by `MusicPlayer` when metadata had no duration).
- `artist` and `album` may be empty strings; the views choose the fallback text (for example "Artista desconocido").

### Playlist
- Fields: `id`, `name`, `isLibrary` (readonly), the decorated list, `current: Node<Song> | null`.
- The constructor takes an optional id (used when restoring from storage).
- Mutations: `addAtStart(song)`, `addAtEnd(song)`, `addAtPosition(song, position)`, `removeAtPosition(position)`, `removeNode(node)`, `removeAllOf(song)`, `moveUp(node)`, `moveDown(node)` (both call `moveNode` on the list, do nothing at the edges, and keep `current` on the same node because it is a node reference), `rename(name)`.
- Navigation: `select(node)`, `next()`, `previous()`, `hasNext()`, `hasPrevious()`, `selectFirst()` / `selectLast()` (set `current` to `head` / `tail` and return it; `null` and no change when empty). The list is never circular: `head.prev` and `tail.next` stay `null`; wrapping for "repeat all" is decided by `MusicPlayer`, not by the list.
- Reading: `nodes()` (forward generator), `length`, `contains(song)`, `history`, `lastOperation` (both typed `ListOperation<Song>`, read-only views of the Decorator's log), `totalDuration()`.
- Skipping unavailable songs: `findAvailable(direction, wrap)` walks `next` / `prev` links from `current` for at most `length` steps (one full cycle when `wrap` is true, wrapping through `head` / `tail`) and returns the first available node, or `null`; it never changes `current`.
- Drag and drop: `moveToPosition(node, position)` is the single 1-based conversion point: it validates the node (`Error`) and the position (`RangeError`), does nothing when the position is the same and otherwise calls `moveNode(node, position - 1)`. `moveUp` / `moveDown` also go through it.
- Shuffle: `shuffle(random)` (Fisher–Yates with `moveNode` only), `shuffledCopy(random, anchor)` and `originOf(node)` (see section 6).
- Prototype: `clone(name)`.
- Every removal keeps `current` valid using the rule in `DATA_STRUCTURE.md` section 7.

### PlaylistManager
- `library: Playlist` (name "Biblioteca", `isLibrary = true`).
- `playlists: Map<string, Playlist>` (insertion order = display order). The set of playlists is not required to be a linked list; each playlist is.
- `visiblePlaylistId`.
- `createPlaylist(name)`: trimmed, 1–40 characters, unique ignoring case and accents; otherwise throws with a reason the UI can show. Names are compared with `comparableText` from `format.ts` (the same normalization the list search uses; "ñ" stays distinct from "n").
- `renamePlaylist`, `deletePlaylist` (never the Library), `getPlaylist(id)`, `allPlaylists()`.
- `addTracks(tracks: LoadedTrack[])`: for each track, find a Library song with the same fingerprint: available → count as duplicate; unavailable → `attachFile(track)` (reconnection, with the new cover type and lyrics); none → new `Song`, `attachFile(track)`, added to the Library. Returns counts `{ added, reconnected, duplicated }`.
- `removeSongEverywhere(song)`: `removeAllOf` in every playlist and the Library, then `song.release()`.
- `duplicatePlaylist(id)`: `clone` with the name "<name> (copia)", made unique.
- `addTracks(tracks, onPlaced?, placement?)`: the optional callback receives `(song, track)` for every added or reconnected song (not for duplicates) so `App` can store its media. `placement` is `{ libraryPosition?, destination?: { playlist, position } }`: new songs are inserted in the Library consecutively from `libraryPosition` (default: the end; reconnected and duplicated songs keep their place), and when `destination` is given **every** resulting song (new, reconnected and existing duplicates) is also inserted into that playlist consecutively from `destination.position`.
- `ensureInLibrary(song)`: returns the Library song with the same fingerprint (`isNew = false`) or appends the given song to the Library (`isNew = true`). Adding a remote song to a playlist goes through it first, so the Library always holds every song of every playlist and duplicates are detected by fingerprint.
- `librarySongs()`: forward generator over the Library songs.
- `hasUnavailableSongs()`: forward traversal of the Library.
- `toStoredState()`: forward traversal of the Library and of every playlist into id arrays; the only place where list contents become arrays. `restore(state)`: only into an empty manager; creates every `Song` with its saved id (local songs unavailable, Audius songs restored with `attachRemote` and therefore available) and rebuilds the Library and each playlist with `addAtEnd` (append); an unknown id throws.

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
- Private state: `context: Playlist | null` (the list whose links `next` / `previous` follow), `source: Playlist | null` (the playlist the user chose; equal to `context` unless shuffle is on), `isShuffled`, `loadedSong: Song | null`, `volume` (0–1, default 0.8), `muted`, `repeatMode: RepeatMode` (`'off' | 'all' | 'one'`, default `'off'`).
- `context`, `source` and `isShuffled` are exposed read-only through getters. They are the single source of truth for the playback context: `App` and the views ask the player instead of tracking it. Views highlight `source.current` (the shuffled copy keeps the original's `current` in sync through `originOf`).
- Listener setters, one listener each (a new call replaces the previous one): `onStateChange(callback(state: PlayerState))`, `onProgress(callback(currentTime, duration))`, `onError(callback(code: PlayerErrorCode, song))`.
- `getState(): PlayerState` built from `context.current`, the audio element and the private state, including `repeatMode`. `hasNext` / `hasPrevious` are true when `context.findAvailable(direction, repeatMode === 'all')` finds a node, so unavailable songs never enable a button that would do nothing.
- `playFrom(playlist, node)`: if the song is unavailable, reports `onError('unavailable', song)` and returns **before** selecting anything (`current` and the context do not change). If `playlist` is already the context the node is just selected (and mirrored into `source`); otherwise `playlist` becomes the `source` and the context is the playlist itself, or a fresh shuffled copy anchored at `node` when shuffle is on. Then the song plays.
- `togglePlayPause()`: if nothing is loaded and the context has a current song, loads and plays it; otherwise toggles.
- `next()` / `previous()`: only through `context.findAvailable(direction, wrap)`, which follows the links and skips unavailable songs; the returned node is selected and played. `wrap` is true only for repeat `'all'`, and the search stops after one full cycle, so when nothing else is available nothing happens (playback stops at the end).
- `ended`: `'one'` → `currentTime = 0` and play the same song; else if an available next song exists (including the wrap of `'all'`) → `next()`; else pause, keep the last song as current, `currentTime = 0`, notify state.
- `setRepeatMode(mode)` and `cycleRepeatMode()` (`off → all → one → off`) notify state. All wrapping logic lives only in `MusicPlayer`.
- `setShuffle(isOn)` / `toggleShuffle()`: turning it on replaces the context with `source.shuffledCopy(random, source.current)`; turning it off restores `source` (its `current` already points to the playing song). `refresh()` first rebuilds the shuffled copy from `source`, so a structural change of the original keeps shuffle on and keeps the current song.
- `seek(seconds)` clamped to [0, duration]; `seekBy(offset)` and `changeVolume(delta)` serve the keyboard shortcuts. `setVolume(value)` clamped to [0, 1]; a value above 0 while muted unmutes. `toggleMute()`, `setMuted(isMuted)` (used to restore the preference).
- `refresh()` after the context playlist changed: `context.current` null → stop and unload; a different song than the loaded one → load it and keep playing only if it was playing; otherwise only notify state.
- `stop()`: pause and `currentTime = 0`. `clearContext()`: stop, unload the source (`removeAttribute("src")` then `load()`), context and loaded song become `null`.
- Errors (`PlayerErrorCode`): loading an unavailable song → `onError('unavailable', song)` without changing the source. Audio `error` event → pause and `onError('playback-failed', loadedSong)`; never auto-skip (for a remote song `App` shows "No se pudo reproducir esta canción de Audius").
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
- `localStorage`, injectable for tests. Keys: `musongs.state.v1` (structure, `StoredState`) and `musongs.preferences.v1` (`Preferences`: `volume`, `muted`, `repeatMode`, `rightColumnOpen`, `rightColumnTab`, `panelWidths`, `shuffle`; old preferences without the last two still load, with the defaults 240 / 340 and `false`).
- `saveState(state)`, `loadState(): StoredState | null`, `savePreferences`, `loadPreferences`, `clear()`.
- Loading migrates a version 1 state to version 2 (every song gets `source: "local"`) and validates the shape: version 2, song fields and types (an `audius` song needs `https` `streamUrl` and `pageUrl`, and `coverUrl` `https` or `null`), unique song ids, and every id of the Library and of the playlists must exist in `songs`; preferences must be in range. Corrupt, invalid or missing data → `null` and the app starts empty.
- Access and quota errors are caught; `onFailure(callback)` is called once.

### AudioStore
- IndexedDB, database `musongs`, object store `media` keyed by song id, raw API wrapped in promises, no dependencies. The factory is injectable for tests. Remote songs never reach it: `reattach(songs)` and `forget(song)` skip them.
- `put(songId, media: StoredMedia)`, `get(songId)`, `delete(songId)`, `clear()`, `usage(): { songs, bytes } | null`. A `StoredMedia` holds `file`, `cover`, `coverType`, `lyricsFile` and `embeddedLyrics`; `File` and `Blob` values are stored natively.
- Calls `navigator.storage.persist()` once after opening the database, when available, so the browser is less likely to evict the data.
- Every failure (IndexedDB missing, private mode, quota exceeded, blocked) is caught: the call resolves with `null` and `onFailure(callback)` is called once. The app keeps working and falls back to reconnection.

### App
- Creates the manager, loader, player (via `getInstance`), `PlaylistStorage`, `AudioStore` and views.
- `start()` is asynchronous: it binds the views, restores the session (below) and renders once.
- Startup restore: `loadState` → `PlaylistManager.restore`; then `AudioStore.reattach(library songs)` (local songs only: `get(song.id)` → `song.attachFile(media)`), so songs with stored media are available again and the rest stay unavailable; then `loadPreferences` → volume, mute, repeat mode, shuffle, right column open state and tab, panel widths. Saving preferences is suspended while restoring.
- Saving: after every structural change (create, rename, delete, duplicate, add, move, remove, load files) `saveStructure()` stores `toStoredState()`; `savePreferences()` runs on every player state change and on column open / tab changes and writes only when the preferences differ from the last saved ones.
- Media: after `addTracks`, the `onPlaced` callback stores each added or reconnected song's media in `AudioStore` (duplicates are not stored); removing a song from the Library deletes its media. The sidebar footer is refreshed from `AudioStore.usage()` after loading, removing and on startup.
- Banner: `render()` shows the "Reconecta tus archivos" banner while `hasUnavailableSongs()`; its button opens the folder picker.
- "Borrar datos guardados": `clearContext()`, `AudioStore.clear()`, `PlaylistStorage.clear()`, then reloads the page (saving is suspended meanwhile).
- Storage failures are reported once per store through a toast; nothing else changes.
- Receives every user action from the views, calls the model or player, saves state when the structure changed, then calls `render()`.
- `render()` redraws the views from the current model. Progress updates only call `PlayerBarView.updateProgress` (no full redraw every tick).
- Player state changes call `PlayerBarView.render` (both instances), `NowPlayingView.render`, `TrackListView.setPlayback`, `SidebarView.setPlayback` (highlight only, no list rebuild) and `StructurePanelView.render(visiblePlaylist, context)`, and update `document.title`. `render()` ends by calling the same method, so the panel also follows every model change. Progress calls `updateProgress` on both player bars and on `NowPlayingView`, never the structure panel.
- Explorar: `ExploreSession` (query, genre, results, request ordering) notifies `App`, which renders `ExploreView`. The visible area is `#main` (`TrackListView`) or `#explore` (`ExploreView`), never both. "Reproducir" a result → `playFrom(session.playlist, node)`. Adding a result → `addSong` → `PlaylistManager.ensureInLibrary` → place in the destination. While Explorar is visible the "Estructura" tab shows the results playlist.
- Right column: `PlayerBarView.onToggleRightColumn` → `App.toggleRightColumn()`: if "Reproduciendo ahora" is open it is closed and the column is opened; otherwise the column toggles. `StructurePanelView.onVisibilityChange` → `setRightColumnOpen` on both player bars (and saves the preference). A click on a node card → `playFrom(playlist, node)`. `NowPlayingPanelView` actions: a neighbor card or queue item → `playFrom(context, node)`; expand → `NowPlayingView.open()`; "Ver todo" → `NowPlayingView.open("queue")`.
- Move: `TrackListView.onMoveNode(playlistId, node, direction)` → `Playlist.moveUp` / `moveDown` → refresh the player if it is the context → save → render.
- Duplicate: `TrackListView.onDuplicatePlaylist(id)` → `PlaylistManager.duplicatePlaylist` → the copy becomes visible → save → toast "Se creó «nombre»".
- Lyrics: `NowPlayingView.onLyricsRequested(song)` → `LyricsService.getLyrics(song)` → `NowPlayingView.showLyrics(song, result)` (ignored if the song changed meanwhile).
- Reads the playback state from `MusicPlayer` (it does not keep its own copy). `context` feeds the queue views (the shuffled order when shuffle is on); `source` feeds the row highlight, the sidebar mark and the "is this the playing playlist" checks, so only the source playlist shows a current row. "Estructura" shows the shuffled copy while the visible playlist is the shuffle's source.
- Keyboard shortcuts call the same handlers as the buttons (`MusicPlayer` methods and the `App` toggles); there is no second implementation of any action.
- Playlist play button: if the playlist is the context → `togglePlayPause()`; otherwise `playFrom(playlist, node)` with the first available node found by forward traversal (the head when none is available, so the usual "unavailable" message appears).
- After a mutation of the context playlist (add or remove) calls `player.refresh()` so `hasNext` / `hasPrevious` and the loaded song stay correct. `removeSongEverywhere` refreshes whenever there is a context. Deleting the context playlist calls `clearContext()` first.
- Name validation: the create and rename handlers return `PlaylistNameIssue | null` synchronously (from `checkName`); the view shows the Spanish message.
- Translates thrown errors into Spanish messages through `NotificationView`.

### Views
Each view receives its root element from `index.html` by id, builds content with DOM APIs, and exposes handler setters (for example `onPlaylistSelected(callback)`). Event delegation inside each view. Views read the `Playlist` objects they render (name, `length`, `nodes()`) but never mutate the model or call the player.

- `SidebarView`: brand, the "Descubrir" group with "Explorar", Library entry, playlists (user playlists carry `data-drop-playlist` so a dragged row can be dropped on them) (with the playing context marked), "Nueva playlist" dialog, "Cargar canciones", "Cargar carpeta" (hidden file inputs, reset after each selection), mobile top bar menu button and drawer (Escape and backdrop close it). Footer: `setStorageUsage(usage)` writes "N canciones en este navegador · X MB" (hidden when `null`) and "Borrar datos guardados" opens a confirmation dialog built with `DialogView`; the confirmation is reported through `onClearData`.
- `TrackListView`: header from `PlaylistHeaderView` (generated cover, name, "N canciones · M min", play, "Aleatorio", "Agregar canciones", "Importar aquí", "Duplicar", "Renombrar", "Eliminar playlist" and the search box), rows from `trackRow.ts` rendered by traversing `playlist.nodes()`, empty states. Rows have "Subir" and "Bajar" buttons (disabled when `node.prev` / `node.next` is `null`, hidden while a search filter is active) next to "Agregar" and remove. Unavailable songs get a muted row with "Archivo no disponible". The header elements are built once and updated in place, so a re-render never steals focus from the search box. Search is presentation only: it traverses `playlist.nodes()` and toggles `hidden` on each row (title, artist or album contain the query after `comparableText`); it never modifies or copies the list, rows keep their real positions, and next/previous keep following the real links. It shows "N de M canciones", an empty result with "Limpiar búsqueda", Escape clears it, and switching playlists resets it. Each row keeps its `Node<Song>` in a `WeakMap`, so play and remove use the node directly (`playFrom(playlist, node)`, `removeNode(node)`). Owns the rename, delete and remove-from-Library dialogs and uses `AddToPlaylistDialogView` (one song) and `AddSongsDialogView` (several songs, fixed destination). Drag and drop: `RowDragController` (reorder with `Playlist.moveToPosition`, drop on a sidebar playlist), `FileDropZone` (files and folders from the operating system) and `DropIndicator` (the insertion line).
- `PlayerBarView`: cover, title, artist, the "Abrir reproduciendo ahora" button (chevron; `aria-expanded`, label and icon change while the view is open; a click on the cover or title does the same; on phones it lies transparently over the cover), previous, play/pause, next, repeat (cycles the three modes; Spanish aria-label per mode), progress with seek, current time and duration, the structure panel toggle (linked-nodes icon, `aria-pressed`, "Mostrar estructura" / "Ocultar estructura", accent while pressed; visible on every size), volume, mute. `App` creates a second instance inside `NowPlayingView.controlsSlot` for the large mobile controls, so the control logic is not duplicated; CSS hides its cover and volume.
- `NowPlayingView`: region `#now-playing`. Receives its root, the app shell and the regions it covers (top bar, sidebar, drawer backdrop, main), which become `inert` while it is open. Opened and closed through `App` (player bar button, cover or title); also closes with its close button and Escape; focus goes to the close button on open and back to the previous element on close. Closes itself when nothing is loaded. Shows the large cover, title, artist (or "Artista desconocido"), album and "Reproduciendo desde «lista»". Tabs "A continuación" / "Letra" (`tablist` / `tab` / `tabpanel`, arrows, Home and End).
  - Queue: traverses from `context.current.next` following `next`, rendering up to 25 items and counting the rest ("y N más"); "Anteriores" is a `<details>` that traverses from `current.prev` following `prev` (up to 10, nearest first). Each item's node is kept in a `WeakMap`; a click reports the node and `App` calls `playFrom(context, node)`. Notes: repeat `'all'` → "Luego vuelve al inicio"; otherwise, nothing next → "Es la última canción". The queue is rebuilt only while open and only when the current node, the context, the repeat mode or the context contents change (`App.render` invalidates it).
  - Lyrics: requested through `App` only while the view is open on the "Letra" tab, once per song. States: loading, synced (one button per line; the active line is highlighted and scrolled to the middle of the lyrics box, instantly under reduced motion; a click seeks to the line; wheel, touch, scrollbar or scroll keys pause auto-scroll for 4 s), unsynced (static lines), instrumental, not found, error with "Reintentar". Source note under the lyrics. All text through `textContent`.
  - `updateProgress(currentTime)` only moves the active lyric line; nothing else is rebuilt on progress.
- Covers in `PlayerBarView` and `TrackListView` are drawn by the shared `setCover` helper in `icons.ts`.
- `DialogView`: builds one native `<dialog>` form (title, fields, inline error, "Cancelar" and confirm). The confirm handler returns an error message or `null` to close. Used by `SidebarView` and `TrackListView` so the dialog logic is not duplicated.
- `NowPlayingPanelView`: content of the "Sonando" tab, mounted in the slot the right column offers. `render(state, context)` shows "Sonando desde «lista»" with an expand button, the cover (generic fallback), title, artist, two cards for `current.prev` and `current.next` (a card at an edge says "Inicio de la lista" / "Fin de la lista"; with repeat `'all'` it shows the wrap target `tail` / `head` with "(vuelve al final)" / "(vuelve al inicio)"), and "A continuación": the next 8 nodes following `next` plus "Ver todo". Without a song it shows "Nada sonando" and a hint. Each node is kept in a `WeakMap`; clicks report the node to `App`. Queue items are built by `queueItem.ts`, shared with `NowPlayingView`.
- `PlaylistHeaderView`: cover (first letter on a gradient chosen with `coverToneIndex(id)` from six `--color-cover-N` tokens; the Library uses its icon), title, meta and the action buttons.
- `ExploreView`: header "Explorar" / "Música libre de Audius", search "Buscar en Audius" (debounce 400 ms, Enter immediate), genre chips, rows from `trackRow.ts` (kind `explore`: a "Ver en Audius" link and an add button, no reorder or remove), loading skeleton, empty, error with "Reintentar", attribution and the privacy note.
- `PanelLayoutView` / `PanelSplitterView`: two `role="separator"` splitters (sidebar and right column) for widths from 1100 px; `clampPanelWidths` keeps the sidebar in 200–360, the right column in 280–520 and the main column at 480 or more.
- `ShortcutsDialogView`: the "Atajos de teclado" dialog, built from `SHORTCUT_HELP` in `KeyboardShortcuts.ts`.
- `queueItem.ts`: builds one queue button (cover, title, artist or "Archivo no disponible", duration) so the two queue views never duplicate the markup.
- `StructurePanelView`: region `#structure-panel` plus `#structure-backdrop`; it is the **right column** with a `tablist` "Sonando" (default) / "Estructura" (arrows, Home and End) and the close button. The "Estructura" tab shows the doubly linked list of the **visible** playlist (the content below is unchanged); the "Sonando" tab hosts `NowPlayingPanelView`. `isOpen`, `tab`, `restoreOpen(isOpen)`, `selectTab(tab)` and `onTabChange` let `App` restore and save the preferences. Visible by default from 1100px (right column); hidden by default below (overlay from the right on tablets, bottom sheet on phones). Crossing the 1100px breakpoint resets it to that default; on startup the saved open state is applied only on desktop.
  - `render(playlist, context)` returns immediately when the playlist, its name, its `lastOperation` and the current node (only when the playlist is the context) are all unchanged, so play/pause, volume and progress never rebuild it.
  - Summary `length = N · head = … · tail = …`; node cards with `[i]`, title, `prev:` / `next:` (title or `null`) and the tags `head`, `tail`, `current`; connectors "next ↓ / ↑ prev" between cards; the `prev` and `next` neighbors of `current` drawn dashed. A card click reports `(playlist, node)` to `App`.
  - Window: focus = `current` when the playlist is the context, else `head`. From the focus it walks `prev` up to 15 steps (the start node and the number of steps), gets the focus index with one forward traversal (`positionOf`), then walks `next` from the start for at most steps + 1 + 15 nodes. "… N nodos antes" = start index; "… N nodos después" = `length` − start index − shown. No array of nodes is ever built. The focus card is scrolled into view (smooth, instant under reduced motion).
  - "Última operación": code form (`append()`, `prepend()`, `insert(i)`, `remove(i)`, `removeNode()`, `clear()`, with the 0-based index the decorator recorded) and a Spanish sentence built from the labels. A **new** operation of the same playlist (not a playlist switch, not a re-render) marks `previousNode`, `node` and `nextNode` and every connector whose two ends are marked with `is-changed` (800ms flash; static highlight under reduced motion) and writes the sentence into an `aria-live="polite"` region. Nothing flashes while the panel is closed.
  - "Historial (últimas 6)": a `<details>` with the last six operations of the Decorator's `history`, newest first.
  - Empty list: "Lista vacía · head = null · tail = null" and a short explanation.
  - Escape and the backdrop close it only in overlay mode (Escape is ignored inside dialogs or when another view already handled it). Opening as overlay moves focus to its close button; closing returns focus to the control that opened it.
  - While "Reproduciendo ahora" is open the panel and its backdrop are covered, `inert` and (in overlay mode) hidden.
- `NotificationView`: toasts (about 4 s, close button, `role="status"`, errors `role="alert"`), the persistent "Cargando canciones…" notice and the "Reconecta tus archivos para escucharlos" banner with its "Cargar carpeta" button (`setReconnectBannerVisible`, `onReconnectRequested`).

### AudiusTrackAdapter (Adapter)
- `toSong(raw: unknown): Song | null`. Validates the unknown object field by field and returns `null` when anything required is wrong: `id` (letters and digits), `title` (non-empty), `duration` (finite, ≥ 0), `user.name` (string, may be empty), `permalink` (starts with `/`) and playability (`is_streamable === true`, `is_delete` and `is_unlisted` not true, `access.stream` not false).
- Builds a `Song` with fingerprint `audius:<id>`, `artist = user.name`, `album = ""`, stream URL `https://api.audius.co/v1/tracks/<id>/stream?app_name=Musongs`, page URL `https://audius.co<permalink>` and the artwork `480x480` (else `1000x1000`, else `150x150`) when it is an `https` URL.

### AudiusService
- `constructor(fetchFunction, adapter, now)`, all injectable. `trending(genre | null)` and `search(query)` return `{ status: "ok"; songs } | { status: "error" }` and never reject.
- Requests carry `app_name=Musongs` and `limit=30`; 10 s timeout with `AbortController`; non-200, network errors and malformed bodies → `error`. Items go through the adapter; invalid items and repeated fingerprints are dropped.
- In-memory cache for 5 minutes per genre or normalized query (errors are not cached).

### ExploreSession
- Holds the current query or genre, the status (`loading` / `ready` / `error`) and **one** temporary `Explorar` playlist, built with `addAtEnd` (append) and never persisted. A new search builds a new playlist object and only replaces the old one when its answer is the latest request, so a song that is playing from the previous results keeps its list and the playback is not interrupted. `owns(playlist)` tells `App` whether a playlist came from Explorar.

## 3. Main flows

1. Load: input files/folder → `SongLoader.load` → `PlaylistManager.addTracks` (media of every added or reconnected song → `AudioStore.put`) → save → render → toast with counts.
2. Add at position: row button "Agregar a…" (destination chosen) or header button "Agregar canción" (song chosen) → dialog (Inicio/Final/Posición) → `Playlist.addAt…` → refresh player if it is the context → save → render.
3. Play: click row → `MusicPlayer.playFrom(playlist, node)`.
4. Next/previous: player → `context.next()` / `previous()` → load source → play.
5. Remove current: `Playlist.removeNode` handles `current` → if the playlist is the player context → `MusicPlayer.refresh()`.
6. Remove from Library: `PlaylistManager.removeSongEverywhere` → refresh player if affected.
7. Delete playlist: if it is the player context → `clearContext()` first.
8. Startup: `loadState` → `restore` (songs unavailable, lists rebuilt with `append`) → `AudioStore.get` + `attachFile` for every song → preferences → render. Songs without stored media stay unavailable and the banner offers reconnection through the normal load flow, which stores the media again.
9. Duplicate: `duplicatePlaylist` → the copy becomes visible → save → render.
10. Play a playlist: header button → `App.playPlaylist` → context? `togglePlayPause()` : `playFrom(playlist, firstAvailableNode)`.
11. Repeat: player bar button → `cycleRepeatMode()` → state notified → button and next/previous availability redrawn. At an edge with `'all'`: `selectFirst()` / `selectLast()` → load → play.
12. Search: input → `TrackListView` traverses `playlist.nodes()` and hides non-matching rows; no call to `App` or the model.
13. Lock screen / media keys: Media Session action → the same `MusicPlayer` method the UI uses.
14. Now playing: player bar → `App` → `NowPlayingView.open()` → queue built from `current.next` / `current.prev`. Queue item → `App` → `playFrom(context, node)`.
15. Lyrics: "Letra" tab (or a song change while it is open) → `App` → `LyricsService` (`.lrc` → embedded → LRCLIB) → `NowPlayingView.showLyrics`. Progress → `activeLineIndex` → highlight.
16. Move: row button → `App.moveNode` → `Playlist.moveUp` / `moveDown` → `moveNode` on the decorated list → `TrackedLinkedList` records `move` → refresh player if context → save → render → the structure tab flashes the moved node and its new neighbors.
17. Clear data: sidebar → confirmation → `AudioStore.clear()` + `PlaylistStorage.clear()` → reload.
19. Skip unavailable: next, previous and auto-advance → `context.findAvailable` → first available node (wrapping only for repeat `'all'`, at most one cycle) → `select` → play.
20. Reorder by dragging: grip handle → `RowDragController` (pointer events; touch after a 300 ms long press) → `DropIndicator` finds the row below the pointer → `TrackListView` converts it to the final position → `App.moveToPosition` → `Playlist.moveToPosition` → `moveNode`. Dropping on a sidebar playlist → `addAtEnd` and a toast. Escape or dropping outside cancels.
21. Drop files from the operating system: `FileDropZone` → `droppedFiles.readDroppedFiles` (recursive, keeps `webkitRelativePath` so `.lrc` pairing works) → `App.loadFiles(files, placement)` → `SongLoader` → `PlaylistManager.addTracks(…, placement)` → `AudioStore.put`.
22. Shuffle: player bar, header or `S` → `MusicPlayer.toggleShuffle` → `Playlist.shuffledCopy` becomes the context; the original is untouched.
23. Explorar: sidebar item → `ExploreSession.start` → `AudiusService.trending` → adapter → append into the results playlist → `ExploreView.render`. Play a result → `playFrom(results, node)`; add a result → `ensureInLibrary` → destination.
24. Structure panel: any mutation → `TrackedLinkedList` records a `ListOperation<Song>` with the node references → `App.render()` → `StructurePanelView.render(visible, context)` → new `lastOperation` → rebuild the window, flash the referenced nodes, announce the sentence. Next / previous → player state → `render` → only the `current` tag and neighbors move.

## 4. Persistence format (`StoredState`)

```json
{
  "version": 2,
  "songs": [
    { "id": "", "title": "", "artist": "", "album": "", "duration": 0, "fingerprint": "", "source": "local" },
    { "id": "", "title": "", "artist": "", "album": "", "duration": 0, "fingerprint": "audius:<trackId>", "source": "audius", "streamUrl": "https://…", "coverUrl": "https://… or null", "pageUrl": "https://…" }
  ],
  "library": ["songId"],
  "playlists": [{ "id": "", "name": "", "songIds": ["songId"] }]
}
```

Version 1 states (before Audius) are migrated on load by adding `source: "local"` to every song. Audius songs store only their URLs, never audio. "Explorar" and shuffled copies are never persisted. Lists are serialized by forward traversal into id arrays (`PlaylistManager.toStoredState`) and rebuilt with `append` (`restore`). This is the only place where list contents become arrays. `localStorage` never holds audio or covers.

Preferences (`musongs.preferences.v1`):

```json
{ "volume": 0.8, "muted": false, "repeatMode": "off", "rightColumnOpen": true, "rightColumnTab": "now", "panelWidths": { "sidebar": 240, "right": 340 }, "shuffle": false }
```

Audio lives in IndexedDB (`AudioStore`), keyed by song id, as `StoredMedia = { file, cover, coverType, lyricsFile, embeddedLyrics }`. It stays on the user's computer, inside the browser profile, and is never sent anywhere. If it is missing or unavailable, songs start unavailable and are reconnected by fingerprint through the normal load flow.

## 5. Patterns (defense summary)

| Pattern | Where | Problem solved | Benefit |
|---|---|---|---|
| Singleton | `MusicPlayer` | Two audio elements could play at the same time and disagree on state | One global playback state, one access point |
| Decorator | `TrackedLinkedList` | The structure panel needs an operation log (and which nodes each operation linked), but the list should stay pure | Logging added without touching `DoublyLinkedList`; same interface, interchangeable; each `ListOperation<T>` carries `previousNode`, `node` and `nextNode` read from the real links |
| Prototype | `Playlist.clone` (and `shuffledCopy` on top of it) | Duplicating a playlist must not share nodes; shuffling must not touch the original | Deep copy of structure, shared songs, independent links |
| Adapter | `AudiusTrackAdapter` | The Audius API returns an unknown JSON shape that the player cannot use | Target: `Song`. Adaptee: the Audius track object. Adapter: `AudiusTrackAdapter.toSong`. Client: `AudiusService`. The rest of the app never sees Audius fields |

## 6. Shuffle design

- Turning shuffle on never reorders the original. `MusicPlayer` asks `source.shuffledCopy(random, anchor)`: it clones the playlist (Prototype: new nodes, same songs), records which original node each copy node came from (a `WeakMap`, `originOf`), shuffles the copy in place and moves the anchor (the song that is playing) to the head, selecting it so playback continues.
- The algorithm lives only in `Playlist.shuffle(random)` and is Fisher–Yates using only `moveNode`: for `i` from `length - 1` down to 1, `j` is a random index in [0, i]; the node at `j` is moved to position `i` (nothing is done when `j === i`). The random source is injectable, so the tests are deterministic.
- `next`, `previous` and repeat work unchanged on the copy's links. Every selection in the copy is mirrored into the original through `originOf`, so the Library row stays highlighted. Turning shuffle off restores the original with the current song selected.
- A structural change of the original while shuffled (add, move, remove) rebuilds the copy from the original keeping the current song. The copy is never persisted; only the on/off preference is.
- "Sonando" shows "Orden aleatorio" and the node line `nodo [i] · length N`; "Estructura" shows the copy while the visible playlist is the shuffle source.

## 7. Audius (Explorar)

Verified with the page served by `npm run dev` (browser `fetch` from `http://localhost`, Chrome, 2026-10-05); the API answers with CORS enabled, so no proxy is needed:

| Request | Result |
|---|---|
| `GET https://api.audius.co/v1/tracks/trending?app_name=Musongs` | 200, `{ data: [...] }`, 100 tracks (30 with `limit=30`) |
| `GET …/tracks/trending?genre=Electronic&app_name=Musongs` | 200, only Electronic tracks |
| `GET …/tracks/search?query=lofi&app_name=Musongs` | 200, `{ data: [...] }` (an unknown query gives `{ data: [] }`) |
| `GET …/tracks/<id>/stream?app_name=Musongs` | 200 with `audio/mpeg` after a redirect to a content node; played in an `<audio>` element. Tracks with `is_streamable: false` answer 404 |

- Fields used from a track: `id` (string, used in the stream URL and the fingerprint), `title`, `duration` (seconds), `user.name`, `permalink`, `artwork["480x480" | "1000x1000" | "150x150"]`, `is_streamable`, `is_delete`, `is_unlisted`, `access.stream`. Everything else is ignored.
- Valid genre names (verified, 100 results each): `Electronic`, `Hip-Hop/Rap`, `Rock`, `Pop`, `Lo-Fi`, `Latin`. An unknown genre returns an empty list.
- Flow: `ExploreView` → `ExploreSession` → `AudiusService` (cache, timeout) → `AudiusTrackAdapter` → remote `Song` → append into the results playlist → rows. Playing a result makes that playlist the context, so next, previous, repeat and shuffle use its links. Adding a result to a playlist adds it to the Library first (deduplicated by fingerprint); only its URLs are persisted.
- Offline or API failure: `ExploreView` shows "No se pudo conectar con Audius" with "Reintentar"; local songs keep playing because they never depend on the network.

## 8. Security and privacy

- Audio stays local: `File` → `URL.createObjectURL` → `<audio>`. No network requests for audio. No CORS involved (blob URLs are same-origin). A copy of the selected files is kept in the browser's IndexedDB so the library survives a reload; it never leaves the browser and "Borrar datos guardados" removes it.
- Audius: `ExploreSession` / `AudiusService` send only the search text or the genre (and `app_name=Musongs`) to `api.audius.co`. Audius songs are streamed by the `<audio>` element and are never downloaded or stored by the app. No local file, file name or metadata is ever sent to Audius. Artwork is loaded from the hosts the API names, only over `https`; links to Audius use `target="_blank"` with `rel="noopener noreferrer"`.
- The only network request with local-song data is the LRCLIB lyrics lookup: cleaned title and artist, album and rounded duration in the query string, sent only when the "Letra" tab is opened and the song has no local lyrics. LRCLIB allows cross-origin simple `GET` requests; no custom headers are sent.
- User strings rendered with `textContent` only.
- Object URLs revoked when a song leaves the Library.
