import { DialogView } from "./DialogView";
import { artistLabel, comparableText, countLabel } from "./format";
import { createIcon } from "./icons";
import { PlacementFieldsView } from "./PlacementFieldsView";
import type { Playlist } from "./Playlist";
import type { Song } from "./Song";
import type { AddSongsRequest } from "./types";

const EMPTY_LIBRARY = "Tu biblioteca está vacía. Carga canciones primero.";

export class AddSongsDialogView {
  readonly #dialog = new DialogView(document.body, "Agregar canciones", "Agregar");
  readonly #summary = Object.assign(document.createElement("p"), { className: "dialog-text" });
  readonly #filter = Object.assign(document.createElement("input"), {
    type: "search",
    className: "text-input",
    placeholder: "Filtrar canciones",
    autocomplete: "off",
    spellcheck: false,
  });
  readonly #list = Object.assign(document.createElement("ul"), { className: "checkbox-list" });
  readonly #selection = Object.assign(document.createElement("p"), { className: "field-hint" });
  readonly #placement = new PlacementFieldsView();
  readonly #songs = new Map<HTMLInputElement, Song>();
  readonly #items = new Map<HTMLInputElement, HTMLLIElement>();
  #destination: Playlist | null = null;
  #handler: (request: AddSongsRequest) => void = () => {};

  constructor() {
    this.#filter.setAttribute("aria-label", "Filtrar canciones de la biblioteca");
    this.#list.setAttribute("aria-label", "Canciones de la biblioteca");
    this.#dialog.body.append(this.#summary, this.#filter, this.#list, this.#selection, this.#placement.element);
    this.#filter.addEventListener("input", () => this.applyFilter());
    this.#list.addEventListener("change", () => this.updateSelection());
    this.#placement.onChange(() => this.#dialog.clearError());
    this.#dialog.onConfirm(() => this.confirm());
  }

  onConfirm(handler: (request: AddSongsRequest) => void): void {
    this.#handler = handler;
  }

  onClose(handler: () => void): void {
    this.#dialog.onClose(handler);
  }

  open(destination: Playlist, library: Playlist): void {
    this.#destination = destination;
    this.#summary.textContent = `Destino: ${destination.name}`;
    this.#filter.value = "";
    this.fillList(library);
    this.#placement.setMaxPosition(destination.length + 1);
    this.#placement.reset();
    this.updateSelection();
    this.#dialog.open(this.#filter);
    if (library.length === 0) {
      this.#dialog.showError(EMPTY_LIBRARY);
    }
  }

  private fillList(library: Playlist): void {
    this.#songs.clear();
    this.#items.clear();
    this.#list.replaceChildren();
    for (const node of library.nodes()) {
      const { item, checkbox } = AddSongsDialogView.createItem(node.value);
      this.#songs.set(checkbox, node.value);
      this.#items.set(checkbox, item);
      this.#list.append(item);
    }
  }

  private applyFilter(): void {
    const query = comparableText(this.#filter.value);
    for (const [checkbox, song] of this.#songs) {
      const item = this.#items.get(checkbox);
      if (item !== undefined) {
        item.hidden = query !== "" && ![song.title, song.artist, song.album].some((field) => comparableText(field).includes(query));
      }
    }
  }

  private selectedSongs(): Set<Song> {
    const selected = new Set<Song>();
    for (const [checkbox, song] of this.#songs) {
      if (checkbox.checked) {
        selected.add(song);
      }
    }
    return selected;
  }

  private updateSelection(): void {
    this.#selection.textContent = countLabel(this.selectedSongs().size, "seleccionada", "seleccionadas");
    this.#dialog.clearError();
  }

  private confirm(): string | null {
    const songs = this.selectedSongs();
    const destination = this.#destination;
    if (destination === null || songs.size === 0) {
      return "Selecciona al menos una canción";
    }
    const placement = this.#placement.read();
    if (typeof placement === "string") {
      return placement;
    }
    this.#handler({ songs, playlistId: destination.id, placement });
    return null;
  }

  private static createItem(song: Song): { item: HTMLLIElement; checkbox: HTMLInputElement } {
    const item = document.createElement("li");
    const label = Object.assign(document.createElement("label"), { className: "checkbox-row" });
    const checkbox = Object.assign(document.createElement("input"), { type: "checkbox" });
    const text = Object.assign(document.createElement("span"), { className: "checkbox-text" });
    text.append(
      Object.assign(document.createElement("span"), { className: "checkbox-title", textContent: song.title }),
      Object.assign(document.createElement("span"), { className: "checkbox-artist", textContent: artistLabel(song.artist) }),
    );
    label.append(checkbox, text);
    if (song.isRemote) {
      label.append(createIcon("cloud"));
    }
    item.append(label);
    return { item, checkbox };
  }
}
