import { artistLabel, formatTime } from "./format";
import { createIcon, createIconButton, setCover } from "./icons";
import type { Node } from "./Node";
import type { Song } from "./Song";

export type RowKind = "library" | "playlist" | "explore";

export interface TrackRowOptions {
  position: number;
  kind: RowKind;
}

const REMOVE_LABELS: Record<RowKind, string> = {
  library: "Eliminar de la biblioteca",
  playlist: "Quitar de esta playlist",
  explore: "",
};

const COLUMN_TITLES: readonly (readonly [string, string])[] = [
  ["track-position", "#"],
  ["track-columns-title", "Título"],
  ["track-album", "Álbum"],
  ["track-source", "Origen"],
  ["track-duration", "Duración"],
];

export function createTrackRow(node: Node<Song>, options: TrackRowOptions): HTMLLIElement {
  const song = node.value;
  const row = Object.assign(document.createElement("li"), { className: "track-row" });
  row.classList.toggle("is-unavailable", !song.isAvailable());
  row.append(createGrip(), createMain(song, options.position), createActions(node, options.kind));
  return row;
}

function createGrip(): HTMLButtonElement {
  const grip = createIconButton("grip", "Arrastrar para mover", "icon-button track-grip");
  grip.dataset.dragHandle = "";
  grip.tabIndex = -1;
  return grip;
}

function createMain(song: Song, position: number): HTMLDivElement {
  const main = Object.assign(document.createElement("div"), { className: "track-main" });
  main.dataset.action = "play";
  main.append(
    createPosition(song, position),
    createCover(song),
    createSongText(song),
    Object.assign(document.createElement("span"), { className: "track-album", textContent: song.album }),
    createSource(song),
    Object.assign(document.createElement("span"), { className: "track-duration", textContent: formatTime(song.duration) }),
  );
  return main;
}

function createPosition(song: Song, position: number): HTMLSpanElement {
  const cell = Object.assign(document.createElement("span"), { className: "track-position" });
  const play = Object.assign(document.createElement("button"), { type: "button", className: "track-play" });
  play.dataset.action = "play";
  play.setAttribute("aria-label", `Reproducir «${song.title}»`);
  const bars = Object.assign(document.createElement("span"), { className: "track-bars" });
  bars.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
  const hoverPlay = Object.assign(document.createElement("span"), { className: "track-hover-play" });
  hoverPlay.append(createIcon("play"));
  play.append(Object.assign(document.createElement("span"), { className: "track-number", textContent: String(position) }), bars, hoverPlay);
  cell.append(play);
  return cell;
}

function createSource(song: Song): HTMLSpanElement {
  const cell = Object.assign(document.createElement("span"), { className: "track-source" });
  cell.append(createIcon(song.isRemote ? "cloud" : "file"), Object.assign(document.createElement("span"), { textContent: song.isRemote ? "Audius" : "Archivo local" }));
  return cell;
}

function createCover(song: Song): HTMLSpanElement {
  const cover = Object.assign(document.createElement("span"), { className: "cover track-cover" });
  setCover(cover, song.coverUrl);
  return cover;
}

function createSongText(song: Song): HTMLSpanElement {
  const text = Object.assign(document.createElement("span"), { className: "track-text" });
  const detail = song.isAvailable() ? artistLabel(song.artist) : "Archivo no disponible";
  text.append(
    Object.assign(document.createElement("span"), { className: "track-title", textContent: song.title }),
    Object.assign(document.createElement("span"), { className: "track-artist", textContent: detail }),
  );
  return text;
}

function createAudiusLink(song: Song): HTMLAnchorElement {
  const link = Object.assign(document.createElement("a"), { className: "icon-button track-action", target: "_blank", rel: "noopener noreferrer" });
  link.href = song.pageUrl ?? "https://audius.co";
  link.setAttribute("aria-label", `Ver «${song.title}» en Audius`);
  link.title = "Ver en Audius";
  link.append(createIcon("external"));
  return link;
}

export function createTrackColumns(): HTMLDivElement {
  const columns = Object.assign(document.createElement("div"), { className: "track-columns" });
  columns.setAttribute("aria-hidden", "true");
  for (const [className, text] of COLUMN_TITLES) {
    columns.append(Object.assign(document.createElement("span"), { className, textContent: text }));
  }
  return columns;
}

function createActions(node: Node<Song>, kind: RowKind): HTMLSpanElement {
  const song = node.value;
  const actions = Object.assign(document.createElement("span"), { className: "track-actions" });
  const add = createIconButton("plus", `Agregar «${song.title}» a una playlist`, "icon-button track-action");
  add.dataset.action = "add";
  if (kind === "explore") {
    actions.append(createAudiusLink(song), add);
    return actions;
  }
  const up = createIconButton("chevronUp", `Subir «${song.title}»`, "icon-button track-action track-move");
  const down = createIconButton("chevronDown", `Bajar «${song.title}»`, "icon-button track-action track-move");
  const remove = createIconButton("trash", `${REMOVE_LABELS[kind]}: ${song.title}`, "icon-button track-action track-action-danger");
  up.dataset.action = "move-up";
  down.dataset.action = "move-down";
  up.disabled = node.prev === null;
  down.disabled = node.next === null;
  remove.dataset.action = "remove";
  actions.append(up, down, add, remove);
  return actions;
}
