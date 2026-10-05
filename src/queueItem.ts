import { artistLabel, formatTime } from "./format";
import { setCover } from "./icons";
import type { Node } from "./Node";
import type { Song } from "./Song";
import type { RepeatMode } from "./types";

export type QueueRegistry = WeakMap<Element, Node<Song>>;

export function createQueueItem(node: Node<Song>, registry: QueueRegistry): HTMLLIElement {
  const song = node.value;
  const item = document.createElement("li");
  const button = Object.assign(document.createElement("button"), { type: "button", className: "queue-item" });
  button.classList.toggle("is-unavailable", !song.isAvailable());
  button.setAttribute("aria-label", `Reproducir ${song.title}`);
  const cover = Object.assign(document.createElement("span"), { className: "cover queue-cover" });
  setCover(cover, song.coverUrl);
  button.append(cover, createText(song), createDuration(song));
  registry.set(button, node);
  item.append(button);
  return item;
}

export function queueNote(repeatMode: RepeatMode, upcoming: number): string {
  if (repeatMode === "all") {
    return "Luego vuelve al inicio";
  }
  return upcoming === 0 ? "Es la última canción" : "";
}

function createText(song: Song): HTMLSpanElement {
  const text = Object.assign(document.createElement("span"), { className: "queue-text" });
  const detail = song.isAvailable() ? artistLabel(song.artist) : "Archivo no disponible";
  text.append(
    Object.assign(document.createElement("span"), { className: "queue-title", textContent: song.title }),
    Object.assign(document.createElement("span"), { className: "queue-artist", textContent: detail }),
  );
  return text;
}

function createDuration(song: Song): HTMLSpanElement {
  return Object.assign(document.createElement("span"), { className: "queue-duration", textContent: formatTime(song.duration) });
}
