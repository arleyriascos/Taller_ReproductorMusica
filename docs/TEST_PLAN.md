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
- `moveNode`: head to tail, tail to head, a middle node forward and backward, one step each way, to the same index (nothing changes), single-node list, every node to every index; invalid indexes (-1, `length`, 1.5) → `RangeError` with the list unchanged; the moved node keeps its identity and so does every other node; the list keeps working after moves.

### TrackedLinkedList.test.ts
- Delegates results and `head`/`tail`/`length` to the inner list.
- Records type, index, value label and neighbor labels for each mutation.
- Records the node references read from the real links: `append`, `prepend` and `insert` in the middle store `previousNode`, the inserted `node` and `nextNode`; `remove` and `removeNode` (head, middle, tail, only node) store the two neighbors that became linked and `node: null`; `clear` stores three `null`. The history keeps the references of older operations.
- `moveNode` records `move` with `index = toIndex`, the moved `node` and its new `previousNode` / `nextNode`.
- Failing operation records nothing.
- History limited to 20 entries.

### Playlist.test.ts
- `addAtPosition` converts 1-based positions; invalid positions rejected.
- `next`/`previous` move `current`; `hasNext`/`hasPrevious` false at the edges.
- Removing current with next → next; at tail → previous; only node → `null`.
- `selectFirst` / `selectLast`: `null` on empty; move `current` to `head` / `tail` from anywhere; same node with one song; never make the list circular (`next()` at tail and `previous()` at head still return `null`) and record no operation.
- `moveUp` / `moveDown` move a node one place with valid links and do nothing at the edges; `current` stays on the same node (when it is the moved node and when another node moves past it); the history records `move`.
- `findAvailable`: skips unavailable songs in both directions; `null` at the ends without wrapping; wraps through `head` / `tail` skipping unavailable songs; stops after one cycle when nothing is available; can land on the current song when it is the only available one; `null` without a current node; changes neither `current` nor the history.
- `moveToPosition`: forward and backward, first and last position, same position records nothing, `current` stays on the same node, records `move`, rejects positions out of range or not integers (`RangeError`) and nodes of another playlist.
- `shuffle`: same songs, length and valid links (forward and backward) for any random source; deterministic cases (random 0 reverses the list, random near 1 leaves it untouched with no operation recorded); the Fisher–Yates steps with given picks; only `move` operations on the existing nodes; empty and single-song lists; `current` kept.
- `shuffledCopy`: original untouched (order, nodes, `current`, history), new nodes, anchor song at the head and selected, no current without anchor, the exact node anchored when a song appears twice, `originOf` maps every copy node to its original, navigation follows the shuffled links.
- `removeAllOf` removes every node holding the song.
- `clone`: same order, different nodes, same `Song` objects, empty history, `current` null, original unchanged after modifying the clone.

### PlaylistManager.test.ts
- Starts with the Library ("Biblioteca", `isLibrary`) visible and no user playlists.
- `checkName`: empty, spaces only, 41 characters → issue; 40 characters after trimming accepted; "biblioteca" and duplicates with different case and accents → `duplicate`.
- Name comparison ignores case and accents, but "ñ" is a distinct letter: "Canción" equals "CANCION", while "Año" and "Ano" are different names.
- `createPlaylist` trims the name, throws the issue code, keeps insertion order.
- `renamePlaylist` excludes the playlist itself from the duplicate check; rejects another playlist's name; cannot rename the Library.
- `setVisible` rejects unknown ids; deleting the visible playlist makes the Library visible; deleting another keeps the visible one; the Library cannot be deleted.
- `addTracks` (real `File` objects): new → `added` at the end of the Library; same fingerprint available → `duplicated`; same fingerprint unavailable → `reconnected` and available again.
- `addTracks` passes `coverType`, `lyricsFile` and `embeddedLyrics` to the new song and again on reconnection; `release()` clears them.
- `removeSongEverywhere` removes every node of the song from the Library and all playlists and makes the song unavailable.
- `addTracks` with `placement`: new songs inserted consecutively at a Library position (first, middle, last); reconnected and duplicated songs keep their place; `destination` inserts every resulting song, duplicates included, into a playlist at consecutive positions (including the end).
- Remote songs: `ensureInLibrary` appends a new remote song, reuses the Library song with the same fingerprint, returns an existing local song untouched; `toStoredState` / `restore` round trip with URLs and without cover; `removeSongEverywhere` removes a remote song everywhere and keeps it playable; remote songs are never reported as unavailable.
- `duplicatePlaylist`: names "(copia)", "(copia 2)", "(copia 3)"; respects 40 characters; the copy is independent; unknown id throws.

