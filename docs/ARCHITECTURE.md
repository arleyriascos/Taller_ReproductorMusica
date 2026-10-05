# ARCHITECTURE — Musongs

## 1. Layers

| Layer | Files | Knows the DOM? |
|---|---|---|
| Data structure | `Node`, `LinkedList`, `DoublyLinkedList`, `TrackedLinkedList` | No |
| Model | `Song`, `Playlist`, `PlaylistManager` | No (except `Song` creating object URLs) |
| Browser services | `SongLoader`, `MusicPlayer`, `PlaylistStorage` | Browser APIs only, no page elements |
| Coordination | `App` | Through views only |
| Views | `SidebarView`, `TrackListView`, `PlayerBarView`, `StructurePanelView`, `NotificationView`, `DialogView` | Yes |
| Support | `types.ts`, `icons.ts`, `format.ts`, `main.ts`, `styles.css` | — |

Dependency direction: Views → App → services and model → Playlist → TrackedLinkedList → DoublyLinkedList → Node. `Node.value` → `Song`.

## 2. Classes

### Song
- Fields: `id`, `title`, `artist`, `album`, `duration` (seconds), `fingerprint`, `coverUrl: string | null`, `sourceUrl: string | null`.
- Built from `SongDetails` (`types.ts`); may start without a file (restored from storage).
- `attachFile(file: File, cover: Blob | null)`: creates object URLs for audio and cover.
- `isAvailable()`: `sourceUrl !== null`.
- `release()`: revokes object URLs and marks the song unavailable.
- `id` from `crypto.randomUUID()`. Fingerprint: `${file.name}|${file.size}|${file.lastModified}`.
- `duration` is read through a getter. `updateDuration(seconds)` completes it only when the stored duration is 0 and the new value is finite and positive (used by `MusicPlayer` when metadata had no duration).
- `artist` and `album` may be empty strings; the views choose the fallback text (for example "Artista desconocido").

### Playlist
- Fields: `id`, `name`, `isLibrary` (readonly), the decorated list, `current: Node<Song> | null`.
- Mutations: `addAtStart(song)`, `addAtEnd(song)`, `addAtPosition(song, position)`, `removeAtPosition(position)`, `removeNode(node)`, `removeAllOf(song)`, `rename(name)`.
- Navigation: `select(node)`, `next()`, `previous()`, `hasNext()`, `hasPrevious()`, `selectFirst()` / `selectLast()` (set `current` to `head` / `tail` and return it; `null` and no change when empty). The list is never circular: `head.prev` and `tail.next` stay `null`; wrapping for "repeat all" is decided by `MusicPlayer`, not by the list.
- Reading: `nodes()` (forward generator), `length`, `contains(song)`, `history`, `lastOperation`, `totalDuration()`.
- Prototype: `clone(name)`.
- Every removal keeps `current` valid using the rule in `DATA_STRUCTURE.md` section 7.

### PlaylistManager
- `library: Playlist` (name "Biblioteca", `isLibrary = true`).
- `playlists: Map<string, Playlist>` (insertion order = display order). The set of playlists is not required to be a linked list; each playlist is.
- `visiblePlaylistId`.
- `createPlaylist(name)`: trimmed, 1–40 characters, unique ignoring case and accents; otherwise throws with a reason the UI can show. Names are compared with `comparableText` from `format.ts` (the same normalization the list search uses; "ñ" stays distinct from "n").
- `renamePlaylist`, `deletePlaylist` (never the Library), `getPlaylist(id)`, `allPlaylists()`.
- `addTracks(tracks: LoadedTrack[])`: for each track, find a Library song with the same fingerprint: available → count as duplicate; unavailable → `attachFile` (reconnection); none → new `Song`, `library.addAtEnd`. Returns counts `{ added, reconnected, duplicated }`.
- `removeSongEverywhere(song)`: `removeAllOf` in every playlist and the Library, then `song.release()`.
- `duplicatePlaylist(id)`: `clone` with the name "<name> (copia)", made unique.
- `toStoredState()` and `restore(state)` for persistence.

### SongLoader
- `constructor(canPlay)`: an injected playability probe `(mimeType) => boolean`. The default uses a detached audio element's `canPlayType` (true when the result is not empty). Tests inject their own probe and run in Node.
- `load(files: Iterable<File>): Promise<LoadResult>` with `LoadResult = { tracks: LoadedTrack[]; rejected: RejectedFile[]; ignored: number }` and `RejectedFile = { name; reason: 'unsupported-format' }` (`types.ts`).
- Classification per file:
  - Audio candidate: MIME starts with `audio/` or the extension is one of mp3, m4a, aac, wav, ogg, oga, opus, flac, webm, wma.
  - Not a candidate (covers, text files inside a folder): counted in `ignored`, no message per file.
  - Candidate whose MIME (or the MIME inferred from the extension when `file.type` is empty) fails the probe: `rejected` with `unsupported-format`.
  - Otherwise: a `LoadedTrack`.
