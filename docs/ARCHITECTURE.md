# ARCHITECTURE — Musongs

## 1. Layers

| Layer | Files | Knows the DOM? |
|---|---|---|
| Data structure | `Node`, `LinkedList`, `DoublyLinkedList`, `TrackedLinkedList` | No |
| Model | `Song`, `Playlist`, `PlaylistManager` | No (except `Song` creating object URLs) |
| Browser services | `SongLoader`, `MusicPlayer`, `PlaylistStorage` | Browser APIs only, no page elements |
| Coordination | `App` | Through views only |
| Views | `SidebarView`, `TrackListView`, `PlayerBarView`, `StructurePanelView`, `NotificationView` | Yes |
| Support | `types.ts`, `icons.ts`, `main.ts`, `styles.css` | — |

Dependency direction: Views → App → services and model → Playlist → TrackedLinkedList → DoublyLinkedList → Node. `Node.value` → `Song`.

## 2. Classes

### Song
- Fields: `id`, `title`, `artist`, `album`, `duration` (seconds), `fingerprint`, `coverUrl: string | null`, `sourceUrl: string | null`.
- Built from `SongDetails` (`types.ts`); may start without a file (restored from storage).
- `attachFile(file: File, cover: Blob | null)`: creates object URLs for audio and cover.
- `isAvailable()`: `sourceUrl !== null`.
- `release()`: revokes object URLs and marks the song unavailable.
- `id` from `crypto.randomUUID()`. Fingerprint: `${file.name}|${file.size}|${file.lastModified}`.

### Playlist
- Fields: `id`, `name`, `isLibrary` (readonly), the decorated list, `current: Node<Song> | null`.
- Mutations: `addAtStart(song)`, `addAtEnd(song)`, `addAtPosition(song, position)`, `removeAtPosition(position)`, `removeNode(node)`, `removeAllOf(song)`, `rename(name)`.
- Navigation: `select(node)`, `next()`, `previous()`, `hasNext()`, `hasPrevious()`.
- Reading: `nodes()` (forward generator), `length`, `contains(song)`, `history`, `lastOperation`, `totalDuration()`.
- Prototype: `clone(name)`.
- Every removal keeps `current` valid using the rule in `DATA_STRUCTURE.md` section 7.

### PlaylistManager
- `library: Playlist` (name "Biblioteca", `isLibrary = true`).
- `playlists: Map<string, Playlist>` (insertion order = display order). The set of playlists is not required to be a linked list; each playlist is.
- `visiblePlaylistId`.
- `createPlaylist(name)`: trimmed, 1–40 characters, unique ignoring case and accents; otherwise throws with a reason the UI can show.
- `renamePlaylist`, `deletePlaylist` (never the Library), `getPlaylist(id)`, `allPlaylists()`.
- `addTracks(tracks: LoadedTrack[])`: for each track, find a Library song with the same fingerprint: available → count as duplicate; unavailable → `attachFile` (reconnection); none → new `Song`, `library.addAtEnd`. Returns counts `{ added, reconnected, duplicated }`.
- `removeSongEverywhere(song)`: `removeAllOf` in every playlist and the Library, then `song.release()`.
- `duplicatePlaylist(id)`: `clone` with the name "<name> (copia)", made unique.
- `toStoredState()` and `restore(state)` for persistence.

### SongLoader
- `load(files: Iterable<File>): Promise<{ tracks: LoadedTrack[]; rejected: { name: string; reason: string }[] }>`.
- Accepts a file when `audio.canPlayType(file.type)` is not empty; when `file.type` is empty (common with folders) falls back to the extension list: mp3, m4a, aac, wav, ogg, oga, opus, flac, webm.
- Reads metadata with `music-metadata` (parse from the `File`/`Blob`); missing title → file name without extension; missing artist → "Artista desconocido"; missing cover → `null`.
- Duration from metadata; if absent, reads it from a temporary audio element.
- Processes files with limited concurrency (4 at a time) so large folders do not freeze the page.
- Never reads files from paths, only from user-provided `File` objects.

### MusicPlayer (Singleton)
- `private static instance`, `private constructor`, `static getInstance()`. Owns the only `HTMLAudioElement`.
- State: `context: Playlist | null`, `isPlaying`, `volume` (0–1, default 0.8), `isMuted`.
- `playFrom(playlist, node)`, `togglePlayPause()`, `next()`, `previous()`, `seek(seconds)`, `setVolume(value)`, `toggleMute()`, `stop()`, `refresh()` (re-sync after the context playlist changed, used after removals).
- `ended`: if `context.hasNext()` → next and play; else stop at the end.
- `error` on a source: notify, do not auto-skip.
- Handles the promise returned by `audio.play()`.
- Listeners set by `App`: `onStateChange(callback)`, `onProgress(callback)`, `onError(callback)`.
- Unavailable songs cannot be played; the player reports it instead.

### PlaylistStorage
- Keys: `musongs.state.v1` (structure) and `musongs.preferences.v1` (volume, structure panel open).
- `saveState(state)`, `loadState(): StoredState | null`, `savePreferences`, `loadPreferences`.
- Corrupt or invalid JSON → returns `null` and the app starts empty. Quota errors are caught and reported once.

### App
- Creates the manager, loader, player (via `getInstance`), storage and views.
- Receives every user action from the views, calls the model or player, saves state when the structure changed, then calls `render()`.
- `render()` redraws the views from the current model. Progress updates only call `PlayerBarView.updateProgress` (no full redraw every tick).
- Translates thrown errors into Spanish messages through `NotificationView`.

### Views
Each view receives its root element from `index.html` by id, builds content with DOM APIs, and exposes handler setters (for example `onPlaylistSelected(callback)`). Event delegation inside each view.

- `SidebarView`: brand, Library entry, playlists, "Nueva playlist", "Cargar canciones", "Cargar carpeta", mobile drawer.
- `TrackListView`: header (name, count, total duration, playlist actions), rows, row menu, the "Agregar a…" dialog, the create/rename dialog, delete confirmations. Uses native `<dialog>`.
- `PlayerBarView`: cover, title, artist, previous, play/pause, next, progress with seek, current time and duration, volume, mute, structure panel button.
- `StructurePanelView`: nodes of the playing list (or the visible one if nothing plays) with `head`, `tail`, `current`, `length`, links and the last operation. Minimized by default.
- `NotificationView`: toasts and the "Reconecta tus archivos" banner.

## 3. Main flows

1. Load: input files/folder → `SongLoader.load` → `PlaylistManager.addTracks` → save → render → toast with counts.
2. Add at position: row menu "Agregar a…" → dialog (destination, Inicio/Final/Posición) → `Playlist.addAt…` → save → render.
3. Play: click row → `MusicPlayer.playFrom(playlist, node)`.
4. Next/previous: player → `context.next()` / `previous()` → load source → play.
5. Remove current: `Playlist.removeNode` handles `current` → if the playlist is the player context → `MusicPlayer.refresh()`.
6. Remove from Library: `PlaylistManager.removeSongEverywhere` → refresh player if affected.
7. Delete playlist: if it is the player context → `stop()` first.
8. Startup: `loadState` → `restore` (songs unavailable, lists rebuilt with `append`) → banner if any song is unavailable → user reconnects through the normal load flow.
9. Duplicate: `duplicatePlaylist` → save → render.

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