- `toStoredState` / `restore`: round trip keeps the order of the Library and of every playlist, duplicated songs inside a playlist, and unavailable songs; restored songs are unavailable with their saved id; `addTracks` after `restore` reconnects them keeping their ids; restoring an empty state; restoring into a manager that already has data throws.

### PlaylistStorage.test.ts
Runs in Node with a fake `Storage`.
- State version 2 and preferences round trip (including `panelWidths` and `shuffle`); old preferences without them load with defaults and malformed ones are replaced; a version 1 state is migrated (every song `local`) and saved back as version 2; a mixed local + audius state round trips; audius songs without valid `https` URLs or with an unknown `source` are rejected; nothing stored → `null`; corrupt JSON → `null`; an unknown version, lists pointing to unknown songs, duplicated song ids, malformed songs or playlists and invalid preferences are rejected; `clear` removes both keys; a write failure (quota) or missing storage is reported once through the callback and never throws.

### AudioStore.test.ts
Runs in Node without IndexedDB.
- Without IndexedDB, or when opening the database fails, every operation resolves without throwing (`get` and `usage` give `null`) and the failure is reported once. `reattach` asks only for local songs (no request for remote songs), leaves a local song unavailable when nothing is stored, and `forget` deletes only local songs. The real IndexedDB paths are validated manually (M93–M96).

### format.test.ts
- `formatTime`: m:ss, h:mm:ss, fractions dropped, "—:—" for 0, negative, NaN and Infinity.
- `formatElapsed`: same format, "0:00" for invalid values.
- `formatTotal`: rounds up to minutes, "N h M min" from 60 minutes, "0 min" for invalid values.
- `countLabel`: singular only for exactly 1.
- `formatMegabytes`: one decimal with a comma; 0 for invalid values.
- `clampPanelWidths`: valid widths kept; sidebar limited to 200–360 and right column to 280–520; main never below 480 for any window width; the other panel shrinks first and the favored one is kept; rounding and invalid values; dragging one panel without moving the other.
- `coverToneIndex`: deterministic, inside the palette, spreads different ids; `coverInitial`: uppercase first letter, emoji kept whole, "?" for blank names.
- `comparableText`: ignores case, spaces, accents, dieresis and circumflex; "ñ" stays distinct in composed and decomposed form; blank text → "".

### SongLoader.test.ts
Runs in Node with real `File` objects and an injected playability probe (no audio element).
- Ignores non-audio files and counts them in `ignored`.
- Rejects audio the probe cannot play with `unsupported-format`.
- Accepts by extension when `file.type` is empty and probes the MIME inferred from the extension; an unknown extension with an empty type is ignored.
- Natural sort: "2 - b.mp3" before "10 - a.mp3".
- Parse failure (invalid bytes) falls back to the file-name title, empty artist and album, duration 0, no cover.
- Fingerprint equals `Song.fingerprintOf(file)`.
- Order preserved with more files than the concurrency limit (4).
- A generated WAV with RIFF INFO tags yields its title, artist and duration.
- `.lrc` pairing: a loose `.lrc` pairs with the audio of the same base name (case-insensitive); inside folders only within the same folder; unpaired `.lrc` files (and the `.lrc` of a rejected audio file) count as `ignored`; paired ones do not.
- Embedded lyrics from a generated WAV with an ID3 `USLT` frame: LRC text → synced lines; plain text → unsynced lines; no tag → `null`.