- Order: input files are sorted in natural order by `webkitRelativePath` when present, else by name (`localeCompare` with `numeric: true`, `sensitivity: 'base'`), so "2 - b" comes before "10 - a". Sorting the incoming `File` objects is allowed: it is input, not a song collection.
- Metadata with `music-metadata`, loaded with a dynamic `import()` so it is a separate chunk, parsing the `File` as a `Blob` (browser entry, no Node polyfills), covers included.
  - Title: tag title, else the file name without extension.
  - Artist and album: tag values or `""`. No Spanish text in the loader.
  - Duration: `format.duration` when finite and positive, else 0; `MusicPlayer` completes it from the audio element.
  - Cover: first picture as a `Blob` with its MIME type, else `null`.
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
- Media Session (only when `"mediaSession" in navigator`): `loadSong` sets `MediaMetadata` (title, artist, album, and the cover object URL as artwork when the song has one; `Song` does not keep the cover MIME type, so `type` is omitted). Action handlers `play`, `pause`, `previoustrack`, `nexttrack`, `seekto`, `seekbackward`, `seekforward` (10 s by default) call the same methods as the UI (`togglePlayPause`, `previous`, `next`, `seek`); each registration is wrapped so a browser that does not support one action skips it. `playbackState` follows play/pause, and `setPositionState` is updated on `loadedmetadata`, `seeking`, `play` and `pause` only when the duration is finite and positive (position clamped to it). Unloading (`clearContext`, or `refresh` with no current song) clears metadata, sets `playbackState = "none"` and clears the position state.

### PlaylistStorage
- Keys: `musongs.state.v1` (structure) and `musongs.preferences.v1` (volume, structure panel open).
- `saveState(state)`, `loadState(): StoredState | null`, `savePreferences`, `loadPreferences`.
- Corrupt or invalid JSON → returns `null` and the app starts empty. Quota errors are caught and reported once.

### App
- Creates the manager, loader, player (via `getInstance`), storage and views.
- Receives every user action from the views, calls the model or player, saves state when the structure changed, then calls `render()`.
- `render()` redraws the views from the current model. Progress updates only call `PlayerBarView.updateProgress` (no full redraw every tick).
- Player state changes call `PlayerBarView.render`, `TrackListView.setPlayback` and `SidebarView.setPlayback` (highlight only, no list rebuild) and update `document.title`.
- Reads the playback context from `MusicPlayer.context` (it does not keep its own copy). The context only changes through `App` calls (`playFrom` sets it, `clearContext` clears it). The highlighted node is `context.current`, so only the context playlist shows a current row.
- Playlist play button: if the playlist is the context → `togglePlayPause()`; otherwise `playFrom(playlist, node)` with the first available node found by forward traversal (the head when none is available, so the usual "unavailable" message appears).
- After a mutation of the context playlist (add or remove) calls `player.refresh()` so `hasNext` / `hasPrevious` and the loaded song stay correct. `removeSongEverywhere` refreshes whenever there is a context. Deleting the context playlist calls `clearContext()` first.
- Name validation: the create and rename handlers return `PlaylistNameIssue | null` synchronously (from `checkName`); the view shows the Spanish message.
- Translates thrown errors into Spanish messages through `NotificationView`.

### Views
Each view receives its root element from `index.html` by id, builds content with DOM APIs, and exposes handler setters (for example `onPlaylistSelected(callback)`). Event delegation inside each view. Views read the `Playlist` objects they render (name, `length`, `nodes()`) but never mutate the model or call the player.

- `SidebarView`: brand, Library entry, playlists (with the playing context marked), "Nueva playlist" dialog, "Cargar canciones", "Cargar carpeta" (hidden file inputs, reset after each selection), mobile top bar menu button and drawer (Escape and backdrop close it).
- `TrackListView`: header (name, count, total duration, playlist actions "Agregar canción", "Renombrar", "Eliminar playlist", the round play button and the search box), rows rendered by traversing `playlist.nodes()`, empty states. The header elements are built once and updated in place, so a re-render never steals focus from the search box. Search is presentation only: it traverses `playlist.nodes()` and toggles `hidden` on each row (title, artist or album contain the query after `comparableText`); it never modifies or copies the list, rows keep their real positions, and next/previous keep following the real links. It shows "N de M canciones", an empty result with "Limpiar búsqueda", Escape clears it, and switching playlists resets it. Each row keeps its `Node<Song>` in a `WeakMap`, so play and remove use the node directly (`playFrom(playlist, node)`, `removeNode(node)`). Owns the add-song dialog (two modes), rename, confirm delete playlist and confirm remove from Library.
- `PlayerBarView`: cover, title, artist, previous, play/pause, next, repeat (cycles the three modes; Spanish aria-label per mode), progress with seek, current time and duration, volume, mute. (Structure panel button arrives with the panel.)
- Covers in `PlayerBarView` and `TrackListView` are drawn by the shared `setCover` helper in `icons.ts`.
- `DialogView`: builds one native `<dialog>` form (title, fields, inline error, "Cancelar" and confirm). The confirm handler returns an error message or `null` to close. Used by `SidebarView` and `TrackListView` so the dialog logic is not duplicated.
- `StructurePanelView`: nodes of the playing list (or the visible one if nothing plays) with `head`, `tail`, `current`, `length`, links and the last operation. Minimized by default.
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
| Decorator | `TrackedLinkedList` | The structure panel needs an operation log, but the list should stay pure | Logging added without touching `DoublyLinkedList`; same interface, interchangeable |
| Prototype | `Playlist.clone` | Duplicating a playlist must not share nodes | Deep copy of structure, shared songs, independent links |

## 6. Security and privacy

- Audio stays local: `File` → `URL.createObjectURL` → `<audio>`. No network requests for audio. No CORS involved (blob URLs are same-origin).
- User strings rendered with `textContent` only.
- Object URLs revoked when a song leaves the Library.
