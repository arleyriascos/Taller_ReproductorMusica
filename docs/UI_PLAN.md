# UI_PLAN — Musongs

## 1. Concept

Streaming-style player with an "Estructura" panel that shows the doubly linked list working live. On desktop the panel is visible by default (it is the main academic showcase); on tablets and phones it opens on demand.
Every element must have a function. Interface text in Spanish.

## 2. Layout

| Width | Layout |
|---|---|
| ≥ 1100px | Sidebar (240px) · main list · structure panel (right column, `clamp(300px, 24vw, 340px)`, **visible by default**; hiding it gives the space back to the list) · player bar fixed at the bottom |
| 768–1099px | Sidebar (224px) · main list · structure panel hidden by default, opens as an overlay from the right (up to 360px) above the player bar, with a backdrop · player bar |
| < 768px | Top bar with menu button; sidebar as drawer; structure panel hidden by default, opens as a bottom sheet (max 75% of the height) with a handle and close button, above the compact player; compact player (cover, title, previous, play/pause, next, repeat, structure toggle; thin progress line on top) |

"Reproduciendo ahora": from 768px it covers the sidebar, the main list and the structure panel (the player bar stays visible below); under 768px it is full screen with its own large controls and the compact player is hidden.

The track list hides its album column when the list itself is narrower than 720px (container query), so the open panel never squeezes the columns.

## 3. Regions

Sidebar: "Musongs" brand · "Tu música" → Biblioteca · "Playlists" list (selected one highlighted) · "Nueva playlist" · "Cargar canciones" · "Cargar carpeta".

Main list: header with name, "N canciones · M min", actions ("Agregar canción", rename, duplicate, delete; none for the Library), and a toolbar with the round play button and the search box "Buscar en esta lista" (both also in the Library). Rows: position (or playing indicator), cover, title, artist, album, duration, and two direct icon buttons (see section 8). Remove button label: "Quitar de esta playlist" (in the Library: "Eliminar de la biblioteca").

"Agregar canción" dialog: one dialog with two entry modes (see section 8), radio group Inicio / Final / Posición, number input `1..length+1` of the destination shown only for Posición, "Agregar" and "Cancelar".

Player bar: cover, title, artist, "Abrir reproduciendo ahora" (chevron) · previous, play/pause, next, repeat · current time, progress (seekable), duration · mute, volume · structure panel button.

"Reproduciendo ahora": header with close button, "Reproduciendo ahora" and "Reproduciendo desde «lista»" · large cover, title, artist, album · (mobile) large controls and progress · tabs "A continuación" and "Letra".

Structure panel (visible playlist): title "Estructura", subtitle "Lista doble de «nombre»", close button "Ocultar estructura" · summary `length = N · head = … · tail = …` · box "Última operación" (code form and Spanish sentence) · vertical chain of node cards (`[i]`, title, `prev:` / `next:`, tags `head`, `tail`, `current`) with "next ↓ / ↑ prev" between cards and "… N nodos antes / después" at the edges of the window · "Historial (últimas 6)" collapsed at the bottom. See section 11.

## 4. States

| State | What is shown |
|---|---|
| Empty Library | Illustration-free card: "Carga tu primera canción", short text, buttons "Cargar canciones" and "Cargar carpeta" |
| Empty playlist | "Esta playlist está vacía", "Agrega canciones desde la Biblioteca" |
| Nothing playing | Player bar shows "Elige una canción" with controls disabled |
| Unavailable song | Row in muted color with "Archivo no disponible"; clicking explains how to reconnect |
| After reload with saved data | Banner "Reconecta tus archivos para escucharlos" with "Cargar carpeta" |
| Rejected files | Toast "3 archivos no son compatibles" with a detail action |
| Duplicates | Toast "2 canciones ya estaban en la biblioteca" |
| Invalid position | Inline error inside the dialog |
| Next/previous at an edge | Button disabled with tooltip "Es la última canción" / "Es la primera canción" (enabled when repeat is "toda la lista") |
| Nothing can be played | Play buttons (player bar and playlist header) neutral gray with a muted icon, never accent |
| Search without results | "Sin resultados para «texto»" and "Limpiar búsqueda"; header shows "0 de M canciones" |
| Playback error | Toast "No se pudo reproducir este archivo" |
| Nothing loaded | "Abrir reproduciendo ahora" disabled; the view closes if the player becomes empty |
| Queue at the end | "Es la última canción"; with repeat "toda la lista": "Luego vuelve al inicio" |
| Lyrics loading | "Cargando letra…" |
| Lyrics not found | "Letra no disponible para esta canción" |
| Lyrics error (offline, LRCLIB busy) | "No se pudo cargar la letra" and "Reintentar" |
| Instrumental | "Instrumental" |