### lyrics.test.ts
Fixtures use invented text only.
- `parseLrc`: `[mm:ss]`, `[mm:ss.xx]`, `[mm:ss.xxx]`; several timestamps on one line, sorted; metadata tags ignored; positive and negative `[offset:]`, never below 0; empty timed lines kept, untimed lines dropped in synced text; word timestamps removed; Windows line endings; plain text → unsynced lines with inner spacers; blank text → no lines.
- `toLyrics`: synced flag; `null` when every line is empty; `instrumentalLyrics`.
- `activeLineIndex`: -1 before the first line; last line with time ≤ position (equal times choose the later one); -1 for unsynced or empty lines.
- `cleanSearchTitle`: removes "(Official Video)", "[Official Music Video]", "- Official Video", "Official Video", "Lyric Video", "Lyrics", "Audio", "HD", "4K", "Remastered 2011", "2009 Remaster", several noises, extra spaces; keeps "(en vivo)" and a title that would become empty; removes a leading artist that matches ignoring case and accents; keeps a different leading part; splits "Artist - Title" when the artist is empty, but not a noise suffix.

### LyricsService.test.ts
Fake `fetch` returning real `Response` objects.
- Priority: `.lrc` file first (no request), then embedded lyrics (no request), embedded when the `.lrc` is empty, LRCLIB only without local lyrics.
- Query: `/api/get` with the cleaned title and artist, trimmed album and rounded duration; empty album and unknown duration omitted; artist split from the title when the song has none; no artist → straight to `/api/search` without `artist_name`; abort signal and no custom headers.
- Results: 404 → search with the closest duration; results farther than 5 s rejected; first result with lyrics when the duration is unknown; synced preferred over plain; plain used when there is no synced text; instrumental; empty search → not-found; server error → error.
- Cache: found and not-found cached per song; network error not cached (retry asks again); concurrent calls share one in-flight promise.

`MusicPlayer` is not unit-tested (it depends on the browser audio element); it is validated manually (M08–M14, M20, M21, M34, M37–M43, M46–M48). `NowPlayingView` is validated manually (M49–M66). `StructurePanelView` is validated manually (M25, M26, M67–M86). `NowPlayingPanelView`, the move buttons, the banner and the sidebar footer are validated manually (M87–M96).

### Song.test.ts
- A new song is local and unavailable; `attachRemote` makes it an available remote song with stream, cover (`image/jpeg`) and page; cover optional; `release()` never revokes remote URLs and keeps a remote song available; `attachFile` turns a remote song into a local one; `release()` still revokes the object URLs of a local song.

### droppedFiles.test.ts
- File drags are detected by `types`; single files get their `webkitRelativePath`; folders are walked recursively across reader batches (so `.lrc` pairing keeps working); unreadable entries are skipped; the plain file list is the fallback; an empty folder gives nothing.

### AudiusTrackAdapter.test.ts
Invented fixtures only.
- A valid track becomes a remote song (title and artist trimmed, album empty, duration, `audius:<id>`, stream URL with `app_name=Musongs`, page URL, `image/jpeg` cover type); artwork preference 480x480 → 1000x1000 → 150x150, unusable or non-https artwork → no cover; non-objects, invalid id, blank title, invalid duration, missing user name, invalid permalink and non-streamable tracks (`is_streamable`, `is_delete`, `is_unlisted`, `access.stream`) → `null`; a new object on every call.

### AudiusService.test.ts
Fake `fetch`.
- URLs (trending with and without genre, search with the trimmed query, `app_name`, `limit`); mapping in order; invalid items and duplicated fingerprints dropped; empty list is `ok`; network failure, non-200 and malformed bodies → `error`; 10 s abort with fake timers; errors not cached; 5-minute cache (same song objects, expires at exactly 5 minutes); separate entries per genre and per normalized query.

