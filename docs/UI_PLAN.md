# UI_PLAN — Musongs

## 1. Concept

Streaming-style player with an optional, minimized "Estructura" panel that shows the doubly linked list working live.
Every element must have a function. Interface text in Spanish.

## 2. Layout

| Width | Layout |
|---|---|
| ≥ 1100px | Sidebar (240px) · main list · structure panel (320px, only when open) · player bar fixed at the bottom |
| 768–1099px | Sidebar (200px) · main list · structure panel overlays from the right · player bar |
| < 768px | Top bar with menu button; sidebar as drawer; structure panel as bottom sheet; compact player (cover, title, previous, play/pause, next; thin progress line on top) |

## 3. Regions

Sidebar: "Musongs" brand · "Tu música" → Biblioteca · "Playlists" list (selected one highlighted) · "Nueva playlist" · "Cargar canciones" · "Cargar carpeta".

Main list: header with name, "N canciones · M min", actions (rename, duplicate, delete; none for the Library). Rows: position (or playing indicator), cover, title, artist, duration, row menu. Row menu: "Agregar a…", "Quitar de esta playlist" (in the Library: "Eliminar de la biblioteca").

"Agregar a…" dialog: destination playlist selector (includes the Library only when the song is not already there), radio group Inicio / Final / Posición, number input `1..length+1` shown only for Posición, "Agregar" and "Cancelar".

Player bar: cover, title, artist · previous, play/pause, next · current time, progress (seekable), duration · mute, volume · structure panel button.

Structure panel: title "Estructura" with the list name · vertical chain of nodes: each node shows the song title; labels `head`, `tail`, `current`; between nodes "next ↓ / ↑ prev"; `length` · box "Última operación" with the readable description · close button.

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
| Next/previous at an edge | Button disabled with tooltip "Es la última canción" / "Es la primera canción" |
| Playback error | Toast "No se pudo reproducir este archivo" |

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
- Links changed by the last operation flash once (about 600ms).
- Panel and drawer slide in.
- All motion disabled under `prefers-reduced-motion: reduce`.

## 7. Accessibility

- Every icon-only button has a Spanish `aria-label`.
- Visible focus ring.
- Everything usable with keyboard (Tab, Enter, Space, Escape closes dialogs and drawer).
- Progress and volume are native `input type="range"` with labels.