## 5. Visual identity

Theme follows `prefers-color-scheme`. All colors are CSS custom properties defined once in `styles.css`; the dark block redefines them.

| Token | Light | Dark |
|---|---|---|
| `--color-bg` | #FAFAFB | #121214 |
| `--color-surface` | #FFFFFF | #1A1A1F |
| `--color-surface-raised` | #F2F2F5 | #24242B |
| `--color-border` | #E4E4E9 | #2E2E36 |
| `--color-text` | #17171C | #F2F2F5 |
| `--color-text-muted` | #5F5F6B | #A0A0AB |
| `--color-accent` | #C93A26 | #FF6B57 |
| `--color-accent-hover` | #B0321F | #FF8573 |
| `--color-on-accent` | #FFFFFF | #1A0D0A |
| `--color-danger` | #C0262D | #FF6B6B |
| `--color-success` | #1E7A46 | #4ADE80 |

The accent is the only highlight color: current song, progress, play button, `current` node. Verify WCAG AA contrast (4.5:1 for text) for every text/background pair; adjust the hex values if a pair fails and report the change.

Typography: "Manrope" for the interface, "JetBrains Mono" for the structure panel, both from Google Fonts with system fallbacks.

Shape: 8px radius for controls, 12px for cards and panels. Icons: inline SVG, 20px, `currentColor`.

## 6. Motion and feedback

- Row hover background, pressed state on buttons.
- Current row and current node highlighted with the accent.
- Nodes and links changed by a new operation flash once (800ms); under reduced motion they keep a static highlight until the next change.
- Panel and drawer slide in.
- All motion disabled under `prefers-reduced-motion: reduce`.

## 7. Accessibility

- Every icon-only button has a Spanish `aria-label`.
- Visible focus ring.
- Everything usable with keyboard (Tab, Enter, Space, Escape closes dialogs and drawer).
- Progress and volume are native `input type="range"` with labels.

## 8. Interaction decisions (stage 5)

1. Rows have two direct icon buttons instead of a "⋯" menu: "Agregar a…" (plus icon) and remove (trash icon). On pointer devices with hover they appear on row hover or keyboard focus; on touch devices and screens under 768px they are always visible.
2. One "Agregar canción" dialog with two entry modes that share the same code:
   - From a row (song fixed): choose the destination playlist and the position. Only user playlists are destinations; the Library is never a destination.
   - From the playlist header button "Agregar canción" (destination fixed): choose a song from the Library with a native select, and the position.
   - Position: radio group Inicio / Final / Posición (default Final). The number input (1..length+1 of the destination) only appears for Posición. Invalid input shows "Escribe un número entre 1 y N" inline and keeps the dialog open.