### ExploreSession.test.ts
Fake service.
- Starts empty and loads trending once; the playlist is built with append (links follow the result order); search clears the genre, a genre clears the query, an empty search shows trending; loading → ready notifications; error and retry; previous results kept when a new request fails; a new search creates a new playlist object (the old one keeps its songs and its current node); a slow answer replaced by a newer request is ignored; `owns` recognizes the playlists it created.

### KeyboardShortcuts.test.ts
Pure dispatch (no DOM).
- Every key maps to its action with its arguments (Space, Shift+→ / ←, → / ←, ↑ / ↓, M, S, R, L, E, /, ?); uppercase letters work; unknown keys do nothing; plain and shifted arrows are different; everything is ignored while typing, with a dialog open or with Ctrl, Meta or Alt; Space is left to focused buttons and arrows to separators, tabs and sliders; only seek and volume repeat while a key is held; `SHORTCUT_HELP` lists each shortcut once.

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
| M25 | Right column open/close | Visible by default from 1100px, hidden below; toggle and close button work; the open state and the selected tab survive a reload |
| M26 | Panel after insert/remove | Nodes, labels and last operation correct |
| M27 | Reload page with stored audio | Playlists, order and preferences kept; songs available again with cover and lyrics, no banner, no reselection |
| M28 | Songs whose audio is not stored (storage blocked or cleared), reload, then "Cargar carpeta" | Rows muted with "Archivo no disponible", banner shown; matching songs available again after reconnecting, toast says "reconectadas" |
| M29 | Duplicate playlist, then edit copy | Original unchanged |
| M30 | Light and dark system theme | Both readable |
| M31 | Mobile width | Drawer, bottom sheet, compact player |
| M32 | Keyboard only | All main actions reachable |
| M33 | Deployed version on another computer | Works with that computer's files |
| M34 | Con la pantalla del celular apagada, al terminar una canción empieza la siguiente | La reproducción continúa en segundo plano |
| M35 | Sidebar at 768, 900, 1024, 1180, 1366 and 1440 px, light and dark | "Biblioteca" and headings complete, buttons inside the sidebar, long playlist names with ellipsis and full name on hover, no horizontal scroll |
| M36 | Short window (sidebar taller than the screen) | Thin themed scrollbar only in that case |
| M37 | Nothing to play (empty Library, empty playlist) | Play buttons gray, clearly disabled |
| M38 | Playlist play button on a playlist that is not playing | Starts from its first song; sidebar marks it as playing |
| M39 | Playlist play button on the playing playlist | Pauses / resumes; icon and label "Pausar" / "Reproducir playlist" |
| M40 | Current row while playing, paused, and with "reducir movimiento" | Animated bars / static bars / static bars |
| M41 | Repeat button cycle | desactivado → toda la lista → una canción → desactivado, distinct look for each |
| M42 | Repeat "toda la lista" | Next at the last song goes to the first; previous at the first goes to the last; the last song ending starts the first |
| M43 | Repeat "una canción" | The song restarts when it ends |
| M44 | Search by title, artist and album with accents, "ñ" and uppercase | Only matching rows, "N de M canciones", real positions kept |
| M45 | Search with no results, then "Limpiar búsqueda" / Escape / switching playlist | "Sin resultados para «texto»", then the full list again |
| M46 | Next / previous while a search hides rows | Follow the real list order, even to hidden songs |
| M47 | Lock screen / notification (phone) or media keys (desktop) | Title, artist, album and cover shown; play, pause, next, previous and seek work |
| M48 | Delete the playing playlist | Lock screen / media hub controls disappear |
| M49 | Nothing loaded | "Abrir reproduciendo ahora" disabled |
| M50 | Open with the chevron, the cover and the title | View opens over sidebar and list; focus on "Cerrar reproduciendo ahora"; sidebar and list not reachable with Tab |
| M51 | Close with the button and with Escape | View closes; focus returns to the control that opened it |
| M52 | "A continuación" in a list of 35 songs, playing the first | The next 25 songs in list order, then "y 9 más" |
| M53 | Click a queue item | That node plays in the same context; the queue moves; "Anteriores (N)" lists the previous songs nearest first |
| M54 | Last song, repeat off / toda la lista / una canción | "Es la última canción" / "Luego vuelve al inicio" / "Es la última canción" |
| M55 | Remove a queued song (view closed), reopen | The song no longer appears in the queue |
| M56 | Tabs with the keyboard | Arrows, Home and End move between "A continuación" and "Letra" |
| M57 | Song with a paired `.lrc` (loose files and folder) | Synced lyrics, "Letra del archivo .lrc", no request to LRCLIB |
| M58 | Song with embedded synced lyrics | Synced lyrics, "Letra incluida en el archivo" |
| M59 | Song with embedded plain lyrics | Static text, "Letra incluida en el archivo" |
| M60 | Well-known song without local lyrics | Lyrics from LRCLIB with "Letra de LRCLIB · solo se consultó el título y el artista"; the request contains only title, artist, album and duration |
| M61 | Invented song | "Letra no disponible para esta canción" |
| M62 | Offline (or LRCLIB answering 503), then "Reintentar" online | "No se pudo cargar la letra" + "Reintentar", then the real result |
| M63 | Active line while playing; click a line | Highlighted line follows the audio and stays centered; the click seeks to that line |
| M64 | Scroll the lyrics manually while playing | Automatic scroll pauses about 4 s, then resumes |
| M65 | Unpaired `.lrc` in the selection | Counted as "ignorada" |
| M66 | Phone width, light and dark | Full screen with large controls; compact player hidden while open and back after closing; no horizontal scroll |
| M67 | Create a playlist with the panel open | "Lista doble de «nombre»", "Lista vacía · head = null · tail = null" and the explanation; "Todavía no hay operaciones en esta lista" |
| M68 | Add at end on the empty playlist, then again | `append()`; "Se agregó «X» en la lista vacía: ahora es head y tail", then "Se agregó «Y» al final (tail)"; `length`, `head`, `tail` updated; the new node, its neighbor and their connector flash |
| M69 | Add at start | `prepend()`; "Se agregó «X» al inicio (head)"; `head` tag moves |
| M70 | Add at position 2 | `insert(1)`; "Se insertó «X» entre «A» y «B»"; three nodes and two connectors flash |
| M71 | Remove first / last / middle | `removeNode()`; "… del inicio: «B» es el nuevo head" / "… del final: «A» es el nuevo tail" / "Se quitó un nodo: «A» y «B» ahora se enlazan"; the two linked neighbors and their connector flash |
| M72 | Remove the current song while playing | Playback continues with the next song; `current` tag moves to it; sentence names the two nodes that are now linked |
| M73 | Next / previous | Only the `current` tag and the dashed neighbors move; no flash; "Última operación" unchanged |
| M74 | Repeat "toda la lista", next at the tail | `current` goes to `head`; the list stays non-circular (`tail.next` shows `null`) |
| M75 | Library or playlist with 40+ songs, playing the 30th | 31 cards ([14]…[44]), "… 14 nodos antes", "… N nodos después"; the current card is visible in the panel |
| M76 | Same list without being the context | Window starts at `head`, 16 cards and "… N nodos después"; no `current` tag |
| M77 | Switch the visible playlist | Panel follows it; nothing flashes; `current` only if that playlist is playing |
| M78 | Click a node card (mouse and Enter) | That node plays in the visible playlist and becomes `current` |
| M79 | Progress, play/pause, volume while the panel is open | The chain is not rebuilt (no flash, scroll position kept) |
| M80 | Hide / show on desktop at 1100, 1280, 1366, 1440 and 1920 px | Toggle `aria-pressed` and label change; the list takes the free space; no truncated fixed label, no horizontal scroll |
| M81 | Tablet (768–1099 px) | Hidden by default; toggle opens an overlay with backdrop; focus on "Ocultar estructura"; Escape and backdrop close it and focus returns to the toggle |
| M82 | Phone (< 768 px) | Hidden by default; toggle opens a bottom sheet (≤ 75% height) with handle and close button above the compact player; cards playable; no horizontal scroll |
| M83 | "Reproduciendo ahora" while the panel is open | The view covers the panel (panel `inert`); Escape closes the view first; pressing the structure toggle closes the view and shows the panel |
| M84 | Light and dark theme | Cards, tags, `current`, neighbors and flash readable in both |
| M85 | "Reducir movimiento" | No flash animation: the changed nodes keep a static highlight until the next change; scroll is instant |
| M86 | Screen reader | Each new operation sentence is announced once (`aria-live="polite"`); cards read "Reproducir «título», nodo i" |
| M87 | Right column tabs | "Sonando" is the default; "Estructura" shows the structure panel unchanged; arrows, Home and End move between tabs; the player bar toggle shows and hides the whole column |
| M88 | Nothing playing | "Nada sonando" with its hint |
| M89 | Playing in the middle of a list, then at head and tail (repeat off and "toda la lista") | Cards show the titles of `prev` and `next`; "Inicio de la lista" / "Fin de la lista" at the ends; with repeat "toda la lista" the wrap target with "(vuelve al final)" / "(vuelve al inicio)"; a click on a card plays that node |
| M90 | "A continuación" in "Sonando" with 12 songs after the current one | 8 items in list order; "Ver todo" opens "Reproduciendo ahora" on its queue tab; the expand button opens it too |
| M91 | "Subir" / "Bajar" on first, middle and last rows; with a search filter active | Disabled at the edges; the order changes and the structure tab says "Se movió «X» al índice i: ahora está entre «A» y «B»", flashing the moved node; the playing song keeps playing; buttons hidden while searching |
| M92 | "Duplicar" on the Library and on a playlist | The copy is created and shown, toast "Se creó «nombre (copia)»"; editing the copy leaves the original unchanged |
| M93 | Load songs, reload | Songs play with no reselection; the sidebar footer shows "N canciones en este navegador · X MB"; volume, mute, repeat, open column and tab restored |
| M94 | Remove a song from the Library, reload | The footer count and size drop; the song does not come back |
| M95 | "Borrar datos guardados" and confirm | The app reloads empty; no keys left in `localStorage`, the `musongs` IndexedDB store is empty |
| M96 | Block IndexedDB (private window or simulated failure), load songs, reload | One error toast; the songs play in the session; after reload they are unavailable with the banner; clicking one shows "Esta canción no está disponible" and changes neither the current song nor the context |
| M97 | Tablet and phone widths, light and dark | The two-tab column, banner and footer fit with no horizontal scroll |