3. Removing from a playlist removes only that node, without confirmation. Removing from the Library asks for confirmation ("Se quitará de la biblioteca y de todas tus playlists") and calls `removeSongEverywhere`.
4. Each view owns the dialogs it opens: `SidebarView` → "Nueva playlist"; `TrackListView` → rename, add song, confirm delete playlist, confirm remove from Library. All are native `<dialog>` opened with `showModal()`, built by the shared `DialogView`; Escape and a click on the backdrop close them, and focus returns to the control that opened them.
5. Name validation: the view calls an `App` handler that returns `PlaylistNameIssue | null` synchronously and shows the message inline: `empty` → "Escribe un nombre", `too-long` → "Máximo 40 caracteres", `duplicate` → "Ya tienes una playlist con ese nombre".
6. `format.ts` holds pure functions: `formatTime(seconds)` → "m:ss" or "h:mm:ss", "—:—" for 0 or invalid (durations); `formatElapsed(seconds)` → same format but "0:00" for 0 (elapsed time in the player); `formatTotal(seconds)` → "N min" / "N h M min" (rounded up); `countLabel(count, singular, plural)`.
7. `icons.ts` exports SVG markup written for this project. It is turned into elements only by `createIcon` (and the button helpers built on it), which parses trusted constant markup selected by icon name; user data never goes through it.
8. `document.title` is "▶ <title> · Musongs" while playing, "<title> · Musongs" when paused with a song, and "Musongs" otherwise.
9. While loading files, a persistent notice "Cargando canciones…" is shown in the notification area and every load button is disabled. After loading, one toast summarizes only the non-zero counts (agregadas, duplicadas, reconectadas, no compatibles, ignoradas). Files that are not audio (pdf, jpg) count as "ignoradas"; audio formats the browser cannot play count as "no compatibles".
10. Toasts auto-dismiss after about 4 s and have a close button; errors use `role="alert"`, the rest `role="status"`.
11. Dragging the progress range previews the time without seeking; the seek happens on release. Incoming progress does not move the thumb during the drag.

## 9. Interaction decisions (stage 6)

1. Sidebar: fixed labels ("Biblioteca", headings, load buttons) never truncate; the load and "Nueva playlist" buttons take the full sidebar width and wrap their text if needed instead of overflowing. Only user playlist names truncate with ellipsis, and their full name is in the `title` attribute. The sidebar never scrolls horizontally and shows a vertical scrollbar only when its content overflows. Checked at 768, 900, 1024, 1180, 1366 and 1440 px, light and dark.
2. Scrollbars are thin and themed with `--color-scrollbar`, `--color-scrollbar-hover` and `--color-scrollbar-track` (`scrollbar-width` / `scrollbar-color`, plus `::-webkit-scrollbar` rules for browsers without them).
3. Disabled play buttons use `--color-surface-raised` with a border ring and a muted icon, so they never look like the active accent button.
4. Playlist play button (52px, round, accent): plays the playlist from its first available song when it is not the context; when it is the context it toggles play/pause, showing the pause icon with aria-label "Pausar" while playing and the play icon with "Reproducir playlist" otherwise. Disabled for an empty playlist.
5. The current row of the context playlist replaces its number with three equalizer bars: animated while playing, static (different heights) while paused, static under `prefers-reduced-motion`. Colors from `--color-accent`.
6. Repeat button after "Siguiente": "Repetir: desactivado" (muted icon), "Repetir: toda la lista" (accent icon with a dot), "Repetir: una canción" (accent icon with a "1" and a dot). It is visible in the compact mobile player too.
7. Search box with a search icon, at the right of the play button (full remaining width on mobile). Matches title, artist and album ignoring case and accents with the "ñ" rule. Hidden when the list is empty, reset when switching playlists, Escape or "Limpiar búsqueda" clear it. Hidden rows keep their real position numbers.
8. Media Session: lock screen and notification controls on Android Chrome, the media hub / hardware media keys on desktop Chrome and Edge, Control Center and lock screen on iOS / macOS Safari. Shows title, artist, album and cover.

## 10. Interaction decisions (stage 7: "Reproduciendo ahora")