| M98 | Delete one stored file from IndexedDB (or load without storing), reload, play the song before the missing one, then next and previous; with repeat "toda la lista" at the last song | Next and previous jump over the unavailable song; with repeat the wrap also skips it; when no other song is available nothing happens |
| M99 | Drag a row with the mouse to another position, to the first and to the last place; press Escape during a drag; release outside the list | Order changes with the structure tab showing the move; Escape and outside drops change nothing; the playing song keeps playing |
| M100 | Same on a phone width (touch): short swipe on the handle, then press and hold 300 ms and drag | The short swipe scrolls and does not drag; the long press lifts the row |
| M101 | Drag near the bottom and top edges of a long list | The list scrolls automatically while the line follows |
| M102 | Search something, then try the handles; open Explorar | Handles hidden while searching; no handles in Explorar |
| M103 | Drag a row over a user playlist in the sidebar and release | The playlist is highlighted while hovering; the song is added at its end with the toast "Se agregó «X» a «Playlist»" |
| M104 | Drag audio files (and a folder with a `.lrc`) from the file explorer over the Library (middle row), over an empty playlist and over a playlist | Overlay "Suelta para agregar" and the insertion line; Library: new songs inserted consecutively at that place; playlist: new songs also at the end of the Library and at the drop place; songs already in the Library are inserted too; lyrics paired; no overlay in Explorar |
| M105 | Drag the splitters (mouse), use ← / → and Shift, double click and Home; reload; resize the window to 1100 px and to a tablet width | Widths stay within 200–360 and 280–520 with the main column at 480 or more; `aria-valuenow` follows; defaults on double click and Home; widths kept after reload; clamped on resize; no splitters below 1100 px |
| M106 | Turn shuffle on while playing (player bar, header and `S`), press next several times, turn it off | The library order never changes; the playing song continues; "Sonando" shows "Orden aleatorio" and `nodo [0]` at the start; "Estructura" shows the shuffled list; turning off keeps the same song highlighted in the original; reload keeps the button pressed |
| M107 | Shuffle on, then add, move or remove a song of that playlist | The shuffled list is rebuilt keeping the current song |
| M108 | Open a playlist | Generated cover with the first letter and a stable gradient (same playlist, same colors after reload), name, "N canciones · M min"; Library shows its icon; "Importar aquí" hidden in the Library |
| M109 | Row hover and keyboard focus on the position cell; container narrower than 720 px | The number becomes a play button (label "Reproducir «título»"); "Origen" and the album column disappear under 720 px |
| M110 | "Agregar canciones" with several songs checked, a filter text, and each of Inicio / Final / Posición 2 | Songs enter in Library order at the chosen place; toast "Se agregaron N canciones"; nothing selected shows an inline error |
| M111 | "Importar aquí" with new and already known files | New files go to the end of the Library and of the playlist; known ones only to the playlist |
| M112 | "Sonando" while playing and after moving songs | `nodo [i] · length N` in monospace follows the current song and the structure |
| M113 | Open Explorar (online): skeleton, trending, chips, search with debounce, Enter, empty text, a nonsense search | Skeleton rows then results with "Origen: Audius"; chips and search exclude each other; "Sin resultados en Audius para «texto»" for no results |
| M114 | Play a result, use next, previous, repeat and shuffle, then run a new search while it plays | They follow the results list; the new search does not interrupt the song; "Estructura" shows the results while Explorar is visible |
| M115 | Add a result to the Library and to a playlist (also at a position) | Added to the Library first when missing (no duplicates), then to the playlist; "Origen" shows Audius; reload keeps them and they play; the sidebar storage note does not count them |
| M116 | Go offline (browser devtools), open Explorar, press "Reintentar" after going online; play a local song while offline | "No se pudo conectar con Audius" and "Reintentar"; results after retrying; local songs play offline |
| M117 | Block the stream request of an Audius song (devtools) and play it | Toast "No se pudo reproducir esta canción de Audius"; no automatic skip |
| M118 | "Ver en Audius" links | Open a new tab with `rel="noopener noreferrer"`; the footer shows "Música de Audius" and the privacy note |
| M119 | Remove a remote song from the Library | It disappears from every playlist; the results in Explorar can still be played |
| M120 | Keyboard: Space, Shift+→ / ←, → / ←, ↑ / ↓, M, S, R, L, E, /, ? | Each does what the button does; nothing happens while typing in a field or with a dialog open; Space on a focused button toggles that button only; ? opens "Atajos de teclado" |
| M121 | Old data: with `musongs.state.v1` of version 1 and old preferences in `localStorage`, open the app | The library loads (all songs local) and the old preferences apply with default panel widths and shuffle off |
| M122 | All new screens at desktop, tablet and phone widths, light and dark | No horizontal scroll, no overlapping controls, readable contrast |

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