1. Opening: the chevron button "Abrir reproduciendo ahora" in the player bar, or a click on the cover or title. While open, the button shows a downward chevron with "Cerrar reproduciendo ahora" and `aria-expanded="true"`. On phones the button lies transparently over the cover, so the title keeps its width and tapping the cover opens the view. Disabled when nothing is loaded.
2. Closing: close button (downward chevron) or Escape. Focus moves to the close button on open and returns to the previously focused control on close. The covered regions are `inert` while the view is open.
3. Layout: two columns from 768px (cover and data on the left, tabs on the right; the tab panel scrolls). Under 768px the view is full screen and scrolls as a column; the large controls are a second `PlayerBarView` (previous, play/pause, next, repeat, progress with times) and the compact player bar is hidden.
4. Tabs: "A continuación" (default) and "Letra", with `tablist` / `tab` / `tabpanel`; arrows, Home and End move between tabs.
5. "A continuación": up to 25 songs following `next` from the current node, each with cover, title, artist, duration; a click plays that node in the context playlist. Then "y N más" when longer. "Anteriores (N)" is a collapsed `<details>` with up to 10 songs following `prev`, nearest first. Notes: "Luego vuelve al inicio" with repeat "toda la lista"; otherwise "Es la última canción" when nothing follows.
6. "Letra": requested only when the tab is open (and again when the song changes while it is open). Synced lyrics: lines 1.375rem bold, muted; the active line in `--color-accent`, centered in the lyrics box with smooth scroll (instant under reduced motion); clicking a line seeks to it; wheel, touch, scrollbar drag or scroll keys pause the automatic scroll for 4 s. Unsynced lyrics: static text. Source note under the lyrics: "Letra del archivo .lrc", "Letra incluida en el archivo" or "Letra de LRCLIB · solo se consultó el título y el artista".
7. The view never rebuilds on progress: only the active lyric line and the progress control change.

## 11. Interaction decisions (stage 8: structure panel)

1. Decision change: the panel is no longer minimized by default. From 1100px it is a visible right column; hiding it gives the space back to the list. Under 1100px it starts hidden. Crossing 1100px resets it to that width's default; remembering the preference arrives with persistence.
2. Toggle: icon button with linked nodes in the player bar (before mute on desktop and tablet, after repeat on phones), `aria-pressed`, labels "Mostrar estructura" / "Ocultar estructura", accent color while pressed. Pressed while "Reproduciendo ahora" is open, it closes that view and shows the panel.
3. Tablet (768–1099px): overlay from the right above the player bar with a backdrop; Escape, the backdrop and the close button close it; focus moves to the close button on open and back to the toggle on close. Phone (< 768px): bottom sheet above the compact player, max 75% of the height, handle and close button, same closing rules. The player stays usable below both, so next / previous can be watched live.
4. Content follows the visible playlist. `current` appears only when that playlist is the player context; its `prev` and `next` neighbors get a dashed accent border. A click on a card plays that node.
5. Long lists: at most 15 nodes before and 15 after the focus (`current` when this playlist is the context, otherwise `head`), with "… N nodos antes" / "… N nodos después". The focus card is kept in view (smooth scroll, instant under reduced motion).
6. "Última operación": code form with the 0-based index (`insert(1)` for "Posición 2", matching the `[1]` card) and a sentence: "Se agregó «X» al final (tail)", "Se agregó «X» al inicio (head)", "Se insertó «X» entre «A» y «B»", "Se agregó «X» en la lista vacía: ahora es head y tail", "Se quitó «X» del inicio: «B» es el nuevo head", "Se quitó «X» del final: «A» es el nuevo tail", "Se quitó un nodo: «A» y «B» ahora se enlazan", "Se quitó «X», el único nodo: la lista quedó vacía", "Se vaciaron todos los nodos: head y tail ahora son null". With no operations: "Todavía no hay operaciones en esta lista".
7. Flash: only for a new operation on the playlist already shown, never on a playlist switch, playback change or progress tick, and never while the panel is closed. The sentence is announced through an `aria-live="polite"` region.
8. Fonts: JetBrains Mono for summary, code and nodes; Manrope for the title, labels and sentences. Colors only from tokens (`--color-flash` and `--color-neighbor` are mixes of the accent).
9. While the panel is open on desktop, toasts move to the left of it so they do not cover the chain.
